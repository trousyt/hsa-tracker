---
title: OCR Integration with Google Cloud Document AI
type: feat
date: 2026-02-02
---

# OCR Integration with Google Cloud Document AI

Automatically extract expense data (amount, date, provider) from uploaded receipts using Google Cloud Document AI's Expense Parser.

## Acceptance Criteria

### 1. Google Cloud Setup

- [ ] Create Google Cloud project (or use existing)
- [ ] Enable Document AI API
- [ ] Create Expense Parser processor in Document AI console
- [ ] Create service account with Document AI User role
- [ ] Download JSON key and add to Convex environment variables

**Environment Variables (Convex Dashboard → Settings → Environment Variables):**
```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us
GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID=your-processor-id
GOOGLE_CLOUD_CREDENTIALS={"type":"service_account",...}
```

### 2. Backend OCR Processing

- [x] Create `convex/ocr.ts` with `extractExpenseData` action
- [x] Add Zod schema to validate Document AI API response
- [x] Fetch document from Convex storage
- [x] Send to Document AI Expense Parser API
- [x] Parse and validate response, extract: amount, date, provider
- [x] Update document record with OCR results
- [x] Handle errors gracefully (update `ocrStatus` to "failed", store `ocrError`)

### 3. Trigger OCR from Backend

- [x] Modify `convex/documents.ts` `saveDocument` mutation
- [x] Use `ctx.scheduler.runAfter(0, ...)` to trigger OCR after upload
- [x] No frontend changes needed - Convex reactivity handles UI updates

### 4. Pre-fill Expense Form

- [ ] When document has `ocrExtractedData`, pass as `defaultValues` to expense form
- [ ] User sees pre-filled fields, edits as needed, saves
- [ ] No separate review UI needed - form IS the review

### 5. Error Handling

- [x] On OCR failure, set `ocrError` field
- [ ] Show toast: "Couldn't extract data automatically. Please enter manually."
- [x] User proceeds with manual entry (existing flow)

## Simplified Approach (Post-Review)

**Removed from original plan:**
- ~~Confidence badges~~ - Users verify data visually against receipt
- ~~OcrReviewCard component~~ - Just pre-fill the existing form
- ~~ConfidenceBadge component~~ - Not needed
- ~~onIgnore button~~ - Default is simply not using the data
- ~~Side-by-side review layout~~ - Overkill for this use case
- ~~Retry button~~ - User can delete/re-upload if needed
- ~~Frontend OCR triggering~~ - Backend handles it via scheduler

**Key principle:** The expense form IS the review UI. Pre-fill it, let user verify and edit.

## Files

**Create:**
| File | Purpose |
|------|---------|
| `convex/ocr.ts` | Document AI integration action + Zod validation |

**Modify:**
| File | Change |
|------|--------|
| `convex/documents.ts` | Schedule OCR after saveDocument |
| `src/components/expenses/expense-dialog.tsx` | Pass OCR data as defaultValues when available |

**NOT creating (simplified away):**
- ~~`src/components/ocr/ocr-review-card.tsx`~~
- ~~`src/components/ocr/confidence-badge.tsx`~~

## Implementation

### convex/ocr.ts

```typescript
import { action } from "./_generated/server"
import { v } from "convex/values"
import { api } from "./_generated/api"
import { z } from "zod"

// Validate Document AI response structure
const DocumentAiEntitySchema = z.object({
  type: z.string(),
  mentionText: z.string().optional(),
  normalizedValue: z.object({
    text: z.string().optional(),
    moneyValue: z.object({
      currencyCode: z.string().optional(),
      units: z.string().optional(),
      nanos: z.number().optional(),
    }).optional(),
    dateValue: z.object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
    }).optional(),
  }).optional(),
  confidence: z.number(),
})

const DocumentAiResponseSchema = z.object({
  document: z.object({
    entities: z.array(DocumentAiEntitySchema).optional(),
  }),
})

export const extractExpenseData = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    // 1. Mark as processing
    await ctx.runMutation(api.documents.updateOcrStatus, {
      id: documentId,
      ocrStatus: "processing",
    })

    try {
      // 2. Get document and fetch content
      const doc = await ctx.runQuery(api.documents.get, { id: documentId })
      if (!doc) throw new Error("Document not found")

      const fileUrl = await ctx.storage.getUrl(doc.storageId)
      if (!fileUrl) throw new Error("File not found in storage")

      const fileResponse = await fetch(fileUrl)
      const fileBuffer = await fileResponse.arrayBuffer()
      const base64Content = Buffer.from(fileBuffer).toString("base64")

      // 3. Call Document AI
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
      const location = process.env.GOOGLE_CLOUD_LOCATION || "us"
      const processorId = process.env.GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID
      const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || "{}")

      // Get access token (simplified - in production use proper auth)
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
        throw new Error(`Document AI error: ${response.status}`)
      }

      const rawResult = await response.json()

      // 4. Validate and parse response
      const validated = DocumentAiResponseSchema.parse(rawResult)
      const extractedData = parseEntities(validated.document.entities || [])

      // 5. Save results
      await ctx.runMutation(api.documents.updateOcrResults, {
        id: documentId,
        ocrStatus: "completed",
        ocrExtractedData: extractedData,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "OCR failed"
      await ctx.runMutation(api.documents.updateOcrStatus, {
        id: documentId,
        ocrStatus: "failed",
        ocrError: errorMessage,
      })
    }
  },
})

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
```

### convex/documents.ts changes

```typescript
// In saveDocument mutation, after inserting document:
await ctx.scheduler.runAfter(0, api.ocr.extractExpenseData, { documentId })
```

## Technical Notes

**Document AI Expense Parser extracts:**
- `total_amount` → `amountCents` (multiply by 100)
- `supplier_name` → `provider`
- `receipt_date` → `datePaid` (ISO format)

**Cost:** ~$0.01 per page, 1000 pages/month free tier

## References

- [Google Cloud Document AI](https://cloud.google.com/document-ai/docs)
- [Expense Parser Overview](https://cloud.google.com/document-ai/docs/processors-list#processor_expense-parser)
- Main project plan: `docs/plans/2026-01-30-feat-hsa-expense-tracker-plan.md` (Phase 4)
