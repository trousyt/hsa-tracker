import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Generate an upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
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
    const documentId = await ctx.db.insert("documents", {
      storageId: args.storageId,
      originalFilename: args.originalFilename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      ocrStatus: "pending",
    })
    return documentId
  },
})

// Get a document by ID
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.id)
    if (!document) return null

    const url = await ctx.storage.getUrl(document.storageId)
    return { ...document, url }
  },
})

// Get multiple documents by IDs
export const getMany = query({
  args: { ids: v.array(v.id("documents")) },
  handler: async (ctx, args) => {
    const documents = await Promise.all(
      args.ids.map(async (id) => {
        const doc = await ctx.db.get(id)
        if (!doc) return null
        const url = await ctx.storage.getUrl(doc.storageId)
        return { ...doc, url }
      })
    )
    return documents.filter((doc) => doc !== null)
  },
})

// Delete a document
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.id)
    if (document) {
      await ctx.storage.delete(document.storageId)
      await ctx.db.delete(args.id)
    }
  },
})

// Add a document to an expense
export const addToExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId)
    if (!expense) throw new Error("Expense not found")

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
    const expense = await ctx.db.get(args.expenseId)
    if (!expense) throw new Error("Expense not found")

    const documentIds = expense.documentIds.filter((id) => id !== args.documentId)
    await ctx.db.patch(args.expenseId, { documentIds })

    // Also delete the document itself
    const document = await ctx.db.get(args.documentId)
    if (document) {
      await ctx.storage.delete(document.storageId)
      await ctx.db.delete(args.documentId)
    }
  },
})
