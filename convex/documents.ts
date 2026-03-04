import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { api } from "./_generated/api"
import { requireAuth, getOptionalAuth } from "./lib/auth"
import { ALLOWED_MIME_TYPES, MAX_OCR_PAGES_PER_MONTH } from "./lib/constants"

// Generate an upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

// Save a document after upload
export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    originalFilename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    // Validate MIME type against allowlist
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(args.mimeType)) {
      throw new Error("Unsupported file type")
    }

    // Check OCR monthly usage
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const usage = await ctx.db
      .query("ocrUsage")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
      .first()
    const ocrOverLimit = (usage?.pagesProcessed ?? 0) >= MAX_OCR_PAGES_PER_MONTH

    const documentId = await ctx.db.insert("documents", {
      userId,
      storageId: args.storageId,
      originalFilename: args.originalFilename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      ocrStatus: ocrOverLimit ? "skipped" : "pending",
    })

    if (ocrOverLimit) {
      // Log the capped attempt
      await ctx.db.insert("securityAuditLogs", {
        userId,
        action: "ocr_monthly_cap_exceeded",
        details: JSON.stringify({
          documentId,
          currentUsage: usage?.pagesProcessed ?? 0,
          limit: MAX_OCR_PAGES_PER_MONTH,
          yearMonth,
        }),
        timestamp: Date.now(),
      })
    } else {
      // Trigger OCR processing in the background
      await ctx.scheduler.runAfter(0, api.ocr.extractExpenseData, { documentId })
    }

    return { documentId, ocrScheduled: !ocrOverLimit }
  },
})

// Get a document by ID
// Note: Does NOT return storage URL - use secure HTTP endpoint /api/files/{documentId}
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) return null

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) return null

    return document
  },
})

// Get multiple documents by IDs
// Note: Does NOT return storage URLs - use secure HTTP endpoint /api/files/{documentId}
export const getMany = query({
  args: { ids: v.array(v.id("documents")) },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) return []

    const documents = await Promise.all(
      args.ids.map(async (id) => {
        const doc = await ctx.db.get(id)
        if (!doc || doc.userId !== userId) return null
        return doc
      })
    )
    return documents.filter((doc) => doc !== null)
  },
})

// Delete a document
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    await ctx.storage.delete(document.storageId)
    await ctx.db.delete(args.id)
  },
})

// Add a document to an expense
export const addToExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const expense = await ctx.db.get(args.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found")
    }

    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    const documentIds = [...expense.documentIds, args.documentId]
    await ctx.db.patch(args.expenseId, { documentIds })
  },
})

// Remove a document from an expense
export const removeFromExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const expense = await ctx.db.get(args.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found")
    }

    const documentIds = expense.documentIds.filter((id) => id !== args.documentId)
    await ctx.db.patch(args.expenseId, { documentIds })

    // Also delete the document itself
    const document = await ctx.db.get(args.documentId)
    if (document && document.userId === userId) {
      await ctx.storage.delete(document.storageId)
      await ctx.db.delete(args.documentId)
    }
  },
})
