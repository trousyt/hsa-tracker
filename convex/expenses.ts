import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// List all expenses, sorted by date descending
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("unreimbursed"),
        v.literal("partial"),
        v.literal("reimbursed")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("expenses")
        .withIndex("by_status_and_date", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect()
    }
    return await ctx.db.query("expenses").order("desc").collect()
  },
})

// Get a single expense by ID
export const get = query({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create a new expense
export const create = mutation({
  args: {
    datePaid: v.string(),
    provider: v.string(),
    amountCents: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expenseId = await ctx.db.insert("expenses", {
      datePaid: args.datePaid,
      provider: args.provider,
      amountCents: args.amountCents,
      comment: args.comment,
      documentIds: [],
      totalReimbursedCents: 0,
      status: "unreimbursed",
    })
    return expenseId
  },
})

// Update an expense
export const update = mutation({
  args: {
    id: v.id("expenses"),
    datePaid: v.optional(v.string()),
    provider: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value
      }
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, filteredUpdates)
    }

    return id
  },
})

// Delete an expense
export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    // First delete associated reimbursements
    const reimbursements = await ctx.db
      .query("reimbursements")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.id))
      .collect()

    for (const reimbursement of reimbursements) {
      await ctx.db.delete(reimbursement._id)
    }

    // Delete the expense
    await ctx.db.delete(args.id)
  },
})

// Get summary statistics
export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db.query("expenses").collect()

    let totalAmountCents = 0
    let totalReimbursedCents = 0
    let unreimbursedCount = 0
    let partialCount = 0
    let reimbursedCount = 0

    for (const expense of expenses) {
      totalAmountCents += expense.amountCents
      totalReimbursedCents += expense.totalReimbursedCents

      if (expense.status === "unreimbursed") unreimbursedCount++
      else if (expense.status === "partial") partialCount++
      else if (expense.status === "reimbursed") reimbursedCount++
    }

    return {
      totalAmountCents,
      totalReimbursedCents,
      totalUnreimbursedCents: totalAmountCents - totalReimbursedCents,
      expenseCount: expenses.length,
      unreimbursedCount,
      partialCount,
      reimbursedCount,
    }
  },
})
