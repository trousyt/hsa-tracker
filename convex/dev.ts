import { internalMutation } from "./_generated/server"
import { api } from "./_generated/api"

// Clear all data - DEVELOPMENT ONLY
// Run with: bunx convex run dev:clearAllData
export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete reimbursements first (references expenses)
    const reimbursements = await ctx.db.query("reimbursements").collect()
    for (const r of reimbursements) {
      await ctx.db.delete(r._id)
    }

    // Delete documents and their storage files
    const documents = await ctx.db.query("documents").collect()
    for (const doc of documents) {
      await ctx.storage.delete(doc.storageId)
      await ctx.db.delete(doc._id)
    }

    // Delete expenses
    const expenses = await ctx.db.query("expenses").collect()
    for (const e of expenses) {
      await ctx.db.delete(e._id)
    }

    // Note: ocrUsage is preserved (tracks monthly API usage)

    return {
      deleted: {
        reimbursements: reimbursements.length,
        documents: documents.length,
        expenses: expenses.length,
      },
    }
  },
})

// Retry OCR on all failed documents
// Run with: bunx convex run dev:retryFailedOcr
export const retryFailedOcr = internalMutation({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("documents").collect()
    const failed = documents.filter((d) => d.ocrStatus === "failed")

    for (const doc of failed) {
      await ctx.scheduler.runAfter(0, api.ocr.extractExpenseData, {
        documentId: doc._id,
      })
    }

    return { scheduled: failed.length }
  },
})
