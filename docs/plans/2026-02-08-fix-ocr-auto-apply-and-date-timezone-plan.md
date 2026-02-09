---
title: "Fix OCR Auto-Apply and Date Off-by-One Timezone Bugs"
type: fix
date: 2026-02-08
github_issue: 7
---

# Fix OCR Auto-Apply and Date Off-by-One Timezone Bugs

## Overview

Two bugs combine to create a confusing expense editing experience:

1. **OCR values auto-applied without user action** — Clicking "Edit" on an expense with OCR data shows OCR-overridden values instead of saved values, because the dialog always receives `ocrData` regardless of which button opened it.
2. **Date off-by-one** — `new Date("YYYY-MM-DD")` parses as UTC midnight, causing all dates to display as the previous day in timezones west of UTC (all US timezones). The save path (`toISOString().split("T")[0]`) is also fragile for timezones east of UTC.

## Bug 1: OCR Data Always Passed to Edit Dialog

### Problem

`expense-detail.tsx` uses a single `editDialogOpen` boolean. Both "Edit" and "Apply Data" buttons call `setEditDialogOpen(true)`. The `ExpenseDialog` always receives `ocrData={ocrData ?? undefined}` (line 297), so the dialog cannot distinguish between the two intents.

Additionally, even when OCR data has been acknowledged (via "Disregard"), the `ocrData` prop is still passed to the dialog.

### Approach: Gate Props on Single Dialog (Not Separate Dialogs)

Considered splitting into separate "Edit" and "Apply OCR" dialogs, but the divergence is in **data, not structure**:

- Both modes use the same `ExpenseForm` — diff indicators and OCR toggles already self-toggle based on whether `ocrValues`/`originalValues` are present
- The two-panel layout already gates via `showPreview = isEditing && effectiveOcrData && previewDocument` — when `ocrData` is `undefined`, the dialog collapses to single-column automatically
- Splitting would duplicate `handleSubmit`, file upload state, cleanup effects, and mutation wiring
- The fix is a 1-line state change + 2-line prop gate — minimal and low-risk

A separate dialog would make sense if "Apply OCR" had different fields or a different submission flow. It doesn't — it's the same form with extra comparison UI.

### Fix

- [x] Add `editMode` state to `expense-detail.tsx`: `"edit" | "apply-ocr" | null`
- [x] "Edit" button sets `editMode` to `"edit"` and opens dialog
- [x] "Apply Data" button sets `editMode` to `"apply-ocr"` and opens dialog
- [x] Pass `ocrData` and `ocrDocument` to `ExpenseDialog` **only** when `editMode === "apply-ocr"`
- [x] Reset `editMode` to `null` when dialog closes (via `onOpenChange`)
- [x] Ensure `acknowledgeOcr` in `expense-dialog.tsx` only fires when `ocrData` is present (already gated on `if (ocrData)`, which will now be `undefined` for pure edits)

### Affected Files

| File | Lines | Change |
|------|-------|--------|
| `src/components/expenses/expense-detail.tsx` | 40-41, 130-137, 226-232, 293-307 | Add `editMode` state, gate `ocrData`/`ocrDocument` props |

### Edge Cases

- **Expense with no OCR data**: `ocrData` is already `null`, no change in behavior
- **Expense with acknowledged OCR**: `ocrData` is suppressed for both "Edit" and "Apply Data" when acknowledged (the "Apply Data" button is already hidden when `ocrAcknowledged === true`)
- **Real-time OCR completion while dialog is open**: If opened via "Edit", `ocrData` prop is `undefined` regardless of background changes
- **`formKey` reset**: Dialog cleanup effect resets `localOcrData` to `null` on close (line 118-133), so stale OCR state is not carried between sessions

## Bug 2: Date Off-by-One Timezone

### Problem

`new Date("2026-02-06")` creates `Feb 6 00:00:00 UTC`, which is `Feb 5 19:00:00 EST`. Every `.toLocaleDateString()` call shows the wrong date for users west of UTC. The save path (`date.toISOString().split("T")[0]`) works for US timezones by coincidence but breaks for timezones east of UTC.

