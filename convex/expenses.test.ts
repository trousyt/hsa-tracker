import { convexTest } from "convex-test"
import { expect, test, describe } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { modules } from "./test.setup"

// Helper to create an authenticated test context
// The convex-test library automatically generates subject/issuer/tokenIdentifier
// when using withIdentity, which works with getAuthUserId
async function createAuthenticatedContext() {
  const t = convexTest(schema, modules)

  // Create a user in the database first
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      isOwner: true,
    })
  })

  // Create authenticated context with subject matching the user ID
  const authed = t.withIdentity({ subject: userId as unknown as string })

  return { t, authed, userId }
}

describe("expenses", () => {
  describe("CRUD operations", () => {
    test("create expense with required fields", async () => {
      const { authed, userId } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Dr. Smith",
        amountCents: 15000,
      })

      expect(expenseId).toBeDefined()

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toMatchObject({
        userId: userId as unknown as string,
        datePaid: "2026-01-15",
        provider: "Dr. Smith",
        amountCents: 15000,
        status: "unreimbursed",
        totalReimbursedCents: 0,
        documentIds: [],
      })
    })

    test("create expense with optional comment", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "CVS Pharmacy",
        amountCents: 2500,
        comment: "Prescription medication",
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.comment).toBe("Prescription medication")
    })

    test("list expenses returns all expenses", async () => {
      const { authed } = await createAuthenticatedContext()

      await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 1000,
      })
      await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 2000,
      })

      const expenses = await authed.query(api.expenses.list, {})
      expect(expenses).toHaveLength(2)
    })

    test("list expenses filters by status", async () => {
      const { authed } = await createAuthenticatedContext()

      const expense1 = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 1000,
      })
      await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 2000,
      })

      // Mark first expense as reimbursed
      await authed.mutation(api.reimbursements.recordFull, {
        expenseId: expense1,
      })

      const unreimbursed = await authed.query(api.expenses.list, {
        status: "unreimbursed",
      })
      expect(unreimbursed).toHaveLength(1)
      expect(unreimbursed[0].provider).toBe("Provider B")

      const reimbursed = await authed.query(api.expenses.list, {
        status: "reimbursed",
      })
      expect(reimbursed).toHaveLength(1)
      expect(reimbursed[0].provider).toBe("Provider A")
    })

    test("update expense fields", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Original Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.update, {
        id: expenseId,
        provider: "Updated Provider",
        amountCents: 1500,
        comment: "Added comment",
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toMatchObject({
        provider: "Updated Provider",
        amountCents: 1500,
        comment: "Added comment",
      })
    })

    test("soft delete hides expense from queries", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "To Delete",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })

      // Should be hidden from get and list
      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toBeNull()

      const expenses = await authed.query(api.expenses.list, {})
      expect(expenses).toHaveLength(0)
    })

    test("undo soft delete restores expense", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Restored",
        amountCents: 2000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })
      await authed.mutation(api.expenses.undoSoftDelete, { id: expenseId })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).not.toBeNull()
      expect(expense?.provider).toBe("Restored")
    })

    test("double undo is a no-op", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })
      await authed.mutation(api.expenses.undoSoftDelete, { id: expenseId })
      // Second undo should not throw
      await authed.mutation(api.expenses.undoSoftDelete, { id: expenseId })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).not.toBeNull()
    })

    test("double soft delete throws", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })
      await expect(
        authed.mutation(api.expenses.softDelete, { id: expenseId })
      ).rejects.toThrow("already deleted")
    })

    test("permanently delete cascade-deletes reimbursements", async () => {
      const { t, authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 500,
      })

      // Soft delete sets deletedAt
      await authed.mutation(api.expenses.softDelete, { id: expenseId })

      // Get the deletedAt timestamp for the permanentlyDelete call
      const softDeleted = await t.run(async (ctx) => {
        return await ctx.db.get(expenseId)
      })
      expect(softDeleted?.deletedAt).toBeDefined()

      // Run permanent delete directly
      await t.mutation(internal.expenses.permanentlyDelete, {
        id: expenseId,
        expectedDeletedAt: softDeleted!.deletedAt!,
      })

      // Expense should be gone from DB entirely
      const gone = await t.run(async (ctx) => {
        return await ctx.db.get(expenseId)
      })
      expect(gone).toBeNull()
    })

    test("permanently delete no-ops on timestamp mismatch (undo race)", async () => {
      const { t, authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })

      // Undo the soft delete
      await authed.mutation(api.expenses.undoSoftDelete, { id: expenseId })

      // Orphaned permanent delete fires with old timestamp — should no-op
      await t.mutation(internal.expenses.permanentlyDelete, {
        id: expenseId,
        expectedDeletedAt: 12345,
      })

      // Expense should still exist
      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).not.toBeNull()
    })

    test("soft-deleted expenses excluded from getSummary", async () => {
      const { authed } = await createAuthenticatedContext()

      await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 10000,
      })
      const expense2 = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 5000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expense2 })

      const summary = await authed.query(api.expenses.getSummary, {})
      expect(summary.expenseCount).toBe(1)
      expect(summary.totalAmountCents).toBe(10000)
    })

    test("update rejects soft-deleted expense", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })

      await expect(
        authed.mutation(api.expenses.update, {
          id: expenseId,
          provider: "Updated",
        })
      ).rejects.toThrow("Expense not found")
    })

    test("reimbursement rejects soft-deleted expense", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.softDelete, { id: expenseId })

      await expect(
        authed.mutation(api.reimbursements.record, {
          expenseId,
          amountCents: 500,
        })
      ).rejects.toThrow("Expense not found")
    })
  })

  describe("input validation", () => {
    test("create rejects negative amountCents", async () => {
      const { authed } = await createAuthenticatedContext()

      await expect(
        authed.mutation(api.expenses.create, {
          datePaid: "2026-01-15",
          provider: "Dr. Smith",
          amountCents: -100,
        })
      ).rejects.toThrow("positive integer")
    })

    test("create rejects empty provider", async () => {
      const { authed } = await createAuthenticatedContext()

      await expect(
        authed.mutation(api.expenses.create, {
          datePaid: "2026-01-15",
          provider: "",
          amountCents: 1000,
        })
      ).rejects.toThrow("cannot be empty")
    })

    test("create rejects invalid date format", async () => {
      const { authed } = await createAuthenticatedContext()

      await expect(
        authed.mutation(api.expenses.create, {
          datePaid: "01-15-2026",
          provider: "Dr. Smith",
          amountCents: 1000,
        })
      ).rejects.toThrow("YYYY-MM-DD")
    })

    test("createBatch rejects more than MAX_BATCH_SIZE items", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenses = Array.from({ length: 501 }, (_, i) => ({
        datePaid: "2026-01-15",
        provider: `Provider ${i}`,
        amountCents: 1000,
      }))

      await expect(
        authed.mutation(api.expenses.createBatch, { expenses })
      ).rejects.toThrow("Cannot import more than 500")
    })
  })

  describe("summary statistics", () => {
    test("getSummary returns correct totals", async () => {
      const { authed } = await createAuthenticatedContext()

      const expense1 = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 10000,
      })
      await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 5000,
      })

      // Partially reimburse first expense
      await authed.mutation(api.reimbursements.record, {
        expenseId: expense1,
        amountCents: 3000,
      })

      const summary = await authed.query(api.expenses.getSummary, {})
      expect(summary).toMatchObject({
        totalAmountCents: 15000,
        totalReimbursedCents: 3000,
        totalUnreimbursedCents: 12000,
        expenseCount: 2,
        unreimbursedCount: 1,
        partialCount: 1,
        reimbursedCount: 0,
      })
    })
  })
})
