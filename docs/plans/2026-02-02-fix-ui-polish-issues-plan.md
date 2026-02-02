---
title: "fix: UI Polish Issues - Document Icon, Sheet Button Layout, Date Picker"
type: fix
date: 2026-02-02
---

# UI Polish Issues

Three UI bugs introduced or revealed during the OCR indicator feature implementation.

## Overview

| Issue | File | Root Cause | Fix |
|-------|------|------------|-----|
| 1. Document icon missing | `expense-columns.tsx` | Conditional logic hides FileText when Sparkles shows | Show both icons |
| 2. Close/Edit button overlap | `expense-detail.tsx` | Sheet close button absolutely positioned at top-right | Add right padding to header |
| 3. Date picker wrong month | `expense-form.tsx` | Calendar missing `defaultMonth` prop | Pass `field.value` as defaultMonth |

---

## Issue 1: Document Icon Missing from Expense List

**Problem:** The FileText icon that indicates an expense has documents no longer appears when the expense also has unacknowledged OCR data. It should show alongside the Sparkles icon.

**File:** `src/components/expenses/expense-columns.tsx:51-60`

**Current Code:**
```tsx
{expense.hasUnacknowledgedOcr && (
  <span title="OCR data available - click to review">
    <Sparkles className="h-4 w-4 text-primary" />
  </span>
)}
{hasDocuments && !expense.hasUnacknowledgedOcr && (
  <span title="Has documents">
    <FileText className="h-4 w-4 text-muted-foreground" />
  </span>
)}
```

**Fix:** Remove the `!expense.hasUnacknowledgedOcr` condition so FileText shows independently:

```tsx
{expense.hasUnacknowledgedOcr && (
  <span title="OCR data available - click to review">
    <Sparkles className="h-4 w-4 text-primary" />
  </span>
)}
{hasDocuments && (
  <span title="Has documents">
    <FileText className="h-4 w-4 text-muted-foreground" />
  </span>
)}
```

---

## Issue 2: Close Button Overlaying Edit Button

**Problem:** In the expense details sheet, the built-in close button (X) overlays the Edit button because both are positioned in the top-right corner.

**File:** `src/components/expenses/expense-detail.tsx:135`

**Root Cause:**
- SheetContent has a close button absolutely positioned at `top-4 right-4` (16px from top/right)
- SheetHeader uses `flex flex-row items-center justify-between` placing Edit button at the end
- The Edit button and close button occupy the same visual space

**Fix:** Add right padding to SheetHeader to make room for the close button:

```tsx
<SheetHeader className="flex flex-row items-center justify-between pr-10">
```

This adds ~40px right padding, leaving space for the close button (which is ~16px icon + ~16px from right edge).

---

## Issue 3: Date Picker Defaults to Today's Month

**Problem:** When editing an expense, clicking the Date Paid input opens a calendar that shows the current month instead of navigating to the month containing the selected date.

**File:** `src/components/expenses/expense-form.tsx:77-83`

**Current Code:**
```tsx
<Calendar
  mode="single"
  selected={field.value}
  onSelect={field.onChange}
  disabled={(date) => date > new Date()}
  initialFocus
/>
```

**Fix:** Add `defaultMonth` prop to show the correct month:

```tsx
<Calendar
  mode="single"
  selected={field.value}
  onSelect={field.onChange}
  defaultMonth={field.value}
  disabled={(date) => date > new Date()}
  initialFocus
/>
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/expenses/expense-columns.tsx` | Remove `!expense.hasUnacknowledgedOcr` condition from FileText |
| `src/components/expenses/expense-detail.tsx` | Add `pr-10` to SheetHeader className |
| `src/components/expenses/expense-form.tsx` | Add `defaultMonth={field.value}` to Calendar |

---

## Verification

- [x] Expense with documents but no OCR data shows FileText icon
- [x] Expense with documents AND OCR data shows both Sparkles and FileText icons
- [x] Expense details sheet shows Edit button without close button overlap
- [x] Edit expense dialog opens calendar to the month of the selected date
