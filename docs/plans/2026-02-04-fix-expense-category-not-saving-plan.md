---
title: Fix expense category not saving when editing
type: fix
date: 2026-02-04
---

# 🐛 Fix: Expense Category Not Saving When Editing

## Overview

When editing an existing expense via the Edit dialog, changing the category field and saving causes the category to revert to its original value. The category selection is lost because the data flow for category editing was never wired up.

## Problem Statement

The expense form correctly displays a category dropdown, but when editing an existing expense:
1. The category doesn't populate with the expense's current value
2. Any category changes are not included in the update mutation

**Root Cause:** Three locations in `expense-dialog.tsx` are missing category handling.

## Proposed Solution

Wire up the category field in the expense edit flow by:
1. Adding `category` to the expense prop type
2. Including `category` in the form's default values when editing
3. Passing `category` to the `updateExpense` mutation

## Technical Approach

### File: `src/components/expenses/expense-dialog.tsx`

**Change 1: Update the expense prop type** (lines 35-43)

```typescript
// BEFORE
expense?: {
  _id: Id<"expenses">
  datePaid: string
  provider: string
  amountCents: number
  comment?: string
}

// AFTER
expense?: {
  _id: Id<"expenses">
  datePaid: string
  provider: string
  amountCents: number
  comment?: string
  category?: string | null  // ADD THIS
}
```

**Change 2: Include category in defaultValues** (around line 242-260)

```typescript
// BEFORE
const defaultValues = expense
  ? {
      datePaid: effectiveOcrData?.date?.value
        ? new Date(effectiveOcrData.date.value)
        : new Date(expense.datePaid),
      provider: effectiveOcrData?.provider?.value ?? expense.provider,
      amount: effectiveOcrData?.amount?.valueCents
        ? centsToDollars(effectiveOcrData.amount.valueCents)
        : centsToDollars(expense.amountCents),
      comment: expense.comment,
    }
  : // ...

// AFTER
const defaultValues = expense
  ? {
      datePaid: effectiveOcrData?.date?.value
        ? new Date(effectiveOcrData.date.value)
        : new Date(expense.datePaid),
      provider: effectiveOcrData?.provider?.value ?? expense.provider,
      amount: effectiveOcrData?.amount?.valueCents
        ? centsToDollars(effectiveOcrData.amount.valueCents)
        : centsToDollars(expense.amountCents),
      comment: expense.comment,
      category: expense.category,  // ADD THIS
    }
  : // ...
```

**Change 3: Pass category to updateExpense mutation** (around lines 202-213)

```typescript
// BEFORE
await updateExpense({
  id: expense._id,
  datePaid: data.datePaid.toISOString().split("T")[0],
  provider: data.provider,
  amountCents: dollarsToCents(data.amount),
  comment: data.comment || undefined,
})

// AFTER
await updateExpense({
  id: expense._id,
  datePaid: data.datePaid.toISOString().split("T")[0],
  provider: data.provider,
  amountCents: dollarsToCents(data.amount),
  comment: data.comment || undefined,
  category: data.category ?? null,  // ADD THIS (null clears the category)
})
```

## Acceptance Criteria

- [ ] When editing an expense, the category dropdown shows the expense's current category
- [ ] Changing the category to a different value and saving persists the new category
- [ ] Changing the category to "No Category" and saving clears the category (sets to null)
- [ ] Creating a new expense with a category still works correctly

## Context

### Backend Already Supports This

The Convex `update` mutation in `convex/expenses.ts` already handles category correctly:

```typescript
category: v.optional(v.union(v.string(), v.null())), // Allow null to clear category
```

- `undefined` = don't change the category
- `null` = clear the category
- `string` = set to that category

### Form Component Already Works

The `expense-form.tsx` Select component correctly handles the category:
- Uses `"__none__"` sentinel for "No Category"
- Converts to/from `null` on change
- Works correctly for new expenses

The bug is purely in the dialog's data flow, not in the form or backend.

## References

- `src/components/expenses/expense-dialog.tsx` - Dialog wrapper with edit logic
- `src/components/expenses/expense-form.tsx` - Form component (no changes needed)
- `convex/expenses.ts` - Update mutation (no changes needed)
- `docs/solutions/logic-errors/zod-enum-type-safety.md` - Related pattern for category enums
