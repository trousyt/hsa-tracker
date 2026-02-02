import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  expenses: defineTable({
    datePaid: v.string(), // ISO date (YYYY-MM-DD)
    provider: v.string(), // Provider/vendor name
    amountCents: v.number(), // Amount in cents (integer)
    comment: v.optional(v.string()),
    documentIds: v.array(v.id("documents")),
    totalReimbursedCents: v.number(), // Denormalized for queries
    status: v.union(
      v.literal("unreimbursed"),
      v.literal("partial"),
      v.literal("reimbursed")
    ),
    ocrAcknowledged: v.optional(v.boolean()), // True if user has applied or disregarded OCR data
  })
    .index("by_status", ["status"])
    .index("by_date", ["datePaid"])
    .index("by_status_and_date", ["status", "datePaid"]),

  documents: defineTable({
    storageId: v.id("_storage"),
    originalFilename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    ocrStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    ocrConfidence: v.optional(v.number()),
    ocrExtractedData: v.optional(
      v.object({
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
      })
    ),
    ocrError: v.optional(v.string()),
  }),

  reimbursements: defineTable({
    expenseId: v.id("expenses"),
    amountCents: v.number(),
    date: v.string(), // ISO date
    notes: v.optional(v.string()),
  }).index("by_expense", ["expenseId"]),

  ocrUsage: defineTable({
    yearMonth: v.string(), // "YYYY-MM" format
    pagesProcessed: v.number(),
    lastUpdated: v.number(), // timestamp
  }).index("by_year_month", ["yearMonth"]),
})
