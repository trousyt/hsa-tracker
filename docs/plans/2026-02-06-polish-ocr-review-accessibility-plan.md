---
title: "polish: OCR Review Accessibility & UX"
type: polish
date: 2026-02-06
deepened: 2026-02-06
status: implemented
reviewers: [frontend-design, accessibility, currency-input, split-panel-dialog, best-confidence-ocr, learnings]
---

# polish: OCR Review Accessibility & UX

## Enhancement Summary

**Deepened on:** 2026-02-06
**Reviewers used:** Frontend Design Skill, WCAG Accessibility, Currency Input Patterns, Split-Panel Dialog UX, Best-Confidence OCR UX, Form Sync Learning, Blob/CORS Learning, React Hooks Learning

### Key Improvements
1. **Two-panel dialog layout** — Inline PDF preview beside the form for side-by-side OCR comparison
2. **Best-confidence OCR aggregation** — When multiple documents have OCR data, pick the highest-confidence value per field
3. **Formatted currency input** — Amount always displays with 2 decimal places using format-on-blur pattern
4. **Accessibility fixes** — Missing labels, aria-hidden decorators, visible focus rings

### New Considerations Discovered
- Two-panel layout must collapse to single-column on mobile (< 768px)
- Reuse existing `DocumentViewer` blob URL pattern for inline PDF via `<iframe>` — no new library needed
- Currency input should use `type="text"` with `inputMode="decimal"` (not `type="number"`) for proper formatting control
- OCR confidence scores already exist per-field — aggregate across documents by picking highest confidence per field
- From learnings: form edit dialog field sync issues can occur when `defaultValues` change — use `form.reset()` carefully

---

## Overview

Polish the OCR review feature with accessibility fixes, UX improvements to the edit dialog layout, best-confidence OCR aggregation across multiple documents, and consistent currency formatting.

## Problem Statement / Motivation

Browser testing of the OCR review feature revealed:
1. Several accessibility gaps (missing labels, weak focus indicators, noisy screen reader output)
2. The edit dialog requires clicking a tiny thumbnail to view the receipt — no side-by-side comparison
3. When an expense has multiple documents with OCR data, only the first document's values are used — it should pick the highest-confidence value per field
4. Amount input shows raw numbers ("12") instead of formatted currency ("12.00")

## Testing Performed

Tested the ClaudeTest expense ($12.00, Feb 5, 2026) with OCR data (TPIRC MEDICAL FOUNDATION, $44.54, Jan 28, 2026) using Chrome browser automation. Inspected design, implementation, and accessibility using screenshots, accessibility tree inspection, JavaScript DOM queries, and keyboard navigation.

### What's Working Well

- **Toggle functionality**: All three field toggles (Date, Provider, Amount) correctly switch between OCR and original values
- **Form state**: Values update synchronously in form fields when toggling
- **Accessibility live regions**: `role="status"` + `aria-live="polite"` properly announces changes to screen readers
- **Dynamic aria-labels**: Toggle button labels update correctly (e.g., "Use original value for Date" <-> "Use OCR value for Date")
- **Keyboard support**: Tab navigation reaches toggle buttons; Enter key activates them
- **Cancel behavior**: Canceling the edit dialog correctly discards all changes
- **Edit dialog thumbnail**: `DocumentThumbnail` component has proper `aria-label`
- **OCR banner**: Clean design with sparkles icon, clear "Disregard" and "Apply Data" actions
- **Document viewer**: PDF viewer opens correctly from thumbnail click
- **Touch target size**: Toggle buttons have `min-h-[44px]` for adequate touch targets

---

## Proposed Changes

### 1. Document Gallery Thumbnail - Missing Accessible Name

**File**: `src/components/documents/document-gallery.tsx:126-137`
**Severity**: High (WCAG 4.1.2 Name, Role, Value)
**Issue**: The `<button>` that opens the document viewer has no `aria-label`, no text content, and no accessible name. Screen readers announce it simply as "button" with no indication of purpose.
**Fix**: Add `aria-label={`View document: ${doc.originalFilename}`}` to the button element.

### 2. Document Gallery Delete Button - Uses `title` Instead of `aria-label`

