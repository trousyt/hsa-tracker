import { afterEach, describe, expect, it, vi } from "vitest"
import { sessionIdentity } from "@convex-dev/auth/test"
import { api } from "./_generated/api"
import { MAX_OCR_PAGES_PER_MONTH } from "./lib/constants"
import { createSessionContext, signUpTestUser } from "../src/test/session.fixture"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("documents authenticated application boundary", () => {
  it("rejects missing storage and mismatched stored metadata before saving a document", async () => {
    const { t, authed } = await createSessionContext()
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" })))
    const metadata = { storageId, originalFilename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: 7 }
    await expect(authed.mutation(api.documents.save, { ...metadata, sizeBytes: 8 })).rejects.toThrow("File size does not match")
    await expect(authed.mutation(api.documents.save, { ...metadata, mimeType: "image/png" })).rejects.toThrow("File type does not match")
    await expect(authed.mutation(api.documents.save, { ...metadata, mimeType: "text/html" })).rejects.toThrow("Unsupported file type")
    await t.run((ctx) => ctx.storage.delete(storageId))
    await expect(authed.mutation(api.documents.save, metadata)).rejects.toThrow("File is too large or no longer exists")
    expect(await t.run((ctx) => ctx.db.query("documents").collect())).toEqual([])
  })

  it("authorizes upload URL generation, saves storage metadata and attaches the document to its owner's expense", async () => {
    const { t, authed, userId } = await createSessionContext()
    expect(await authed.mutation(api.documents.generateUploadUrl, {})).toEqual(expect.any(String))
    await expect(t.mutation(api.documents.generateUploadUrl, {})).rejects.toThrow("Not authenticated")
    // Supply stored bytes locally; this is not evidence of the deployment upload HTTP transport.
    const storageId = await t.run(async (ctx) => {
      const now = new Date()
      // Keep this test at the document boundary rather than invoking external OCR.
      await ctx.db.insert("ocrUsage", {
        yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        pagesProcessed: MAX_OCR_PAGES_PER_MONTH,
        lastUpdated: Date.now(),
      })
      return await ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" }))
    })
    const metadata = { storageId, originalFilename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: 7 }
    await expect(t.mutation(api.documents.save, metadata)).rejects.toThrow("Not authenticated")
    const { documentId, ocrScheduled } = await authed.mutation(api.documents.save, metadata)
    expect(ocrScheduled).toBe(false)
    expect(await authed.query(api.documents.get, { id: documentId })).toMatchObject({ ...metadata, userId })
    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-01", provider: "Example", amountCents: 100,
    })
    await authed.mutation(api.documents.addToExpense, { expenseId, documentId })
    expect(await authed.query(api.expenses.get, { id: expenseId })).toMatchObject({ documentIds: [documentId] })
    const response = await authed.fetch(`/api/files/${documentId}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("receipt")

    const otherResult = await t.mutation(signUpTestUser, { username: "otheruser", password: "correct horse battery staple" })
    if (!otherResult.tokens) throw new Error("Test sign-up failed")
    const other = t.withIdentity(sessionIdentity(otherResult.tokens))
    for (const caller of [t, other]) {
      expect(await caller.query(api.documents.get, { id: documentId })).toBeNull()
      expect(await caller.query(api.documents.getMany, { ids: [documentId] })).toEqual([])
      await expect(caller.mutation(api.documents.remove, { id: documentId })).rejects.toThrow()
      await expect(caller.mutation(api.documents.addToExpense, { expenseId, documentId })).rejects.toThrow()
    }
    expect(await authed.query(api.documents.getMany, { ids: [documentId] })).toHaveLength(1)
    expect(await t.run(async (ctx) => (await ctx.storage.get(storageId)) !== null)).toBe(true)
  })
})
