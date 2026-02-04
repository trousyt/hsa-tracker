import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAuth, getOptionalAuth } from "./lib/auth"

/**
 * Reimbursement Optimizer using Dynamic Programming
 *
 * Algorithm: Subset Sum with minimum items optimization
 * - Time: O(n * target) where n = expenses, target in cents
 * - Space: O(target)
 * - Process expenses oldest-first for FIFO tiebreaker
 * - Use strict < comparison to prefer older items
 */

interface DPEntry {
  count: number
  expenseIndices: number[]
}

export const findOptimal = query({
  args: {
    targetCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
        expenses: [],
        totalCents: 0,
        exactMatch: false,
      }
    }

    if (args.targetCents <= 0) {
      return {
        success: false,
        message: "Target amount must be positive",
        expenses: [],
        totalCents: 0,
        exactMatch: false,
      }
    }

    // Get all unreimbursed and partial expenses for this user, sorted by date (oldest first for FIFO)
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    // Sort by date (oldest first)
    expenses.sort((a, b) => a.datePaid.localeCompare(b.datePaid))

    // Filter to only unreimbursed/partial and get their remaining amounts
    const eligibleExpenses = expenses
      .filter((e) => e.status !== "reimbursed")
      .map((e) => ({
        id: e._id,
        remainingCents: e.amountCents - e.totalReimbursedCents,
        expense: e,
      }))
      .filter((e) => e.remainingCents > 0)

    if (eligibleExpenses.length === 0) {
      return {
        success: false,
        message: "No unreimbursed expenses available",
        expenses: [],
        totalCents: 0,
        exactMatch: false,
      }
    }

    const totalAvailable = eligibleExpenses.reduce(
      (sum, e) => sum + e.remainingCents,
      0
    )

    if (args.targetCents > totalAvailable) {
      return {
        success: false,
        message: `Target exceeds available unreimbursed amount (${formatCentsToDisplay(totalAvailable)} available)`,
        expenses: [],
        totalCents: 0,
        exactMatch: false,
      }
    }

    // Dynamic Programming: dp[amount] = { count, expenseIndices }
    // We want minimum count (fewest expenses) that sums to exactly 'amount'
    const target = args.targetCents
    const dp: (DPEntry | null)[] = new Array(target + 1).fill(null)
    dp[0] = { count: 0, expenseIndices: [] }

    // Process expenses oldest-first (they're already sorted)
    for (let i = 0; i < eligibleExpenses.length; i++) {
      const amount = eligibleExpenses[i].remainingCents

      // Process in reverse to avoid using same expense twice
      for (let j = target; j >= amount; j--) {
        const prev = dp[j - amount]
        if (prev !== null) {
          const newCount = prev.count + 1
          const current = dp[j]

          // Use strict < to prefer solutions with older expenses (processed earlier)
          if (current === null || newCount < current.count) {
            dp[j] = {
              count: newCount,
              expenseIndices: [...prev.expenseIndices, i],
            }
          }
        }
      }
    }

    // Check for exact match
    if (dp[target] !== null) {
      const result = dp[target]!
      const selectedExpenses = result.expenseIndices.map(
        (i) => eligibleExpenses[i].expense
      )

      return {
        success: true,
        message: "Found exact match",
        expenses: selectedExpenses,
        totalCents: target,
        exactMatch: true,
      }
    }

    // No exact match - find closest under target
    let bestAmount = 0
    for (let j = target - 1; j >= 0; j--) {
      if (dp[j] !== null) {
        bestAmount = j
        break
      }
    }

    if (bestAmount === 0) {
      // This shouldn't happen if there are eligible expenses, but handle it
      return {
        success: false,
        message: "Could not find a valid combination",
        expenses: [],
        totalCents: 0,
        exactMatch: false,
      }
    }

    const result = dp[bestAmount]!
    const selectedExpenses = result.expenseIndices.map(
      (i) => eligibleExpenses[i].expense
    )

    return {
      success: true,
      message: `No exact match. Closest amount under target: ${formatCentsToDisplay(bestAmount)}`,
      expenses: selectedExpenses,
      totalCents: bestAmount,
      exactMatch: false,
    }
  },
})

// Helper to format cents for display in messages
function formatCentsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Mutation to apply optimization results - mark selected expenses as reimbursed
export const applyOptimization = mutation({
  args: {
    expenseIds: v.array(v.id("expenses")),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const date = args.date || new Date().toISOString().split("T")[0]

    for (const expenseId of args.expenseIds) {
      const expense = await ctx.db.get(expenseId)
      if (!expense || expense.userId !== userId) continue

      const remainingCents = expense.amountCents - expense.totalReimbursedCents
      if (remainingCents <= 0) continue

      // Create reimbursement record
      await ctx.db.insert("reimbursements", {
        userId,
        expenseId,
        amountCents: remainingCents,
        date,
        notes: args.notes || "Applied via optimizer",
      })

      // Update expense to fully reimbursed
      await ctx.db.patch(expenseId, {
        totalReimbursedCents: expense.amountCents,
        status: "reimbursed",
      })
    }
  },
})
