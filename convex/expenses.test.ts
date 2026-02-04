import { convexTest } from "convex-test"
import { expect, test, describe, beforeEach } from "vitest"
import { api } from "./_generated/api"
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

    test("delete expense removes it", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "To Delete",
        amountCents: 1000,
      })

      await authed.mutation(api.expenses.remove, { id: expenseId })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toBeNull()
    })

    test("delete expense also removes associated reimbursements", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 500,
      })

      // Verify reimbursement exists
      const reimbursementsBefore = await authed.query(api.reimbursements.getByExpense, {
        expenseId,
      })
      expect(reimbursementsBefore).toHaveLength(1)

      // Delete expense
      await authed.mutation(api.expenses.remove, { id: expenseId })

      // Reimbursements should be gone too (expense is deleted, can't query)
      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toBeNull()
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