**File**: `src/components/documents/document-gallery.tsx:154-162`
**Severity**: Medium (WCAG 4.1.2)
**Issue**: The delete button only has `title="Delete"` which is not reliably announced by all screen readers. It also lacks context about which document is being deleted.
**Fix**: Add `aria-label={`Delete ${doc.originalFilename}`}` to the Button element.

### 3. Separator Dots Missing `aria-hidden`

**File**: `src/components/expenses/expense-form.tsx` (lines ~204, ~250, ~303)
**Severity**: Low (WCAG 1.3.1 Info and Relationships)
**Issue**: The decorative separator dot (`·`) between the "Was:" text and "Use original" button lacks `aria-hidden="true"`. Screen readers announce it as "middle dot" which is noise.
**Fix**: Add `aria-hidden="true"` to the `<span className="text-border">` elements containing the dot.

### 4. Toggle Buttons - Weak Focus Indicator

**File**: `src/components/expenses/expense-form.tsx` (toggle button classes)
**Severity**: Low-Medium (WCAG 2.4.7 Focus Visible)
**Issue**: Toggle buttons use `focus:outline-none focus-visible:text-foreground` which only changes text color on keyboard focus. No visible ring or outline. The underline + color change may not provide sufficient contrast for all users.
**Fix**: Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` or similar visible ring to the button className.

#### Research Insights: Focus Indicators

**Best Practices (WCAG 2.2):**
- WCAG 2.4.11 (Focus Appearance) recommends a 2px solid outline with at least 3:1 contrast ratio against adjacent colors
- For inline text-like buttons, a ring around the text area is preferred over just a color change
- `rounded-sm` constrains the ring tightly to the text, avoiding an oversized highlight area

---

### 5. Edit Dialog Layout - PDF Preview Should Be Inline

**File**: `src/components/expenses/expense-dialog.tsx`
**Severity**: UX Polish
**Issue**: When editing with OCR data, the user must click the small thumbnail to open the PDF in a separate viewer. This breaks the review workflow since the user needs to compare receipt values against form fields side-by-side.
**Fix**: Redesign the edit dialog to a two-panel layout when OCR data is present: PDF preview on the left, form fields on the right. The document should be visible without requiring an extra click.

#### Research Insights: Split-Panel Dialog Layout

**Layout Pattern:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Edit Expense                                                     ✕  │
├─────────────────────────────┬────────────────────────────────────────┤
│                             │ ✨ Values pre-filled from receipt...  │
│                             │                                        │
│    [PDF Preview Panel]      │  Date Paid: [January 28th, 2026    📅] │
│    <iframe> or embed        │  Was: February 5th, 2026 · Use original│
│                             │                                        │
│    Scrollable, fills        │  Provider: [TPIRC MEDICAL FOUNDATION ] │
│    available height         │  Was: "ClaudeTest" · Use original      │
│                             │                                        │
│                             │  Amount ($): [44.54                  ] │
│                             │  Was: $12.00 · Use original            │
│                             │                                        │
│                             │            [Cancel]  [Save Expense]    │
├─────────────────────────────┴────────────────────────────────────────┤
└──────────────────────────────────────────────────────────────────────┘
```

**Implementation Approach:**
- Use `DialogContent` with `className="sm:max-w-5xl"` for wider dialog when document is attached
- `flex flex-col md:flex-row` layout with `md:w-3/5` (preview) and `md:w-2/5` (form)
- Left panel: Embed PDF via `<iframe src={blobUrl} />` using existing `useSecureFileUrl` hook and blob URL cleanup pattern
- Right panel: Existing form (scrollable with `overflow-y-auto max-h-[70vh]`)
- Non-OCR edits keep the current `sm:max-w-[425px]` single-column dialog (no regression)

**Responsive Behavior:**
- **Desktop (>= 768px)**: Side-by-side, 60/40 split (preview gets more space — form only has 5 fields)
- **Mobile (< 768px)**: Stack vertically — PDF preview on top (`h-[40vh]` cap), form below
- Use Tailwind's `md:` breakpoint prefix for the layout transition