### Fix

Create `src/lib/dates.ts` with timezone-safe helpers, then replace all unsafe call sites.

#### New Utility: `src/lib/dates.ts`

```typescript
/**
 * Parse an ISO date string ("YYYY-MM-DD") as local midnight.
 * Unlike `new Date("YYYY-MM-DD")` which parses as UTC midnight,
 * this returns a Date at midnight in the user's local timezone.
 */
export function parseLocalDate(isoString: string): Date

/**
 * Format a Date object as "YYYY-MM-DD" using local date components.
 * Unlike `date.toISOString().split("T")[0]` which uses UTC components,
 * this uses getFullYear/getMonth/getDate for timezone safety.
 */
export function formatLocalDate(date: Date): string

/**
 * Convenience: parse an ISO date string and format it for display.
 * Equivalent to `parseLocalDate(isoString).toLocaleDateString(locale, options)`.
 */
export function displayLocalDate(
  isoString: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string
```

Implementation approach:
- `parseLocalDate`: Split the string and use `new Date(year, month - 1, day)` — avoids UTC entirely
- `formatLocalDate`: Use `date.getFullYear()`, `date.getMonth() + 1`, `date.getDate()` with zero-padding
- `displayLocalDate`: Combines parse + format for the common display pattern

#### Call Sites to Update

**Display path** (replace `new Date(isoString).toLocaleDateString(...)` with `displayLocalDate(isoString, ...)`):

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `expense-columns.tsx` | 53 | `new Date(row.getValue("datePaid"))` then `.toLocaleDateString()` | `displayLocalDate(row.getValue("datePaid"), ...)` |
| `expense-detail.tsx` | 169 | `new Date(expense.datePaid).toLocaleDateString(...)` | `displayLocalDate(expense.datePaid, ...)` |
| `optimizer-results.tsx` | 121 | `new Date(expense.datePaid).toLocaleDateString(...)` | `displayLocalDate(expense.datePaid, ...)` |
| `reimbursement-history.tsx` | 93 | `new Date(reimbursement.date).toLocaleDateString(...)` | `displayLocalDate(reimbursement.date, ...)` |

**Form default values** (replace `new Date(isoString)` with `parseLocalDate(isoString)`):

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `expense-dialog.tsx` | 276 | `new Date(effectiveOcrData.date.value)` | `parseLocalDate(effectiveOcrData.date.value)` |
| `expense-dialog.tsx` | 287 | `new Date(expense.datePaid)` | `parseLocalDate(expense.datePaid)` |
| `expense-dialog.tsx` | 296 | `new Date(effectiveOcrData.date.value)` | `parseLocalDate(effectiveOcrData.date.value)` |
| `expense-dialog.tsx` | 298 | `new Date(expense.datePaid)` | `parseLocalDate(expense.datePaid)` |
| `expense-dialog.tsx` | 308 | `new Date(effectiveOcrData.date.value)` | `parseLocalDate(effectiveOcrData.date.value)` |

**Save path** (replace `.toISOString().split("T")[0]` with `formatLocalDate(date)`):

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `expense-dialog.tsx` | 235 | `data.datePaid.toISOString().split("T")[0]` | `formatLocalDate(data.datePaid)` |
| `expense-dialog.tsx` | 248 | `data.datePaid.toISOString().split("T")[0]` | `formatLocalDate(data.datePaid)` |
| `reimbursement-form.tsx` | 71 | `data.date?.toISOString().split("T")[0]` | `data.date ? formatLocalDate(data.date) : undefined` |

**Import validation** (replace `.toISOString().split("T")[0]` with `formatLocalDate(date)`):

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `import-utils.ts` | 241-242 | `date.toISOString().split("T")[0]` | `formatLocalDate(date)` |
| `import-utils.ts` | 355-356 | `date.toISOString().split("T")[0]` | `formatLocalDate(date)` |

**Export filename** (low priority, cosmetic):

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `export.ts` | 45 | `new Date().toISOString().split("T")[0]` | `formatLocalDate(new Date())` |

