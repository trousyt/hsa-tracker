import { convexTest } from "convex-test"
import { expect, test, describe } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { modules } from "./test.setup"

// Helper to create an authenticated test context
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

describe("reimbursements", () => {
  describe("partial reimbursement", () => {
    test("record partial reimbursement updates expense status to partial", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 3000,
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense).toMatchObject({
        status: "partial",
        totalReimbursedCents: 3000,
      })
    })

    test("multiple partial reimbursements accumulate", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 3000,
      })
      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 2000,
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(5000)
      expect(expense?.status).toBe("partial")

      const reimbursements = await authed.query(api.reimbursements.getByExpense, {
        expenseId,
      })
      expect(reimbursements).toHaveLength(2)
    })

    test("partial reimbursement reaching full amount changes status to reimbursed", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 6000,
      })
      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 4000,
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(10000)
      expect(expense?.status).toBe("reimbursed")
    })
  })

  describe("full reimbursement", () => {
    test("recordFull reimburses remaining balance", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      // Partial first
      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 3000,
      })

      // Then full
      await authed.mutation(api.reimbursements.recordFull, {
        expenseId,
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(10000)
      expect(expense?.status).toBe("reimbursed")

      const reimbursements = await authed.query(api.reimbursements.getByExpense, {
        expenseId,
      })
      expect(reimbursements).toHaveLength(2)
      // Second reimbursement should be for remaining 7000
      const amounts = reimbursements.map((r) => r.amountCents).sort((a, b) => a - b)
      expect(amounts).toEqual([3000, 7000])
    })

    test("recordFull on unreimbursed expense reimburses full amount", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 5000,
      })

      await authed.mutation(api.reimbursements.recordFull, {
        expenseId,
      })

      const expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(5000)
      expect(expense?.status).toBe("reimbursed")
    })
  })

  describe("undo reimbursement", () => {
    test("undo reimbursement reverts expense status", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      const reimbursementId = await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 10000,
      })

      // Should be fully reimbursed
      let expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.status).toBe("reimbursed")

      // Undo
      await authed.mutation(api.reimbursements.undo, {
        reimbursementId,
      })

      expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.status).toBe("unreimbursed")
      expect(expense?.totalReimbursedCents).toBe(0)
    })

    test("undo partial reimbursement adjusts totals correctly", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 10000,
      })

      await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 5000,
      })
      const secondId = await authed.mutation(api.reimbursements.record, {
        expenseId,
        amountCents: 3000,
      })

      // Should be partial with 8000 reimbursed
      let expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(8000)

      // Undo second reimbursement
      await authed.mutation(api.reimbursements.undo, {
        reimbursementId: secondId,
      })

      expense = await authed.query(api.expenses.get, { id: expenseId })
      expect(expense?.totalReimbursedCents).toBe(5000)
      expect(expense?.status).toBe("partial")
    })
  })

  describe("validation", () => {
    test("rejects reimbursement exceeding remaining balance", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 5000,
      })

      await expect(
        authed.mutation(api.reimbursements.record, {
          expenseId,
          amountCents: 6000,
        })
      ).rejects.toThrow("exceeds remaining balance")
    })

    test("rejects zero or negative reimbursement amount", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 5000,
      })

      await expect(
        authed.mutation(api.reimbursements.record, {
          expenseId,
          amountCents: 0,
        })
      ).rejects.toThrow("must be positive")

      await expect(
        authed.mutation(api.reimbursements.record, {
          expenseId,
          amountCents: -100,
        })
      ).rejects.toThrow("must be positive")
    })

    test("recordFull rejects already fully reimbursed expense", async () => {
      const { authed } = await createAuthenticatedContext()

      const expenseId = await authed.mutation(api.expenses.create, {
        datePaid: "2026-01-15",
        provider: "Provider",
        amountCents: 5000,
      })

      await authed.mutation(api.reimbursements.recordFull, { expenseId })

      await expect(
        authed.mutation(api.reimbursements.recordFull, { expenseId })
      ).rejects.toThrow("already fully reimbursed")
    })
  })
})
