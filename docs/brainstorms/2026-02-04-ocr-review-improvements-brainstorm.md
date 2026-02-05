# OCR Review Improvements Brainstorm

**Date:** 2026-02-04
**Status:** Ready for planning

## What We're Building

Enhance the existing "Apply Data" flow to provide clearer visibility into what OCR extracted vs current values, with field-by-field control over which changes to accept.

### Current Behavior
When clicking "Apply Data" on an expense with OCR data:
1. Edit dialog opens with OCR values silently replacing current values
2. User sees no indication of what changed
3. No way to selectively apply fields — it's all-or-nothing
4. Must remember/compare mentally against original values

### New Behavior
When clicking "Apply Data":
1. Edit dialog opens with **visual diff indicators** on changed fields
2. Each changed field shows: current value → OCR value with toggle/revert
3. Fields where OCR matches current are hidden (no noise)
4. Inline document thumbnail allows quick verification (click to expand)
5. OCR values default-selected; user can revert individual fields

## Why This Approach

**Approach B: In-Place Comparison** was chosen over:

- **Split-View Dialog:** More complex, requires significant new UI. User prefers enhancing familiar edit flow.
- **Review-First, Then Edit:** Extra step feels heavy for simple cases.

In-place comparison keeps the existing edit dialog but adds targeted diff visualization. Lower complexity, familiar UX, achieves the core goals.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI approach | In-place comparison | Lighter weight, familiar edit flow |
| Default state | OCR values pre-selected | Trust OCR, user opts out |
| Unchanged fields | Hidden | Reduce noise, focus on diffs |
| Document preview | Inline thumbnail + expand | Quick reference without leaving dialog |
| Entry point | Only "Apply Data" button | Keep new expense flow simple |

## Detailed Design

### Field Diff Indicator

For each field where OCR differs from current value:

```
Provider: [CVS PHARMACY #1234    ▼]
          ├── Was: "CVS Pharmacy"
          └── [↩ Use original]

Amount:   [$45.50               ▼]
          ├── Was: $45.00
          └── [↩ Use original]
```

- Field shows OCR value by default
- "Was:" shows original value for reference
- "Use original" link reverts to original value
- When reverted, indicator inverts:

```
Provider: [CVS Pharmacy         ▼]
          ├── OCR found: "CVS PHARMACY #1234"
          └── [✓ Apply OCR]
```

### Document Thumbnail

At top of dialog when OCR data is being applied:

```
┌──────────────────────────────────────────────────┐
│ [📄 thumbnail]  Receipt scan available           │
│                 Click to view full document      │
└──────────────────────────────────────────────────┘
```

- Clicking opens existing document viewer modal
- PDF rendering in thumbnail (small preview)
- Primarily PDFs, some images

### State Management

Track per-field "use OCR" vs "use original" state:

```typescript
type FieldSelection = {
  amount: 'ocr' | 'original';
  date: 'ocr' | 'original';
  provider: 'ocr' | 'original';
};
```

Default all to `'ocr'`. On save, apply only fields set to `'ocr'`.

## Open Questions

1. **Confidence display:** OCR data includes confidence scores. Should low-confidence fields get visual treatment (warning color, etc)?
2. **Partial OCR:** What if OCR only extracted some fields? Show only those, or indicate "not found"?
3. **Keyboard navigation:** Should there be shortcuts to quickly accept/reject all?

## Success Criteria

- [ ] User can see exactly what changed before saving
- [ ] User can selectively revert individual fields
- [ ] User can reference document while reviewing
- [ ] Flow feels lightweight, not cumbersome
- [ ] Unchanged fields don't add noise

## Files Likely Affected

- `src/components/expenses/expense-dialog.tsx` — Add diff indicators, selection state
- `src/components/expenses/expense-form.tsx` — May need to expose field-level control
- New: `src/components/expenses/ocr-field-diff.tsx` — Reusable diff indicator component
- New: `src/components/expenses/document-thumbnail.tsx` — Inline preview component