### Out of Scope (Server-side)

The Convex backend uses `new Date().toISOString().split("T")[0]` as fallback defaults in `convex/reimbursements.ts` (lines 20, 79) and `convex/optimizer.ts` (line 183). These run in a UTC server environment. Since the client always sends dates explicitly in the primary flows, the server fallback is acceptable for now. If needed later, the client can ensure dates are always sent.

### Edge Cases

- **`new Date()` for today's date**: Used in `expense-form.tsx` line 80 for new expense defaults — this is correct as-is (local midnight from `Date` constructor with no args)
- **Backend sorting**: `convex/reimbursements.ts` line 158 compares dates parsed consistently (both UTC), so relative ordering is correct — no change needed
- **Round-trip safety**: `formatLocalDate(parseLocalDate("2025-06-15"))` must equal `"2025-06-15"` for all dates

## Acceptance Criteria

### Bug 1: OCR Auto-Apply

- [x] Clicking "Edit" on an expense with OCR data shows the expense's **saved values** (not OCR values)
- [x] Clicking "Edit" does NOT show the "Values pre-filled from receipt scan" banner
- [x] Clicking "Edit" does NOT show diff indicators for OCR vs original values
- [x] Clicking "Apply Data" on an expense with OCR data shows OCR-overridden values with diff indicators
- [x] Clicking "Apply Data" shows the "Values pre-filled from receipt scan" banner
- [x] Saving after "Edit" does NOT call `acknowledgeOcr`
- [x] Saving after "Apply Data" calls `acknowledgeOcr`

### Bug 2: Date Timezone

- [x] Dates display correctly in the expense table (no off-by-one)
- [x] Dates display correctly in the expense detail sheet
- [x] Dates display correctly in the optimizer results
- [x] Dates display correctly in reimbursement history
- [x] Editing an expense preserves the correct date (no off-by-one on save)
- [x] Creating an expense saves the correct date
- [x] Creating a reimbursement saves the correct date
- [x] CSV import validates dates correctly
- [x] `parseLocalDate` and `formatLocalDate` round-trip correctly
- [x] `bunx tsc --noEmit && bun run lint && bun run test` passes
- [x] `bun run build` succeeds

## Unit Tests: `src/lib/dates.test.ts`

Test file follows existing patterns from `src/lib/import-utils.test.ts` (Vitest, `describe`/`it`/`expect`).

### `parseLocalDate` tests

```
describe("parseLocalDate")
  it("parses a standard ISO date as local midnight")
    - parseLocalDate("2025-06-15") → Date at June 15, 00:00 local
    - Verify: date.getFullYear() === 2025, date.getMonth() === 5, date.getDate() === 15

  it("parses January 1 correctly (timezone boundary)")
    - parseLocalDate("2025-01-01") → Jan 1, not Dec 31
    - This is the classic UTC bug: new Date("2025-01-01") would be Dec 31 in US timezones

  it("parses December 31 correctly (year boundary)")
    - parseLocalDate("2025-12-31") → Dec 31, not Jan 1 of next year

  it("parses leap day correctly")
    - parseLocalDate("2024-02-29") → Feb 29 (2024 is a leap year)
    - Verify date.getDate() === 29

  it("parses month boundaries correctly")
    - parseLocalDate("2025-03-01") → March 1, not Feb 28
    - parseLocalDate("2025-10-31") → October 31

  it("throws or returns invalid Date for malformed input")
    - parseLocalDate("not-a-date") → should not silently produce a valid date
    - parseLocalDate("") → should not produce a valid date
```

### `formatLocalDate` tests

```
describe("formatLocalDate")
  it("formats a date as YYYY-MM-DD using local components")
    - new Date(2025, 5, 15) → "2025-06-15"

  it("zero-pads single-digit months and days")
    - new Date(2025, 0, 5) → "2025-01-05"
    - new Date(2025, 8, 3) → "2025-09-03"

  it("handles year boundaries")
    - new Date(2025, 11, 31) → "2025-12-31"
    - new Date(2025, 0, 1) → "2025-01-01"

  it("handles leap day")
    - new Date(2024, 1, 29) → "2024-02-29"

  it("does NOT use UTC components")
    - Create a Date at local midnight: new Date(2025, 0, 1)
    - formatLocalDate should return "2025-01-01" regardless of timezone
    - (In contrast, .toISOString().split("T")[0] could return "2024-12-31" in west-of-UTC timezones)
```

