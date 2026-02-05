---
title: "null vs undefined Mismatch in Backend Validators"
category: logic-errors
tags: [convex, validators, null, undefined, typescript, forms]
module: backend-validation
symptoms:
  - "ArgumentValidationError: Value does not match validator"
  - "Path: .fieldName, Value: null, Validator: v.string()"
  - "Field works in create but fails in update (or vice versa)"
  - "Clearing a field causes save to fail"
root_cause: "Frontend sends null but backend validator only accepts undefined"
date: 2026-02-05
---

# null vs undefined Mismatch in Backend Validators

## Problem

When updating an expense and clearing the category field, the save operation failed with a validation error. The category dropdown allowed clearing the selection, but the backend rejected the `null` value.

**Observed behavior:**
1. Open Edit dialog for expense with category "Medical Services"
2. Clear the category dropdown (select empty option)
3. Click Save
4. Error: `ArgumentValidationError: Value does not match validator`
5. Error details: `Path: .category, Value: null, Validator: v.string()`

## Root Cause

Convex's `v.optional()` validator only accepts `undefined`, not `null`:

```typescript
// Convex schema
category: v.optional(v.string())  // Accepts: undefined | string
                                  // Rejects: null ❌
```

But the frontend form (using Zod with `.nullish()`) sends `null` when a field is cleared:

```typescript
// Frontend sends
{ category: null }  // Cleared dropdown sends null

// Backend expects
{ category: undefined }  // or just omit the field
```

## Why This Happens

JavaScript and TypeScript treat `null` and `undefined` differently:

| Scenario | Form Value | What Frontend Sends |
|----------|------------|---------------------|
| Field never touched | `undefined` | Field omitted |
| Field cleared by user | `null` | `category: null` |
| Field set to value | `"Dental"` | `category: "Dental"` |

Zod's `.nullish()` is designed to handle both:
```typescript
z.string().nullish()  // Accepts: undefined | null | string
```

But Convex's `v.optional()` is stricter:
```typescript
v.optional(v.string())  // Accepts: undefined | string (NOT null)
```

## Solution

### Option 1: Update backend to accept null (recommended for clearable fields)

```typescript
// convex/schema.ts
export default defineSchema({
  expenses: defineTable({
    // ... other fields
    category: v.optional(v.union(v.string(), v.null())),
  }),
})

// convex/expenses.ts mutation args
args: {
  category: v.optional(v.union(v.string(), v.null())),
}
```

### Option 2: Convert null to undefined on frontend

```typescript
// In dialog's mutation call
await updateExpense({
  // ...
  category: data.category || undefined,  // null → undefined
})
```

**Caveat:** This works but loses the distinction between "field was cleared" and "field was never touched."

### Option 3: Transform in Zod schema

```typescript
// In validation schema
category: z.string().nullish().transform(val => val ?? undefined)
```

## Prevention

### Match frontend and backend nullable semantics

For clearable optional fields:
```typescript
// Frontend (Zod)
category: z.string().nullish()

// Backend (Convex)
category: v.optional(v.union(v.string(), v.null()))

// Frontend submission
category: data.category ?? null  // undefined → null for consistency
```

For non-clearable optional fields:
```typescript
// Frontend (Zod)
comment: z.string().optional()

// Backend (Convex)
comment: v.optional(v.string())

// Frontend submission
comment: data.comment || undefined  // empty string → undefined
```

### Validation checklist

When adding optional fields:

- [ ] Decide if field is clearable (can user explicitly clear it?)
- [ ] If clearable: backend needs `v.union(v.string(), v.null())`
- [ ] If not clearable: use `v.optional(v.string())`
- [ ] Frontend submission matches backend expectation

### Quick reference

| Field Type | Zod | Convex | Submission Transform |
|------------|-----|--------|---------------------|
| Required | `z.string()` | `v.string()` | None |
| Optional, not clearable | `z.string().optional()` | `v.optional(v.string())` | `\|\| undefined` |
| Optional, clearable | `z.string().nullish()` | `v.optional(v.union(v.string(), v.null()))` | `?? null` |

## Related

- `convex/schema.ts` - Database schema definitions
- `convex/expenses.ts` - Expense mutations with validators
- `src/lib/validations/expense.ts` - Zod validation schemas
- `docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md` - Form data flow