**PDF Embedding (no new dependencies):**
- Use `<iframe src={blobUrl} className="w-full h-full" />` for PDF rendering
- Reuse the existing `useSecureFileUrl` hook and blob cleanup pattern from `DocumentViewer`
- The blob URL is already created for PDFs in the existing viewer — extract that logic into a shared hook or component
- For images, render `<img>` directly instead of iframe
- Add loading spinner while blob URL is being fetched

**Blob URL Lifecycle (from learnings):**
- Follow the existing `DocumentViewer` pattern: track URL in a ref, revoke on unmount/document change
- Keep the `cancelled` flag pattern to prevent setting state on unmounted components
- Important: Revoke URL even if component unmounts during fetch (track URL before checking cancelled)

**Accessibility for Split-Panel:**
- Both panels use `role="region"` with `aria-label` for screen reader navigation context
- Left panel: `<div role="region" aria-label="Document preview">`
- Right panel: `<div role="region" aria-label="Expense details form">`
- Add a visually-hidden skip link before the preview panel: "Skip to expense form" (PDF iframe can trap keyboard focus)
- Direct initial focus to the first form field via `onOpenAutoFocus` — the preview is reference-only, not the primary interaction
- On mobile stacked view, screen readers encounter preview first, then form (logical reading order)

**Edge Cases:**
- No document attached → show standard single-column layout
- Image document (not PDF) → render `<img>` in left panel instead of iframe
- Document still loading → show skeleton/spinner in left panel, form still usable
- Very long PDF → iframe handles its own scrolling

---

### 6. OCR Should Use Highest-Confidence Values Across All Documents

**Files**: `src/components/expenses/expense-detail.tsx`, `src/components/expenses/expense-dialog.tsx`
**Severity**: UX / Data Quality
**Issue**: When an expense has multiple documents with OCR data, the current code takes the first document that has completed OCR (`for (const doc of documents) ... return doc`). This ignores potentially better data from other documents. Each OCR field (amount, date, provider) already has a per-field `confidence` score (0-1), so we should pick the highest-confidence value per field across all documents.
**Fix**: Aggregate OCR data across all documents, selecting the highest-confidence value for each field independently.

#### Current Behavior

In `expense-detail.tsx` (lines 55-68):
```ts
// Finds the FIRST document with OCR data and returns it
for (const doc of documents) {
  if (doc?.ocrStatus === "completed" && doc.ocrExtractedData) {
    const { amount, date, provider } = doc.ocrExtractedData
    if (amount || date || provider) {
      return doc  // ← stops at first match, ignores others
    }
  }
}
```

#### Proposed Behavior

```ts
// Aggregate: pick highest-confidence value per field across all documents
function getBestOcrData(documents: Document[]): OcrExtractedData | null {
  let bestAmount: { valueCents: number; confidence: number } | undefined
  let bestDate: { value: string; confidence: number } | undefined
  let bestProvider: { value: string; confidence: number } | undefined

  for (const doc of documents) {
    if (doc?.ocrStatus !== "completed" || !doc.ocrExtractedData) continue
    const { amount, date, provider } = doc.ocrExtractedData

    if (amount && (!bestAmount || amount.confidence > bestAmount.confidence)) {
      bestAmount = amount
    }
    if (date && (!bestDate || date.confidence > bestDate.confidence)) {
      bestDate = date
    }
    if (provider && (!bestProvider || provider.confidence > bestProvider.confidence)) {
      bestProvider = provider
    }
  }

  if (!bestAmount && !bestDate && !bestProvider) return null
  return { amount: bestAmount, date: bestDate, provider: bestProvider }
}
```

#### Implementation Approach

- Extract a `getBestOcrData(documents)` utility function (could live in `src/lib/ocr.ts` or inline in the components)
- Replace the `ocrDocumentWithData` logic in `expense-detail.tsx` with `getBestOcrData(documents)`
- Replace the similar first-document logic in `expense-dialog.tsx` (the `uploadedDocument` OCR handling)
- The backend `expenses.ts` (line 250-257) also uses first-match for `hasUnacknowledgedOcr` — this stays as-is (just needs to know if *any* OCR exists, not which is best)
- No schema changes needed — `ocrAcknowledged` stays as a single boolean on the expense since acknowledgment is expense-level

