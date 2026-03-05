import { action, mutation, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { api, internal } from "./_generated/api"
import { getOptionalAuth, requireAuth } from "./lib/auth"
import { MAX_OCR_PAGES_PER_MONTH } from "./lib/constants"

// Internal mutation to update OCR status
export const updateOcrStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    ocrStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    ocrError: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, ocrStatus, ocrError }) => {
    await ctx.db.patch(documentId, { ocrStatus, ocrError })
  },
})

// Internal mutation to save OCR results
export const updateOcrResults = internalMutation({
  args: {
    documentId: v.id("documents"),
    ocrExtractedData: v.object({
      amount: v.optional(
        v.object({
          valueCents: v.number(),
          confidence: v.number(),
        })
      ),
      date: v.optional(
        v.object({
          value: v.string(),
          confidence: v.number(),
        })
      ),
      provider: v.optional(
        v.object({
          value: v.string(),
          confidence: v.number(),
        })
      ),
    }),
  },
  handler: async (ctx, { documentId, ocrExtractedData }) => {
    await ctx.db.patch(documentId, {
      ocrStatus: "completed",
      ocrExtractedData,
    })

    // Reset ocrAcknowledged on owning expense when new OCR data has extractable fields.
    // Linear scan over user's expenses is acceptable at personal-tracker scale (~<1000 expenses).
    const { amount, date, provider } = ocrExtractedData
    if (amount || date || provider) {
      const doc = await ctx.db.get(documentId)
      if (doc?.userId) {
        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_user", (q) => q.eq("userId", doc.userId))
          .collect()
        for (const expense of expenses) {
          if (expense.documentIds.includes(documentId) && expense.ocrAcknowledged && expense.deletedAt == null) {
            await ctx.db.patch(expense._id, { ocrAcknowledged: false })
          }
        }
      }
    }
  },
})

// Internal mutation to increment usage counter
export const incrementUsage = internalMutation({
  args: { pages: v.number() },
  handler: async (ctx, { pages }) => {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const existing = await ctx.db
      .query("ocrUsage")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        pagesProcessed: existing.pagesProcessed + pages,
        lastUpdated: Date.now(),
      })
    } else {
      await ctx.db.insert("ocrUsage", {
        yearMonth,
        pagesProcessed: pages,
        lastUpdated: Date.now(),
      })
    }
  },
})

// Query to get current month's usage
export const getCurrentUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuth(ctx)
    if (!userId) {
      return { yearMonth: "", pagesProcessed: 0, estimatedCostCents: 0 }
    }

    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const usage = await ctx.db
      .query("ocrUsage")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
      .first()

    return {
      yearMonth,
      pagesProcessed: usage?.pagesProcessed ?? 0,
      estimatedCostCents: (usage?.pagesProcessed ?? 0) * 1, // $0.01 per page
    }
  },
})

// OCR result type
type OcrResult =
  | { success: true; data: OcrExtractedData }
  | { success: false; error: string }

type OcrExtractedData = {
  amount?: { valueCents: number; confidence: number }
  date?: { value: string; confidence: number }
  provider?: { value: string; confidence: number }
}

// Main OCR action - calls Cloud Run proxy
export const extractExpenseData = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }): Promise<OcrResult> => {
    // 1. Mark as processing
    await ctx.runMutation(internal.ocr.updateOcrStatus, {
      documentId,
      ocrStatus: "processing",
    })

    try {
      // 2. Get document
      const doc = await ctx.runQuery(internal.ocr.getDocumentInternal, {
        id: documentId,
      })
      if (!doc) throw new Error("Document not found")

      const fileUrl: string | null = await ctx.storage.getUrl(doc.storageId)
      if (!fileUrl) throw new Error("File not found in storage")

      // Fetch file content and convert to base64
      const fileResponse: Response = await fetch(fileUrl)
      const fileBuffer: ArrayBuffer = await fileResponse.arrayBuffer()

      // Convert to base64 in chunks to avoid stack overflow with large files
      const bytes = new Uint8Array(fileBuffer)
      const chunkSize = 8192
      let binaryString = ""
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binaryString += String.fromCharCode(...chunk)
      }
      const base64Content: string = btoa(binaryString)

      // 3. Call Cloud Run OCR proxy
      const cloudRunUrl = process.env.CLOUD_RUN_OCR_URL
      const apiSecret = process.env.CLOUD_RUN_API_SECRET

      if (!cloudRunUrl || !apiSecret) {
        throw new Error("Missing Cloud Run configuration")
      }

      const response: Response = await fetch(`${cloudRunUrl}/process`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: base64Content,
          mimeType: doc.mimeType,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        // Log raw error for debugging (visible in Convex dashboard)
        console.error(`OCR proxy error [${response.status}]: ${errorText}`)
        if (response.status >= 500) {
          throw new Error("OCR processing service error")
        }
        throw new Error("OCR processing failed")
      }

      const result = (await response.json()) as {
        success: boolean
        data?: OcrExtractedData
        error?: string
      }

      if (!result.success) {
        throw new Error(result.error || "OCR processing failed")
      }

      // 4. Increment usage counter (1 page per document)
      await ctx.runMutation(internal.ocr.incrementUsage, { pages: 1 })

      // 5. Save results
      await ctx.runMutation(internal.ocr.updateOcrResults, {
        documentId,
        ocrExtractedData: result.data!,
      })

      return { success: true, data: result.data! }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      console.error(`OCR failed for document ${documentId}: ${rawMessage}`)

      // Use sanitized message for user-facing storage
      const isKnownSafe = [
        "OCR processing service error",
        "OCR processing failed",
        "Document not found",
        "File not found in storage",
      ].includes(rawMessage)

      const safeMessage = isKnownSafe ? rawMessage : "OCR failed"

      await ctx.runMutation(internal.ocr.updateOcrStatus, {
        documentId,
        ocrStatus: "failed",
        ocrError: safeMessage,
      })
      return { success: false, error: safeMessage }
    }
  },
})

/** Retry OCR on a skipped or failed document if under monthly cap. */
export const retryDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireAuth(ctx)

    const doc = await ctx.db.get(documentId)
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found")
    }

    if (doc.ocrStatus !== "skipped" && doc.ocrStatus !== "failed") {
      return { retried: false, reason: "not_eligible" }
    }

    // Check monthly cap
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const usage = await ctx.db
      .query("ocrUsage")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
      .first()

    if ((usage?.pagesProcessed ?? 0) >= MAX_OCR_PAGES_PER_MONTH) {
      return { retried: false, reason: "still_over_limit" }
    }

    // Reset status and schedule OCR
    await ctx.db.patch(documentId, { ocrStatus: "pending", ocrError: undefined })
    await ctx.scheduler.runAfter(0, api.ocr.extractExpenseData, { documentId })

    return { retried: true }
  },
})

// Internal query to get document (for action use)
export const getDocumentInternal = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})
