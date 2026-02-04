import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireAuth, getOptionalAuth } from "./lib/auth"

export const record = mutation({
  args: {
    expenseId: v.id("expenses"),
    amountCents: v.number(),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const expense = await ctx.db.get(args.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found")
    }

    const date = args.date || new Date().toISOString().split("T")[0]
    const remainingCents = expense.amountCents - expense.totalReimbursedCents

    if (args.amountCents <= 0) {
      throw new Error("Reimbursement amount must be positive")
    }

    if (args.amountCents > remainingCents) {
      throw new Error(
        `Reimbursement amount exceeds remaining balance of ${remainingCents} cents`
      )
    }

    // Create the reimbursement record
    const reimbursementId = await ctx.db.insert("reimbursements", {
      userId,
      expenseId: args.expenseId,
      amountCents: args.amountCents,
      date,
      notes: args.notes,
    })

    // Update the expense totals and status
    const newTotalReimbursed = expense.totalReimbursedCents + args.amountCents
    const newStatus =
      newTotalReimbursed >= expense.amountCents
        ? "reimbursed"
        : newTotalReimbursed > 0
          ? "partial"
          : "unreimbursed"

    await ctx.db.patch(args.expenseId, {
      totalReimbursedCents: newTotalReimbursed,
      status: newStatus,
    })

    return reimbursementId
  },
})

export const recordFull = mutation({
  args: {
    expenseId: v.id("expenses"),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const expense = await ctx.db.get(args.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found")
    }

    const remainingCents = expense.amountCents - expense.totalReimbursedCents
    if (remainingCents <= 0) {
      throw new Error("Expense is already fully reimbursed")
    }

    const date = args.date || new Date().toISOString().split("T")[0]

    // Create the reimbursement record for the remaining amount
    const reimbursementId = await ctx.db.insert("reimbursements", {
      userId,
      expenseId: args.expenseId,
      amountCents: remainingCents,
      date,
      notes: args.notes,
    })

    // Update the expense to fully reimbursed
    await ctx.db.patch(args.expenseId, {
      totalReimbursedCents: expense.amountCents,
      status: "reimbursed",
    })

    return reimbursementId
  },
})

export const undo = mutation({
  args: {
    reimbursementId: v.id("reimbursements"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const reimbursement = await ctx.db.get(args.reimbursementId)
    if (!reimbursement || reimbursement.userId !== userId) {
      throw new Error("Reimbursement not found")
    }

    const expense = await ctx.db.get(reimbursement.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new Error("Associated expense not found")
    }

    // Delete the reimbursement record
    await ctx.db.delete(args.reimbursementId)

    // Update the expense totals and status
    const newTotalReimbursed =
      expense.totalReimbursedCents - reimbursement.amountCents
    const newStatus =
      newTotalReimbursed >= expense.amountCents
        ? "reimbursed"
        : newTotalReimbursed > 0
          ? "partial"
          : "unreimbursed"

    await ctx.db.patch(reimbursement.expenseId, {
      totalReimbursedCents: newTotalReimbursed,
      status: newStatus,
    })
  },
})

export const getByExpense = query({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) return []

    // Verify ownership of the expense first
    const expense = await ctx.db.get(args.expenseId)
    if (!expense || expense.userId !== userId) {
      return []
    }

    const reimbursements = await ctx.db
      .query("reimbursements")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect()

    // Sort by date descending (most recent first)
    return reimbursements.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  },
})
