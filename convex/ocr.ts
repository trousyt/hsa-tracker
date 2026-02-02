import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { z } from "zod"

// Validate Document AI response structure
const DocumentAiEntitySchema = z.object({
  type: z.string(),
  mentionText: z.string().optional(),
  normalizedValue: z
    .object({
      text: z.string().optional(),
      moneyValue: z
        .object({
          currencyCode: z.string().optional(),
          units: z.string().optional(),
          nanos: z.number().optional(),
        })
        .optional(),
      dateValue: z
        .object({
          year: z.number(),
          month: z.number(),
          day: z.number(),
        })
        .optional(),
    })
    .optional(),
  confidence: z.number(),
})

const DocumentAiResponseSchema = z.object({
  document: z.object({
    entities: z.array(DocumentAiEntitySchema).optional(),
  }),
})

// Get access token from service account credentials
async function getAccessToken(credentials: {
  client_email: string
  private_key: string
  token_uri: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: credentials.token_uri,
    exp: now + 3600,
    iat: now,
  }

  // Create JWT
  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const claimB64 = btoa(JSON.stringify(claim))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const signatureInput = `${headerB64}.${claimB64}`

  // Import private key and sign
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "")
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  )
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const jwt = `${signatureInput}.${signatureB64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.status}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

function parseEntities(entities: z.infer<typeof DocumentAiEntitySchema>[]) {
  const result: {
    amount?: { valueCents: number; confidence: number }
    date?: { value: string; confidence: number }
    provider?: { value: string; confidence: number }
  } = {}

  for (const entity of entities) {
    if (entity.type === "total_amount" && entity.normalizedValue?.moneyValue) {
      const money = entity.normalizedValue.moneyValue
      const dollars = parseFloat(money.units || "0") + (money.nanos || 0) / 1e9
      result.amount = {
        valueCents: Math.round(dollars * 100),
        confidence: entity.confidence,
      }
    }
    if (entity.type === "receipt_date" && entity.normalizedValue?.dateValue) {
      const d = entity.normalizedValue.dateValue
      result.date = {
        value: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
        confidence: entity.confidence,
      }
    }
    if (entity.type === "supplier_name" && entity.mentionText) {
      result.provider = {
        value: entity.mentionText.trim(),
        confidence: entity.confidence,
      }
    }
  }

  return result
}

// Internal mutation to update OCR status
export const updateOcrStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    ocrStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
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

// Main OCR action
export const extractExpenseData = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
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

      const fileUrl = await ctx.storage.getUrl(doc.storageId)
      if (!fileUrl) throw new Error("File not found in storage")

      // Fetch file content
      const fileResponse = await fetch(fileUrl)
      const fileBuffer = await fileResponse.arrayBuffer()
      const base64Content = btoa(
        String.fromCharCode(...new Uint8Array(fileBuffer))
      )

      // 3. Call Document AI
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
      const location = process.env.GOOGLE_CLOUD_LOCATION || "us"
      const processorId = process.env.GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID
      const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS

      if (!projectId || !processorId || !credentialsJson) {
        throw new Error("Missing Google Cloud configuration")
      }

      const credentials = JSON.parse(credentialsJson)
      const accessToken = await getAccessToken(credentials)

      const response = await fetch(
        `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rawDocument: {
              content: base64Content,
              mimeType: doc.mimeType,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Document AI error: ${response.status} - ${errorText}`)
      }

      const rawResult = await response.json()

      // 4. Validate and parse response
      const validated = DocumentAiResponseSchema.parse(rawResult)
      const extractedData = parseEntities(validated.document.entities || [])

      // 5. Increment usage counter (1 page per document)
      await ctx.runMutation(internal.ocr.incrementUsage, { pages: 1 })

      // 6. Save results
      await ctx.runMutation(internal.ocr.updateOcrResults, {
        documentId,
        ocrExtractedData: extractedData,
      })

      return { success: true, data: extractedData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "OCR failed"
      await ctx.runMutation(internal.ocr.updateOcrStatus, {
        documentId,
        ocrStatus: "failed",
        ocrError: errorMessage,
      })
      return { success: false, error: errorMessage }
    }
  },
})

// Internal query to get document (for action use)
export const getDocumentInternal = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})
