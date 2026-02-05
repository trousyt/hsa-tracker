---
title: "feat: OCR Review Field Diff Indicators"
type: feat
date: 2026-02-04
deepened: 2026-02-04
reviewers: [frontend, best-practices]
---

# feat: OCR Review Field Diff Indicators

## Enhancement Summary

**Deepened on:** 2026-02-04
**Reviewers used:** Frontend Design, Best Practices, TypeScript, Code Simplicity, Race Conditions, React Hook Form

### Key Improvements
1. **Simplified architecture** — Inline diff indicators instead of separate component file (~30% less code)
2. **Race condition protections** — Idempotent handlers, proper state placement, blob URL cleanup patterns
3. **Type-safe implementation** — Required fields in state, explicit null handling, no `any` types
4. **Accessibility enhancements** — ARIA live regions, 44px touch targets, keyboard navigation

### New Considerations Discovered
- State must live at dialog level to survive form remounts
- Use `selectSource(field, 'ocr')` not toggle pattern to prevent double-click bugs
- Block form remount during submission to prevent race conditions
- Document thumbnail requires careful blob URL cleanup (follow existing DocumentViewer pattern)

---

## Overview

Enhance the expense edit dialog to show field-level comparison between OCR-extracted values and existing expense values when clicking "Apply Data". Users will see exactly what changed, with the ability to selectively revert individual fields before saving.

## Problem Statement / Motivation

When a user clicks "Apply Data" on an expense with OCR data:
1. The edit dialog opens with OCR values silently replacing existing values
2. No indication of what changed — original values disappear
3. All-or-nothing: can't keep some original values while accepting others
4. Hard to verify OCR accuracy without seeing the original for comparison

Users need visibility into what OCR extracted vs. what they entered, with granular control over which changes to accept.

## Proposed Solution

**In-place comparison** within the existing edit dialog:

1. **Field-level diff indicators** on fields where OCR differs from current value
2. **Default to OCR values** with "Was: [original]" shown and "Use original" link
3. **Toggle per field** — clicking reverses to show original value with "Apply OCR" link
4. **Inline document thumbnail** at top of dialog for quick reference
5. **Hide unchanged fields** from diff treatment (reduce noise)

### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│ [📄 thumbnail]  Review receipt                           → │
└─────────────────────────────────────────────────────────────┘