#### PDF Preview in Two-Panel Layout

With best-confidence aggregation, the left panel PDF preview should show the document that contributed the most fields (or the first document with any OCR data). This gives the user visual context for the values shown.

#### Edge Cases
- All documents have the same confidence for a field → first one wins (stable sort)
- One document has amount, another has date → fields come from different documents (this is the main benefit)
- Document deleted after OCR → confidence values from that document are no longer in the set
- Single document → behaves identically to current code

---

### 7. Amount Input Should Format as Currency (0.00)

**File**: `src/components/expenses/expense-form.tsx`
**Severity**: UX Polish
**Issue**: The amount field displays raw numbers (e.g., "12" instead of "12.00"). When toggling to original, it shows "12" rather than "12.00". This is inconsistent with the formatted "$12.00" shown in the diff indicator.
**Fix**: Ensure the amount input always displays with at least one dollar digit and two decimal places (e.g., "0.00", "12.00", "44.54").

#### Research Insights: Currency Input Formatting

**Recommended Pattern — Format on Blur:**
- Use `type="text"` with `inputMode="decimal"` (not `type="number"`)
- `type="number"` strips trailing zeros ("12.00" → "12") and doesn't allow formatting control
- `inputMode="decimal"` brings up numeric keyboard on mobile while allowing text formatting
- Format to 2 decimal places on blur, allow free typing during editing

**Implementation Approach:**
```tsx
// In expense-form.tsx, replace the amount FormField render:
const [displayAmount, setDisplayAmount] = useState("")

// Sync from form value → display
useEffect(() => {
  const val = form.getValues("amount")
  if (val !== undefined && val !== null) {
    setDisplayAmount(Number(val).toFixed(2))
  }
}, [form.watch("amount")])

// On blur: format to 2 decimal places and update form
const handleAmountBlur = () => {
  const parsed = parseFloat(displayAmount)
  if (!isNaN(parsed)) {
    const formatted = parsed.toFixed(2)
    setDisplayAmount(formatted)
    form.setValue("amount", parsed, { shouldValidate: true, shouldDirty: true })
  }
}

// On change: allow free typing
const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setDisplayAmount(e.target.value)
}
```

**Edge Cases:**
- Empty input → leave empty (validation will catch it)
- Non-numeric input → `parseFloat` returns NaN → don't update form value, show validation error
- Very large numbers → consider `Intl.NumberFormat` for thousands separators (future enhancement)
- Floating point: `toFixed(2)` is safe for currency display since we store as integer cents internally
- When toggling OCR values via `selectSource`, also format the new value: `centsToDollars(cents).toFixed(2)`

**Accessibility:**
- Add `aria-describedby` pointing to a helper text element: "Enter amount in dollars (e.g., 25.50)"
- Use `pattern="[0-9]*\.?[0-9]{0,2}"` for basic input validation hint

---

## OCR Data CRUD Audit

Full traceability of every file that touches OCR data and whether it needs changes.

### CREATE (OCR data generation & storage)

| File | What it does | Needs change? |
|------|-------------|---------------|
| `convex/documents.ts:16-39` (`save`) | Creates document with `ocrStatus: "pending"`, triggers OCR via scheduler | No |
| `convex/ocr.ts:6-20` (`updateOcrStatus`) | Updates document `ocrStatus` (pending → processing) | No |
| `convex/ocr.ts:23-53` (`updateOcrResults`) | Saves `ocrExtractedData` with per-field confidence scores to document | No |
| `convex/ocr.ts:114-202` (`extractExpenseData`) | Fetches doc, calls OCR proxy, saves results | No |
| `convex/schema.ts:41-77` | Schema: documents table with `ocrStatus`, `ocrConfidence`, `ocrExtractedData`, `ocrError` | No |

### READ (OCR data display & queries)

