import { convexTest } from "convex-test"
import { expect, test, describe } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { modules } from "./test.setup"

async function createAuthenticatedContext() {
  const t = convexTest(schema, modules)
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      isOwner: true,
    })
  })
  const authed = t.withIdentity({ subject: userId as unknown as string })
  return { t, authed, userId }
}

/** Create a document with a valid storage ID in the test environment. */
async function createTestDocument(
  t: ReturnType<typeof convexTest>,
  userId: string
) {
  return await t.run(async (ctx) => {
    const blob = new Blob(["test file content"], { type: "image/jpeg" })
    const storageId = await ctx.storage.store(blob)
    return await ctx.db.insert("documents", {
      userId,
      originalFilename: "receipt.jpg",
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
      storageId,
      ocrStatus: "processing",
    })
  })
}

describe("updateOcrResults", () => {
  test("resets ocrAcknowledged on owning expense when new OCR data completes", async () => {
    const { t, authed, userId } = await createAuthenticatedContext()

    const documentId = await createTestDocument(t, userId as unknown as string)

    // Create an expense and attach the document
    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-15",
      provider: "Test Provider",
      amountCents: 5000,
    })
    await authed.mutation(api.documents.addToExpense, {
      expenseId,
      documentId,
    })
    await authed.mutation(api.expenses.acknowledgeOcr, { id: expenseId })

    // Verify acknowledged
    const beforeExpense = await t.run(async (ctx) => ctx.db.get(expenseId))
    expect(beforeExpense?.ocrAcknowledged).toBe(true)

    // Simulate OCR completion with extracted data
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.ocr.updateOcrResults, {
        documentId,
        ocrExtractedData: {
          amount: { valueCents: 2500, confidence: 0.95 },
          provider: { value: "Pharmacy", confidence: 0.9 },
        },
      })
    })

    // ocrAcknowledged should be reset to false
    const afterExpense = await t.run(async (ctx) => ctx.db.get(expenseId))
    expect(afterExpense?.ocrAcknowledged).toBe(false)
  })

  test("does NOT reset ocrAcknowledged when OCR data has no extractable fields", async () => {
    const { t, authed, userId } = await createAuthenticatedContext()

    const documentId = await createTestDocument(t, userId as unknown as string)

    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-15",
      provider: "Test Provider",
      amountCents: 5000,
    })
    await authed.mutation(api.documents.addToExpense, {
      expenseId,
      documentId,
    })
    await authed.mutation(api.expenses.acknowledgeOcr, { id: expenseId })

    // OCR completes with empty data
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.ocr.updateOcrResults, {
        documentId,
        ocrExtractedData: {},
      })
    })

    // ocrAcknowledged should still be true
    const afterExpense = await t.run(async (ctx) => ctx.db.get(expenseId))
    expect(afterExpense?.ocrAcknowledged).toBe(true)
  })

  test("does NOT reset ocrAcknowledged when document is not attached to any expense", async () => {
    const { t, userId } = await createAuthenticatedContext()

    const documentId = await createTestDocument(t, userId as unknown as string)

    // OCR completes — no expense to reset
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.ocr.updateOcrResults, {
        documentId,
        ocrExtractedData: {
          amount: { valueCents: 1000, confidence: 0.8 },
        },
      })
    })

    // Should not throw — just a no-op for the reset logic
    const doc = await t.run(async (ctx) => ctx.db.get(documentId))
    expect(doc?.ocrStatus).toBe("completed")
  })
})
