import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,

  // Override users table to add isOwner and githubId fields
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isOwner: v.optional(v.boolean()),
    githubId: v.optional(v.string()),
  }).index("email", ["email"]),

  expenses: defineTable({
    userId: v.optional(v.string()), // Optional during migration period
    datePaid: v.string(), // ISO date (YYYY-MM-DD)
    provider: v.string(), // Provider/vendor name
    amountCents: v.number(), // Amount in cents (integer)
    comment: v.optional(v.string()),
    category: v.optional(v.union(v.string(), v.null())), // IRS-aligned expense category (optional, null to clear)
    documentIds: v.array(v.id("documents")),
    totalReimbursedCents: v.number(), // Denormalized for queries
    status: v.union(
      v.literal("unreimbursed"),
      v.literal("partial"),
      v.literal("reimbursed")
    ),
    ocrAcknowledged: v.optional(v.boolean()), // True if user has applied or disregarded OCR data
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_date", ["datePaid"])
    .index("by_status_and_date", ["status", "datePaid"])
    .index("by_category", ["category"])
    .index("by_category_and_date", ["category", "datePaid"]),

  documents: defineTable({
    userId: v.optional(v.string()), // Optional during migration period
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
  }).index("by_user", ["userId"]),

  reimbursements: defineTable({
    userId: v.optional(v.string()), // Optional during migration period
    expenseId: v.id("expenses"),
    amountCents: v.number(),
    date: v.string(), // ISO date
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_expense", ["expenseId"]),

  ocrUsage: defineTable({
    yearMonth: v.string(), // "YYYY-MM" format
    pagesProcessed: v.number(),
    lastUpdated: v.number(), // timestamp
  }).index("by_year_month", ["yearMonth"]),

  // Audit log for file access (security compliance)
  fileAccessLogs: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    action: v.union(v.literal("view"), v.literal("download")),
    timestamp: v.number(),
    userAgent: v.optional(v.string()),
    success: v.boolean(),
    errorReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_document", ["documentId"])
    .index("by_timestamp", ["timestamp"]),
})