| File | What it does | Needs change? |
|------|-------------|---------------|
| `convex/expenses.ts:204-263` (`listWithOcrStatus`) | Loops documents, sets `hasUnacknowledgedOcr` if ANY doc has OCR data | **No** — detection only, not selection |
| `src/components/expenses/expense-columns.tsx:70-74` | Shows sparkles icon when `hasUnacknowledgedOcr` | No |
| `src/components/expenses/expense-table.tsx:54-57` | Calls `listWithOcrStatus` query | No |
| `src/components/expenses/expense-detail.tsx:55-68` | **Picks FIRST document with OCR data** → feeds to banner + dialog | **YES — Change 8** (use `getBestOcrData`) |
| `src/components/expenses/expense-detail.tsx:70` | `ocrData = ocrDocumentWithData?.ocrExtractedData` | **YES** — will use aggregated result |
| `src/components/expenses/expense-detail.tsx:302-316` | Passes `ocrData` and `ocrDocument` props to `ExpenseDialog` | **YES — Change 10** (pass best-confidence doc for preview) |
| `src/components/expenses/expense-dialog.tsx:273-285` | `effectiveOcrData` merges local OCR (upload) with prop OCR | **YES — Change 11** (see below) |
| `src/components/expenses/expense-dialog.tsx:296-316` | Builds `defaultValues` from effective OCR data | No (already uses `effectiveOcrData`) |
| `src/components/expenses/expense-dialog.tsx:140-152` | Watches `uploadedDocument` for OCR completion, sets `localOcrData` | **YES — Change 12** (see below) |
| `src/components/expenses/expense-form.tsx:88-105` | `fieldDiffs` memo — detects OCR vs original differences | No |
| `src/components/expenses/expense-form.tsx:108-135` | `selectSource` — toggles field between OCR/original value | No |
| `src/components/expenses/expense-form.tsx:180-373` | Renders OCR diff indicators per field | No |

### UPDATE (OCR acknowledgment & application)

| File | What it does | Needs change? |
|------|-------------|---------------|
| `convex/expenses.ts:188-201` (`acknowledgeOcr`) | Sets `expense.ocrAcknowledged = true` | No |
| `convex/expenses.ts:125-157` (`update`) | Saves edited expense (whatever field values user picked) | No |
| `src/components/expenses/expense-detail.tsx:228-230` | "Disregard" button → calls `acknowledgeOcr` | No |
| `src/components/expenses/expense-dialog.tsx:244-246` | After save with OCR data → calls `acknowledgeOcr` | No |
| `src/components/expenses/expense-dialog.tsx:80-84` | `fieldSelections` state — tracks which source per field | No |

### DELETE (OCR data cleanup)

| File | What it does | Needs change? |
|------|-------------|---------------|
| `convex/documents.ts:117-139` (`removeFromExpense`) | Removes doc from expense's `documentIds`, deletes doc+storage | No — OCR data cascades with document |
| `convex/documents.ts:77-89` (`remove`) | Deletes document and storage | No |
| `convex/expenses.ts:161-184` (`remove`) | Deletes expense + reimbursements, but **does NOT delete documents** | **Note** — documents orphaned (pre-existing, not OCR-specific) |
| `convex/dev.ts:6-38` (`clearAllData`) | Dev-only: deletes all documents + expenses | No |

### New gaps identified

**Change 10** — `expense-detail.tsx:302-316`: The `ocrDocument` prop currently passes the single `ocrDocumentWithData` to the dialog for preview. With best-confidence aggregation, fields may come from different documents. The preview should show the document that contributed the **most** fields (or the first doc with any OCR data as a reasonable default).

**Change 11** — `expense-dialog.tsx:273` (`effectiveOcrData`): When editing an existing expense, `localOcrData` (from a freshly uploaded document) takes priority over `ocrData` (prop from "Apply Data"). With aggregation, if the user uploads a new document while editing, its OCR results should be merged into the best-confidence set rather than fully replacing it.

**Change 12** — `expense-dialog.tsx:140-152`: When a document is uploaded during expense creation/edit, its OCR data is set directly as `localOcrData`. For **new expenses** (no existing documents), this is fine — there's only one doc. For **existing expenses** that already have documents with OCR, the new upload's data should be merged with existing documents' OCR via `getBestOcrData` instead of replacing.

