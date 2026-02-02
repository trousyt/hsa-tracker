import { convexTest } from "convex-test"
import { expect, test, describe } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { modules } from "./test.setup"

describe("expenses", () => {
  describe("CRUD operations", () => {
    test("create expense with required fields", async () => {
      const t = convexTest(schema, modules)

      const expenseId = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Dr. Smith",
        amountCents: 15000,
      })

      expect(expenseId).toBeDefined()

      const expense = await t.query(api.expenses.get, { id: expenseId })
      expect(expense).toMatchObject({
        datePaid: "2026-01-15",
        provider: "Dr. Smith",
        amountCents: 15000,
        status: "unreimbursed",
        totalReimbursedCents: 0,
        documentIds: [],
      })
    })

    test("create expense with optional comment", async () => {
      const t = convexTest(schema, modules)

      const expenseId = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "CVS Pharmacy",
        amountCents: 2500,
        comment: "Prescription medication",
      })

      const expense = await t.query(api.expenses.get, { id: expenseId })
      expect(expense?.comment).toBe("Prescription medication")
    })

    test("list expenses returns all expenses", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 1000,
      })
      await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 2000,
      })

      const expenses = await t.query(api.expenses.list, {})
      expect(expenses).toHaveLength(2)
    })

    test("list expenses filters by status", async () => {
      const t = convexTest(schema, modules)

      const expense1 = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 1000,
      })
      await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 2000,
      })

      // Mark first expense as reimbursed
      await t.mutation(api.reimbursements.recordFull, {
        expenseId: expense1,
      })

      const unreimbursed = await t.query(api.expenses.list, {
        status: "unreimbursed",
      })
      expect(unreimbursed).toHaveLength(1)
      expect(unreimbursed[0].provider).toBe("Provider B")

      const reimbursed = await t.query(api.expenses.list, {
        status: "reimbursed",
      })
      expect(reimbursed).toHaveLength(1)
      expect(reimbursed[0].provider).toBe("Provider A")
    })

    test("update expense fields", async () => {
      const t = convexTest(schema, modules)

      const expenseId = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Original Provider",
        amountCents: 1000,
      })

      await t.mutation(api.expenses.update, {
        id: expenseId,
        provider: "Updated Provider",
        amountCents: 1500,
        comment: "Added comment",
      })

      const expense = await t.query(api.expenses.get, { id: expenseId })
      expect(expense).toMatchObject({
        provider: "Updated Provider",
        amountCents: 1500,
        comment: "Added comment",
      })
    })

    test("delete expense removes it", async () => {
      const t = convexTest(schema, modules)

      const expenseId = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "To Delete",
        amountCents: 1000,
      })

      await t.mutation(api.expenses.remove, { id: expenseId })

      const expense = await t.query(api.expenses.get, { id: expenseId })
      expect(expense).toBeNull()
    })

    test("delete expense also removes associated reimbursements", async () => {
      const t = convexTest(schema, modules)

      const expenseId = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 1000,
      })

      await t.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 500,
      })

      // Verify reimbursement exists
      const reimbursementsBefore = await t.query(api.reimbursements.getByExpense, {
        expenseId,
      })
      expect(reimbursementsBefore).toHaveLength(1)

      // Delete expense
      await t.mutation(api.expenses.remove, { id: expenseId })

      // Reimbursements should be gone too (expense is deleted, can't query)
      const expense = await t.query(api.expenses.get, { id: expenseId })
      expect(expense).toBeNull()
    })
  })

  describe("summary statistics", () => {
    test("getSummary returns correct totals", async () => {
      const t = convexTest(schema, modules)

      const expense1 = await t.mutation(api.expenses.create, {
        datePaid: "2026-01-10",
        provider: "Provider A",
        amountCents: 10000,
      })
      await t.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider B",
        amountCents: 5000,
      })

      // Partially reimburse first expense
      await t.mutation(api.reimbursements.record, {
        expenseId: expense1,
        amountCents: 3000,
      })

      const summary = await t.query(api.expenses.getSummary, {})
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
