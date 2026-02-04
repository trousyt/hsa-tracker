import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

/**
 * Internal query to get a document for file access.
 * Verifies ownership before returning document data.
 */
export const getDocumentForAccess = internalQuery({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, { documentId, userId }) => {
    const document = await ctx.db.get(documentId)

    // Return null if document doesn't exist or user doesn't own it
    if (!document || document.userId !== userId) {
      return null
    }

    // Return only the fields needed for file serving
    return {
      storageId: document.storageId,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    }
  },
})

/**
 * Internal mutation to log file access attempts.
 * Used for audit compliance and security monitoring.
 */
export const logAccess = internalMutation({
  args: {
    documentId: v.id("documents"),
    action: v.union(v.literal("view"), v.literal("download")),
    success: v.boolean(),
    errorReason: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("fileAccessLogs", {
      userId: args.userId ?? "anonymous",
      documentId: args.documentId,
      action: args.action,
      timestamp: Date.now(),
      userAgent: args.userAgent,
      success: args.success,
      errorReason: args.errorReason,
    })
  },
})

/**
 * Internal query to get recent access logs for a document.
 * Useful for security auditing.
 */
export const getAccessLogs = internalQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, limit = 100 }) => {
    const logs = await ctx.db
      .query("fileAccessLogs")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .order("desc")
      .take(limit)

    return logs
  },
})