Provider: [CVS PHARMACY #1234         ▼]
          Was: "CVS Pharmacy" · Use original

Amount:   [$45.50                     ▼]
          Was: $45.00 · Use original

Date:     [2026-01-14                 📅]
          Was: 2026-01-15 · Use original

Category: [Medical                    ▼]   ← No indicator (no OCR data for this field)

                            [Cancel]  [Save Expense]
```

When "Use original" clicked:
```
Provider: [CVS Pharmacy               ▼]
          OCR found: "CVS PHARMACY #1234" · Apply OCR
```

### Research Insights: Visual Design

**Typography & Spacing:**
- Use `text-xs` (12px) for diff indicator — subordinate to `text-sm` form labels
- Use `font-medium` on the alternate value for visual distinction without shouting
- Use `underline-offset-2` for improved link readability
- Add `mt-1.5` (6px) gap between input and indicator

**Color Strategy (using existing design system):**
```typescript
// Diff indicator styling - no new colors needed
const diffStyles = {
  text: "text-muted-foreground",      // Subtle gray
  valueHighlight: "font-medium",       // Emphasize the alternate value
  link: "underline underline-offset-2 hover:text-foreground transition-colors",
}
```

**Preventing Layout Shift:**
```tsx
// Always render indicator container, toggle visibility
<div className={cn(
  "mt-1.5 text-xs transition-opacity duration-150",
  hasDiff ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
)}>
```

**Animation on Toggle:**
- Use 150ms opacity crossfade for indicator text changes
- Form field value change is instant (no animation) for immediate feedback

---

## Technical Considerations

### State Management

#### Research Insights: Type Safety

**Make all fields required** (not optional) since you initialize them anyway:

```typescript
type FieldSource = 'ocr' | 'original';

// Use Record for better type inference when iterating
type OcrFieldKey = 'amount' | 'date' | 'provider';
type OcrFieldSelections = Record<OcrFieldKey, FieldSource>;
```

#### Research Insights: State Placement (Critical for Race Conditions)

**State must live at dialog level**, not inside the form. The form may remount (via `formKey` increment when OCR completes), and selection state must survive:

```typescript
// In expense-dialog.tsx - NOT in the form
const [fieldSelections, setFieldSelections] = useState<OcrFieldSelections>(() => ({
  amount: 'ocr',
  date: 'ocr',
  provider: 'ocr',
}));

// Pass down as prop, survives form remounts
<ExpenseForm
  key={formKey}
  ocrSelections={fieldSelections}
  onOcrSelectionChange={setFieldSelections}
  // ...
/>
```

**Reset on dialog close:**
```typescript
useEffect(() => {
  if (!open) {
    setFieldSelections({ amount: 'ocr', date: 'ocr', provider: 'ocr' });
  }
}, [open]);
```

### Comparison Logic

Determine "different" for each field type:
- **Amount**: Compare as cents (integers) — `ocrData.amount.valueCents !== expense.amountCents`
- **Date**: Compare as ISO strings — `ocrData.date.value !== expense.datePaid`
- **Provider**: Case-insensitive, trimmed — `normalize(ocrData.provider.value) !== normalize(expense.provider)`

#### Research Insights: Null/Undefined Handling

OCR may not extract every field. Add explicit handling:

```typescript
interface OcrExtractedField<T> {
  value: T | null;
  confidence?: number;
}

// Comparison must handle nulls explicitly
function canShowDiff(
  ocrField: OcrExtractedField<unknown> | null,
  originalValue: unknown
): boolean {
  // No diff indicator if OCR didn't extract this field
  if (ocrField?.value === null || ocrField?.value === undefined) {
    return false;
  }
  return true;
}
```

#### Research Insights: Memoize Comparisons

```typescript
const fieldDiffs = useMemo(() => ({
  datePaid: ocrValues.datePaid !== undefined &&
    ocrValues.datePaid.getTime() !== originalValues.datePaid.getTime(),
  provider: ocrValues.provider !== undefined &&
    ocrValues.provider !== originalValues.provider,
  amount: ocrValues.amount !== undefined &&
    ocrValues.amount !== originalValues.amount,
}), [ocrValues, originalValues]);
```

### Toggle Handler Pattern

#### Research Insights: Idempotent Handlers (Prevents Double-Click Bugs)

**Use explicit selection, not toggle:**

```typescript
// BAD - double-click causes state/form divergence
const handleToggle = (field: OcrFieldKey) => {
  setFieldSelections(prev => ({
    ...prev,
    [field]: prev[field] === 'ocr' ? 'original' : 'ocr'
  }));
};

// GOOD - idempotent, double-click is harmless
const selectSource = (field: OcrFieldKey, source: FieldSource) => {
  if (fieldSelections[field] === source) return; // Already selected

  const newValue = source === 'ocr' ? getOcrValue(field) : getOriginalValue(field);
  setFieldSelections(prev => ({ ...prev, [field]: source }));
  form.setValue(field, newValue, { shouldValidate: true, shouldDirty: true });
};

// In JSX - explicit source, not toggle
<button onClick={() => selectSource('provider', 'original')}>Use original</button>
<button onClick={() => selectSource('provider', 'ocr')}>Apply OCR</button>
```

### React Hook Form Integration

#### Research Insights: setValue vs reset

Use `setValue` for individual field toggling, not `reset`:

```typescript
// Correct pattern for toggle
form.setValue(fieldName, newValue, {
  shouldValidate: true,  // Re-validate after change
  shouldDirty: true,     // Mark as modified
});
```

#### Research Insights: useWatch for Field Comparison

Use `useWatch` to isolate re-renders when detecting if current value differs from both sources:

```typescript
function OcrFieldIndicator({ control, fieldName, ocrValue, originalValue }) {
  // Watch only this specific field - isolated re-render
  const currentValue = useWatch({ control, name: fieldName });

  const isManuallyEdited = currentValue !== ocrValue && currentValue !== originalValue;
  // Show subtle "Edited" indicator if user's manual edits will be discarded on toggle
}
```

### Manual Edit Behavior

When user manually types in a field with diff indicator:
- **Keep toggles visible** — manual edits are temporary
- Clicking "Use original" or "Apply OCR" overwrites manual input
- This keeps the UI simple and predictable
- **Show "Edited" indicator** when value differs from both sources (warns user their manual edit will be lost)

### Document Thumbnail

Show thumbnail for the document that provided OCR data:
- Use existing `useSecureFileUrl()` hook
- Click opens `DocumentViewer` modal
- For PDFs: show file icon placeholder (consistent with current gallery)
- For images: show actual thumbnail

#### Research Insights: Document Thumbnail Design

**Layout Integration:**
```tsx
// Inside expense-dialog.tsx, before the form
{hasOcrDocument && (
  <button
    type="button"
    onClick={() => setViewerOpen(true)}
    className="group flex items-center gap-3 w-full p-3 rounded-lg
               bg-muted/30 hover:bg-muted/50 transition-colors text-left
               focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label="View receipt document"
  >
    <div className="relative w-12 h-16 rounded border bg-background overflow-hidden flex-shrink-0">
      {isImage ? (
        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted/50">
          <FileText className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">Review receipt</p>
      <p className="text-xs text-muted-foreground">Click to expand</p>
    </div>
    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
  </button>
)}
```

**Thumbnail Dimensions:**
- Aspect ratio: 3:4 (portrait) — matches typical receipts
- Size: 48x64px (`w-12 h-16`) — recognizable but not dominant
- Border radius: `rounded` (0.25rem) — consistent with inputs

#### Research Insights: Blob URL Cleanup (Critical)

The thumbnail must follow the exact pattern from `DocumentViewer` to prevent memory leaks:

```typescript
useEffect(() => {
  if (!documentId) return;

  let cancelled = false;
  let url: string | null = null;

  const fetchThumbnail = async () => {
    try {
      const fetchedUrl = await getSecureFileUrl(documentId);
      url = fetchedUrl;  // Track BEFORE checking cancelled
      if (cancelled) {
        URL.revokeObjectURL(fetchedUrl);  // Cleanup on cancelled path
      } else {
        setBlobUrl(fetchedUrl);
      }
    } catch (err) {
      if (!cancelled) setError(err);
    }
  };

  fetchThumbnail();

  return () => {
    cancelled = true;
    if (url) {
      URL.revokeObjectURL(url);  // Cleanup on unmount path
    }
  };
}, [documentId, getSecureFileUrl]);
```

**Critical:** Track `url` **before** the cancellation check. If you only track it inside the `else` branch, a fetch that completes during unmount will leak.

### Race Condition Protections

#### Research Insights: Critical Race Conditions to Prevent

1. **Block form remount during submission:**
```typescript
useEffect(() => {
  if (uploadedDocument?.ocrStatus === "completed" && uploadedDocument.ocrExtractedData) {
    // Don't update form if submission is in progress
    if (isSubmitting) return;

    setLocalOcrData(uploadedDocument.ocrExtractedData);
    setFormKey((k) => k + 1);
  }
}, [uploadedDocument?.ocrStatus, isSubmitting]);
```

2. **Synchronous value calculation in handlers:**
```typescript
const selectSource = (field: OcrFieldKey, source: FieldSource) => {
  // Calculate value BEFORE any state updates
  const newValue = source === 'ocr' ? getOcrValue(field) : getOriginalValue(field);

  // Then update both state and form synchronously
  setFieldSelections(prev => ({ ...prev, [field]: source }));
  form.setValue(field, newValue, { shouldValidate: true });
};
```

3. **Form validation after setValue:**
```typescript
// Always pass shouldValidate: true to prevent stale validation state
form.setValue(field, newValue, { shouldValidate: true, shouldDirty: true });
```

4. **Thumbnail load vs field toggle race:**
   - State lives at dialog level, not form level
   - Form remount (via `formKey`) does not lose selection state
   - Thumbnail load completing does not affect field selections

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/expenses/expense-dialog.tsx` | Add `fieldSelections` state, reset on close, add document thumbnail, pass props to form |
| `src/components/expenses/expense-form.tsx` | Accept `ocrSelections` and `onOcrSelectionChange` props, render inline diff indicators |
| **New:** `src/components/expenses/document-thumbnail.tsx` | Clickable thumbnail with blob URL cleanup |

**Note:** The `ocr-field-indicator.tsx` component was removed — inline the ~15 lines directly into expense-form.tsx for simplicity.

### Inline Diff Indicator Implementation

```tsx
// Inline in expense-form.tsx, beneath each form field
{fieldDiffs.provider && (
  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
    <span className="truncate">
      {ocrSelections.provider === 'ocr' ? (
        <>Was: <span className="font-medium">"{originalValues.provider}"</span></>
      ) : (
        <>OCR found: <span className="font-medium">"{ocrValues.provider}"</span></>
      )}
    </span>
    <span className="text-border">·</span>
    <button
      type="button"
      onClick={() => onOcrSelectionChange?.('provider',
        ocrSelections.provider === 'ocr' ? 'original' : 'ocr'
      )}
      className={cn(
        "underline underline-offset-2 transition-colors",
        "min-h-[44px] -my-4 py-4",  // Expand vertical touch target
        "hover:text-foreground focus:outline-none focus-visible:text-foreground"
      )}
      aria-label={`Use ${ocrSelections.provider === 'ocr' ? 'original' : 'OCR'} value for Provider`}
    >
      {ocrSelections.provider === 'ocr' ? 'Use original' : 'Apply OCR'}
    </button>
  </div>
)}
```

### Known Gotchas (from docs/solutions/)

1. **Form field wiring** — When adding any state/props, must update: type definition, defaultValues, mutation call (all three!)
2. **useEffect dependencies** — Include document, mutation, and retry state in deps for thumbnail loading
3. **Blob URL cleanup** — Revoke URLs in both cancelled path AND final cleanup to prevent leaks
4. **State survives remount** — Selection state at dialog level, not form level

---

## Acceptance Criteria

### Functional

- [x] "Apply Data" opens dialog with diff indicators on fields where OCR differs from current
- [x] Each diff field shows "Was: [original]" with "Use original" link
- [x] Clicking "Use original" swaps to original value, shows "OCR found: [value]" with "Apply OCR"
- [x] Fields where OCR matches current show no indicator
- [x] Document thumbnail visible at top of dialog when OCR data present
- [x] Clicking thumbnail opens DocumentViewer modal
- [x] Save applies values based on per-field selections
- [x] Save marks `ocrAcknowledged = true`

### Edge Cases

- [x] Partial OCR data (e.g., only amount extracted) — show indicator only for that field
- [x] All OCR values match current — no diff indicators, but dialog still functions normally
- [x] All fields reverted to original — save works, applies original values
- [x] Cancel preserves original expense data (no changes saved)
- [x] Double-click on toggle link — idempotent, no state corruption
- [x] OCR completes during user toggle actions — selection state preserved
- [x] User manually edits field then clicks toggle — manual edit is overwritten (with visual warning)
- [x] Rapid dialog open/close — no blob URL memory leaks

### Non-Functional

- [x] Diff indicators are keyboard accessible (focus-visible ring)
- [x] Links have adequate touch targets (min 44px via padding expansion)
- [x] No layout shift when toggling field sources (opacity transition, not conditional render)
- [x] ARIA live regions announce value changes to screen readers

### Research Insights: Accessibility Requirements

```tsx
<button
  type="button"
  className="... focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  aria-label={`Use ${alternateSource} value for ${fieldLabel}: ${alternateValue}`}
>
```

Use `role="status"` with `aria-live="polite"` for non-urgent value change announcements.

---

## Success Metrics

- Users can see exactly what OCR extracted before saving
- Users can selectively revert individual fields
- Users can reference the document while reviewing
- Flow feels lightweight — no extra modals or steps

---

## Dependencies & Risks

### Dependencies
- Existing `DocumentViewer` component for expand-to-view
- Existing `useSecureFileUrl()` hook for thumbnail URL
- Existing form infrastructure (React Hook Form, Zod validation)

### Risks
- **UI complexity**: Diff indicators add visual noise — mitigate by keeping them subtle (muted text, small size, opacity transitions)
- **State synchronization**: Form value and selection state could diverge — mitigate with idempotent handlers and shouldValidate:true
- **Blob URL leaks**: Thumbnail component adds another blob URL lifecycle — mitigate by following DocumentViewer pattern exactly

### Research Insights: Risks Identified

| Risk | Mitigation |
|------|------------|
| Double-click causes state/form divergence | Use idempotent `selectSource(field, source)` not toggle |
| Form remount loses selection state | Keep state at dialog level, not form level |
| Stale closure in toggle handler | Calculate new value synchronously before state updates |
| Layout shift on toggle | Use opacity transition, not conditional render |
| Missing validation after setValue | Always pass `{ shouldValidate: true }` |
| Blob URL memory leak in thumbnail | Track URL before cancellation check, revoke in both paths |

---

## Open Questions (Deferred)

1. **Confidence display**: Should low-confidence values be visually indicated? (Current decision: no, keep simple)
2. **Table row edit path**: Should editing from table row actions also show diff indicators? (Likely yes, but separate ticket)

---

## Testing Recommendations

### Race Condition Testing

To induce timing-related failures during QA:

1. **Slow network:** Use browser DevTools Network throttling set to "Slow 3G" and rapidly toggle fields while thumbnail loads
2. **Double-click:** Literally double-click every toggle link
3. **Race OCR completion:** Upload a file, immediately start typing, click Save just as OCR completes
4. **Rapid open/close:** Open dialog, cancel immediately, repeat 10 times, check for memory leaks in DevTools Memory tab

### Functional Testing

1. Create expense with all optional fields populated
2. Upload document, wait for OCR
3. Click "Apply Data"
4. Verify document thumbnail is visible and clickable
5. Verify each field shows correct diff indicator (or none if values match)
6. Toggle each field, verify value changes
7. Manually edit a field, verify "Edited" indicator appears
8. Save and verify final values match selections

---

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-04-ocr-review-improvements-brainstorm.md`
- Expense dialog: `src/components/expenses/expense-dialog.tsx`
- Expense form: `src/components/expenses/expense-form.tsx`
- Document viewer: `src/components/documents/document-viewer.tsx`
- OCR schema: `convex/schema.ts:54-75`

### Institutional Learnings
- Form field synchronization gotcha: `docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md`
- Blob URL memory leaks: `docs/solutions/integration-issues/convex-http-routes-cors-blob-leaks.md`
- React hooks dependencies: `docs/solutions/logic-errors/react-hooks-missing-dependencies.md`

### External References
- [React Hook Form setValue API](https://react-hook-form.com/docs/useform/setvalue)
- [React Hook Form useWatch](https://react-hook-form.com/docs/usewatch)
- [ARIA Live Regions](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/)
- [useMemo and useCallback Guide](https://www.joshwcomeau.com/react/usememo-and-usecallback/)
