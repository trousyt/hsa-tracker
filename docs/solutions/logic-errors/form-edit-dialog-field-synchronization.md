---
title: "Form Fields Missing from Edit Dialog Data Flow"
category: logic-errors
tags: [react-hook-form, forms, dialogs, typescript, data-flow, mutations]
module: form-handling
symptoms:
  - "Form field changes don't persist when saving via Edit dialog"
  - "Field shows in UI but reverts to original value after save"
  - "Field works in create mode but not edit mode"
  - "No error messages - field silently ignored"
date: 2026-02-04
root_cause: "Field wired in form component but omitted from dialog's type definition, defaultValues, or mutation call"
---

# Form Fields Missing from Edit Dialog Data Flow

## Problem

When editing an expense, changing the category field and saving caused the value to revert to its original state. The category dropdown appeared and was interactive, but changes were silently discarded.

**Observed behavior:**
1. Open Edit dialog for an expense with category "Medical Services"
2. Change category to "Dental Care"
3. Click Save
4. Category reverts to "Medical Services"

No errors appeared in console or UI.

## Root Cause

The category field existed in three places but the dialog wrapper only connected two of them:

```
┌─────────────────────────────────────────────────────────────────┐
│ ExpenseForm (expense-form.tsx)                                  │
│   ✓ Renders category Select component                          │
│   ✓ Zod schema includes category field                         │
│   ✓ Form submission includes category in data                  │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                    defaultValues (BROKEN)
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│ ExpenseDialog (expense-dialog.tsx)                              │
│   ✗ Type definition missing category field                     │
│   ✗ defaultValues didn't include expense.category              │
│   ✗ updateExpense mutation didn't receive category             │
└─────────────────────────────────────────────────────────────────┘
```

**Three missing pieces in expense-dialog.tsx:**

### 1. Type Definition (line ~35-43)

```typescript
// BEFORE - category missing from type
expense?: {
  _id: Id<"expenses">
  datePaid: string
  provider: string
  amountCents: number
  comment?: string
  // category not here!
}

// AFTER
expense?: {
  _id: Id<"expenses">
  datePaid: string
  provider: string
  amountCents: number
  comment?: string
  category?: string | null  // Added
}
```

### 2. Default Values (line ~242-252)

```typescript
// BEFORE - category not passed to form
const defaultValues = expense
  ? {
      datePaid: new Date(expense.datePaid),
      provider: expense.provider,
      amount: centsToDollars(expense.amountCents),
      comment: expense.comment,
      // category not here!
    }

// AFTER
const defaultValues = expense
  ? {
      datePaid: new Date(expense.datePaid),
      provider: expense.provider,
      amount: centsToDollars(expense.amountCents),
      comment: expense.comment,
      category: expense.category,  // Added
    }
```

### 3. Mutation Call (line ~202-209)

```typescript
// BEFORE - category not sent to backend
await updateExpense({
  id: expense._id,
  datePaid: data.datePaid.toISOString().split("T")[0],
  provider: data.provider,
  amountCents: dollarsToCents(data.amount),
  comment: data.comment || undefined,
  // category not here!
})

// AFTER
await updateExpense({
  id: expense._id,
  datePaid: data.datePaid.toISOString().split("T")[0],
  provider: data.provider,
  amountCents: dollarsToCents(data.amount),
  comment: data.comment || undefined,
  category: data.category ?? null,  // Added
})
```

## Why TypeScript Didn't Catch This

The form's props interface uses `Partial<ExpenseFormData>`:

```typescript
interface ExpenseFormProps {
  defaultValues?: Partial<ExpenseFormData>  // Allows missing fields
  onSubmit: (data: ExpenseFormData) => void
}
```

This is intentional (allows optional pre-fill), but means TypeScript won't warn when fields are missing from defaultValues.

## Solution

Wire up all three connection points when adding a field to a form that's wrapped by a dialog:

1. **Type definition** - Add field to the dialog's `expense?` prop type
2. **Default values** - Include field in `defaultValues` object construction
3. **Mutation call** - Pass field to the update mutation

## Prevention

### Checklist for Adding Form Fields

When adding a new field to a form wrapped by a dialog:

- [ ] Add field to form component's Zod schema
- [ ] Add field to form component's JSX (render the input)
- [ ] Add field to dialog's prop type definition
- [ ] Add field to dialog's `defaultValues` construction (for edit mode)
- [ ] Add field to dialog's create mutation call
- [ ] Add field to dialog's update mutation call
- [ ] Verify field is in backend mutation args

### Pattern to Avoid

Don't rely on TypeScript catching missing fields when using `Partial<T>`:

```typescript
// This won't warn about missing fields
const defaultValues: Partial<FormData> = {
  name: expense.name,
  // oops, forgot "category" - no TypeScript error
}
```

### Safer Pattern

Create a helper function that TypeScript can check:

```typescript
function buildExpenseDefaults(expense: Expense): ExpenseFormData {
  return {
    datePaid: new Date(expense.datePaid),
    provider: expense.provider,
    amount: centsToDollars(expense.amountCents),
    comment: expense.comment,
    category: expense.category,  // TypeScript enforces this
  }
}
```

### Testing Verification

When testing edit dialogs:

1. Create a record with all optional fields populated
2. Open Edit dialog
3. Verify all fields show correct values (not defaults)
4. Change each field
5. Save and verify changes persist

## Related

- `docs/solutions/logic-errors/react-hooks-missing-dependencies.md` - Related React pattern issues
- `docs/solutions/logic-errors/zod-enum-type-safety.md` - Category enum type safety pattern
- `src/components/expenses/expense-dialog.tsx` - The fixed component
- `src/components/expenses/expense-form.tsx` - The form component
