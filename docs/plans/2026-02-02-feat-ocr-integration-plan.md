---
title: OCR Integration with Google Cloud Document AI
type: feat
date: 2026-02-02
---

# OCR Integration with Google Cloud Document AI

Automatically extract expense data (amount, date, provider) from uploaded receipts using Google Cloud Document AI's Expense Parser.

## Architecture Decision: Cloud Run Proxy

**Why not direct service account keys?**
Organization security policy prohibits downloading service account key files.

**Solution:** Deploy a Cloud Run proxy service that:
- Uses attached service account credentials (no key files)
- Authenticates Convex requests via shared secret
- Calls Document AI and returns parsed results

```
Convex Action → Cloud Run Proxy → Document AI
                     ↑
           Attached service account
           (no key file needed)
```

## Acceptance Criteria

### 1. Google Cloud Setup

- [ ] Create Google Cloud project (or use existing)
- [ ] Enable Document AI API
- [ ] Create Expense Parser processor in Document AI console
- [ ] Deploy Cloud Run proxy service (see `cloud-run-ocr/README.md`)
- [ ] Grant Document AI User role to Cloud Run's service account
- [ ] Generate shared secret and configure both Cloud Run and Convex

**Environment Variables (Convex Dashboard → Settings → Environment Variables):**
```
CLOUD_RUN_OCR_URL=https://ocr-proxy-XXXXX-uc.a.run.app
CLOUD_RUN_API_SECRET=your-shared-secret
```

### 2. Backend OCR Processing

- [x] Create `convex/ocr.ts` with `extractExpenseData` action
- [x] Fetch document from Convex storage
- [x] Call Cloud Run proxy with document content
- [x] Receive parsed results (amount, date, provider)
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

### 6. Usage Tracking

- [x] Add `ocrUsage` table to track pages processed per month
- [x] Increment counter after successful OCR
- [x] Display usage indicator on dashboard

## Simplified Approach (Post-Review)

**Removed from original plan:**
- ~~Confidence badges~~ - Users verify data visually against receipt
- ~~OcrReviewCard component~~ - Just pre-fill the existing form
- ~~ConfidenceBadge component~~ - Not needed
- ~~onIgnore button~~ - Default is simply not using the data
- ~~Side-by-side review layout~~ - Overkill for this use case
- ~~Retry button~~ - User can delete/re-upload if needed
- ~~Frontend OCR triggering~~ - Backend handles it via scheduler
- ~~Direct service account keys~~ - Using Cloud Run proxy instead

**Key principle:** The expense form IS the review UI. Pre-fill it, let user verify and edit.

## Files

**Create:**
| File | Purpose |
|------|---------|
| `convex/ocr.ts` | OCR action that calls Cloud Run proxy |
| `cloud-run-ocr/main.py` | Cloud Run proxy service |
| `cloud-run-ocr/Dockerfile` | Container build |
| `cloud-run-ocr/requirements.txt` | Python dependencies |
| `cloud-run-ocr/README.md` | Deployment instructions |

**Modify:**
| File | Change |
|------|--------|
| `convex/schema.ts` | Add `ocrUsage` table |
| `convex/documents.ts` | Schedule OCR after saveDocument |
| `src/components/dashboard/dashboard.tsx` | Add OCR usage indicator |
| `src/components/expenses/expense-dialog.tsx` | Pass OCR data as defaultValues when available |

## Technical Notes

**Document AI Expense Parser extracts:**
- `total_amount` → `amountCents` (multiply by 100)
- `supplier_name` → `provider`
- `receipt_date` → `datePaid` (ISO format)

**Cost:** ~$0.01 per page (no free tier)

**Security:**
- Cloud Run uses attached service account (no key files)
- Convex authenticates via shared secret in Authorization header
- All traffic over HTTPS

## References

- [Google Cloud Document AI](https://cloud.google.com/document-ai/docs)
- [Expense Parser Overview](https://cloud.google.com/document-ai/docs/processors-list#processor_expense-parser)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/overview)
- Main project plan: `docs/plans/2026-01-30-feat-hsa-expense-tracker-plan.md` (Phase 4)