### Round-trip tests

```
describe("parseLocalDate + formatLocalDate round-trip")
  it("round-trips standard dates")
    - formatLocalDate(parseLocalDate("2025-06-15")) === "2025-06-15"
    - formatLocalDate(parseLocalDate("2025-01-01")) === "2025-01-01"
    - formatLocalDate(parseLocalDate("2025-12-31")) === "2025-12-31"

  it("round-trips month boundaries")
    - formatLocalDate(parseLocalDate("2025-02-28")) === "2025-02-28"
    - formatLocalDate(parseLocalDate("2024-02-29")) === "2024-02-29"
    - formatLocalDate(parseLocalDate("2025-03-01")) === "2025-03-01"

  it("round-trips all months")
    - For each month 01-12: formatLocalDate(parseLocalDate("2025-MM-15")) === "2025-MM-15"
```

### `displayLocalDate` tests

```
describe("displayLocalDate")
  it("returns a formatted date string for display")
    - displayLocalDate("2025-06-15", "en-US", { year: "numeric", month: "long", day: "numeric" })
    - Should contain "June" and "15" and "2025"

  it("uses default locale when none specified")
    - displayLocalDate("2025-06-15") → a valid string (exact format depends on runtime locale)

  it("does not show the wrong day for January 1")
    - displayLocalDate("2025-01-01", "en-US", { month: "long", day: "numeric" })
    - Must contain "January" and "1", NOT "December" and "31"
```

### Edge case: timezone-sensitive save path

```
describe("formatLocalDate for save path (regression)")
  it("formats today's date correctly for saving")
    - const today = new Date()
    - formatLocalDate(today) should match YYYY-MM-DD of the local date
    - Verify by comparing with today.getFullYear(), getMonth()+1, getDate()

  it("does NOT shift dates created from calendar picker at midnight")
    - A Date at local midnight (e.g., new Date(2025, 0, 15))
    - formatLocalDate should return "2025-01-15", not "2025-01-14"
    - This verifies the save path fix for toISOString().split("T")[0] replacement
```

### Existing `import-utils.test.ts` date tests — no changes expected

The existing `parseDateToISO` and `isValidISODate` tests should continue to pass after the fix since `import-utils.ts` will use `formatLocalDate` internally, but the external API remains unchanged.

## Implementation Order

1. **Create `src/lib/dates.ts`** with `parseLocalDate`, `formatLocalDate`, `displayLocalDate`
2. **Create `src/lib/dates.test.ts`** with all test cases above
3. **Run tests** — `bun run test` to confirm all date tests pass
4. **Fix Bug 2 display paths** — update `expense-columns.tsx`, `expense-detail.tsx`, `optimizer-results.tsx`, `reimbursement-history.tsx`
5. **Fix Bug 2 form defaults** — update `expense-dialog.tsx` Date parsing calls
6. **Fix Bug 2 save paths** — update `expense-dialog.tsx` and `reimbursement-form.tsx` save formatting
7. **Fix Bug 2 import validation** — update `import-utils.ts`
8. **Fix Bug 2 export filename** — update `export.ts`
9. **Run tests again** — `bun run test` to confirm import-utils tests still pass after refactor
10. **Fix Bug 1** — add `editMode` state to `expense-detail.tsx`, gate `ocrData`/`ocrDocument` props
11. **Run full verification** — `bunx tsc --noEmit && bun run lint && bun run test && bun run build`
10. **Browser automation check** — verify both fixes end-to-end at `http://localhost:5173`

## References

- GitHub Issue: #7
- Related learning: `docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md`
- Related learning: `docs/solutions/logic-errors/null-undefined-backend-validators.md`
- Utility pattern reference: `src/lib/currency.ts`
