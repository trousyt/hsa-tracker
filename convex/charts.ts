import { query } from "./_generated/server"
import { getOptionalAuth } from "./lib/auth"

/**
 * Get aggregated chart data for the dashboard.
 *
 * Returns monthly spending totals and per-expense compounding data
 * in a single query to avoid N+1 round-trips.
 */
export const getChartData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) {
      return { monthlySpending: [], compoundingData: [] }
    }

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    // Aggregate monthly spending
    const monthMap = new Map<
      string,
      { totalCents: number; expenseCount: number }
    >()
    for (const expense of expenses) {
      const month = expense.datePaid.slice(0, 7) // "YYYY-MM"
      const entry = monthMap.get(month) ?? { totalCents: 0, expenseCount: 0 }
      entry.totalCents += expense.amountCents
      entry.expenseCount += 1
      monthMap.set(month, entry)
    }

    const monthlySpending = [...monthMap.entries()]
      .map(([month, data]) => ({
        month,
        totalCents: data.totalCents,
        expenseCount: data.expenseCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Get all reimbursements for the user in a single query
    const allReimbursements = await ctx.db
      .query("reimbursements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    // Group reimbursements by expense ID
    const reimbsByExpense = new Map<
      string,
      Array<{ date: string; amountCents: number }>
    >()
    for (const reimb of allReimbursements) {
      const expenseId = reimb.expenseId as unknown as string
      const list = reimbsByExpense.get(expenseId) ?? []
      list.push({ date: reimb.date, amountCents: reimb.amountCents })
      reimbsByExpense.set(expenseId, list)
    }

    // Build compounding data for each expense
    const compoundingData = expenses.map((expense) => {
      const expenseId = expense._id as unknown as string
      return {
        expenseId: expense._id,
        datePaid: expense.datePaid,
        amountCents: expense.amountCents,
        reimbursements: reimbsByExpense.get(expenseId) ?? [],
      }
    })

    return { monthlySpending, compoundingData }
  },
})