---

## Code-Level Changes

### File: `src/components/documents/document-gallery.tsx`

**Change 1** (line 126): Add aria-label to thumbnail button
```tsx
// Before:
<button
  onClick={() => setViewingDocument({...})}
  className="w-full aspect-[4/3] flex items-center justify-center hover:bg-muted/50 transition-colors"
>

// After:
<button
  onClick={() => setViewingDocument({...})}
  aria-label={`View document: ${doc.originalFilename}`}
  className="w-full aspect-[4/3] flex items-center justify-center hover:bg-muted/50 transition-colors"
>
```

**Change 2** (line 158): Add aria-label to delete button
```tsx
// Before:
<Button
  size="icon"
  variant="destructive"
  className="h-7 w-7"
  onClick={() => setDeletingDocumentId(doc._id)}
  title="Delete"
>

// After:
<Button
  size="icon"
  variant="destructive"
  className="h-7 w-7"
  onClick={() => setDeletingDocumentId(doc._id)}
  aria-label={`Delete ${doc.originalFilename}`}
>
```

### File: `src/components/expenses/expense-form.tsx`

**Change 3**: Add `aria-hidden="true"` to all 3 separator dots (date, provider, amount fields)
```tsx
// Before:
<span className="text-border">·</span>

// After:
<span className="text-border" aria-hidden="true">·</span>
```

**Change 4**: Add visible focus ring to all 3 toggle buttons
```tsx
// Before:
className={cn(
  "underline underline-offset-2 transition-colors",
  "min-h-[44px] -my-4 py-4",
  "hover:text-foreground focus:outline-none focus-visible:text-foreground"
)}

// After:
className={cn(
  "underline underline-offset-2 transition-colors",
  "min-h-[44px] -my-4 py-4",
  "hover:text-foreground focus:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
)}
```

**Change 5**: Convert amount input from `type="number"` to `type="text"` with `inputMode="decimal"` and format-on-blur

### File: `src/components/expenses/expense-dialog.tsx`

**Change 6**: Widen dialog to `sm:max-w-5xl` when document attached, add two-panel flex layout (60/40) with inline PDF preview on left, form on right. Add skip link and `onOpenAutoFocus` for accessibility.

**Change 7**: Update `effectiveOcrData` (line 273) — when editing an existing expense that already has documents with OCR, merge new upload's OCR data into the aggregated best-confidence set instead of replacing it entirely.

**Change 8**: Update upload-during-edit OCR watcher (line 140-152) — for existing expenses with documents, re-run aggregation including the new upload's data.

### File: `src/components/expenses/expense-detail.tsx`

**Change 9**: Replace first-document OCR lookup (lines 55-68) with `getBestOcrData(documents)` aggregation across all documents.

**Change 10**: Update `ocrDocument` prop passed to `ExpenseDialog` (lines 302-316) — select the document that contributed the most fields to the aggregated result for the preview panel.

### New file: `src/lib/ocr.ts`

**Change 11**: Extract `getBestOcrData(documents)` utility that picks highest-confidence value per field. Also export a helper to identify which document contributed the most fields (for preview selection).

---

## Implementation Order

1. **Phase 1 — Accessibility fixes** (Changes 1-4): Low risk, no layout changes ✅
2. **Phase 2 — Currency formatting** (Change 5): Self-contained form change ✅
3. **Phase 3 — Best-confidence OCR** (Changes 9, 10, 11): Extract `getBestOcrData` utility, wire into `expense-detail.tsx`, update preview doc selection ✅
4. **Phase 4 — Two-panel dialog** (Changes 6, 7, 8): Layout refactor + merge OCR from uploads into aggregated set ✅

## Completion Checklist

Per CLAUDE.md, verify after implementation:
- [x] Functionality: Lint passes (0 errors), all 87 tests pass, production build succeeds
- [ ] Design fidelity: Screenshots confirm layout at desktop, two-panel split renders correctly
- [x] Accessibility: All interactive elements have accessible names, focus indicators visible, keyboard nav works
- [ ] Responsive: Test at 375x667 (phone), 768x1024 (tablet), 1280x800 (desktop)
