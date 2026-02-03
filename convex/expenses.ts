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
    category: v.optional(v.union(v.string(), v.literal("uncategorized"))),
  },
  handler: async (ctx, args) => {
    // Start with base query
    let expenses

    if (args.status) {
      expenses = await ctx.db
        .query("expenses")
        .withIndex("by_status_and_date", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect()
    } else {
      expenses = await ctx.db.query("expenses").order("desc").collect()
    }

    // Apply category filter client-side (since we can't combine indexes easily)
    if (args.category) {
      if (args.category === "uncategorized") {
        expenses = expenses.filter((e) => !e.category)
      } else {
        expenses = expenses.filter((e) => e.category === args.category)
      }
    }

    return expenses
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
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expenseId = await ctx.db.insert("expenses", {
      datePaid: args.datePaid,
      provider: args.provider,
      amountCents: args.amountCents,
      comment: args.comment,
      category: args.category,
      documentIds: [],
      totalReimbursedCents: 0,
      status: "unreimbursed",
    })
    return expenseId
  },
})

// Create multiple expenses in a single transaction (for CSV import)
export const createBatch = mutation({
  args: {
    expenses: v.array(
      v.object({
        datePaid: v.string(),
        provider: v.string(),
        amountCents: v.number(),
        comment: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = []
    for (const expense of args.expenses) {
      const id = await ctx.db.insert("expenses", {
        datePaid: expense.datePaid,
        provider: expense.provider,
        amountCents: expense.amountCents,
        comment: expense.comment,
        category: expense.category,
        documentIds: [],
        totalReimbursedCents: 0,
        status: "unreimbursed",
      })
      ids.push(id)
    }
    return ids
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
    category: v.optional(v.union(v.string(), v.null())), // Allow null to clear category
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

// Mark OCR as acknowledged (applied or disregarded)
export const acknowledgeOcr = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { ocrAcknowledged: true })
  },
})

// List expenses with OCR status indicator
export const listWithOcrStatus = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("unreimbursed"),
        v.literal("partial"),
        v.literal("reimbursed")
      )
    ),
    category: v.optional(v.union(v.string(), v.literal("uncategorized"))),
  },
  handler: async (ctx, args) => {
    let expenses = args.status
      ? await ctx.db
          .query("expenses")
          .withIndex("by_status_and_date", (q) => q.eq("status", args.status!))
          .order("desc")
          .collect()
      : await ctx.db.query("expenses").order("desc").collect()

    // Apply category filter
    if (args.category) {
      if (args.category === "uncategorized") {
        expenses = expenses.filter((e) => !e.category)
      } else {
        expenses = expenses.filter((e) => e.category === args.category)
      }
    }

    return Promise.all(
      expenses.map(async (expense) => {
        // Skip if already acknowledged or no documents
        if (expense.ocrAcknowledged || expense.documentIds.length === 0) {
          return { ...expense, hasUnacknowledgedOcr: false }
        }

        // Check each document for unacknowledged OCR data
        for (const docId of expense.documentIds) {
          const doc = await ctx.db.get(docId)
          if (doc?.ocrStatus === "completed" && doc.ocrExtractedData) {
            const { amount, date, provider } = doc.ocrExtractedData
            if (amount || date || provider) {
              return { ...expense, hasUnacknowledgedOcr: true }
            }
          }
        }
        return { ...expense, hasUnacknowledgedOcr: false }
      })
    )
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
