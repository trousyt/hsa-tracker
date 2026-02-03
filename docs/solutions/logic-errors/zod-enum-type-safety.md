---
title: "Type-Safe Const Tuples for Zod Enums"
category: logic-errors
tags: [typescript, zod, validation, patterns, type-safety]
module: validation
symptoms:
  - "z.enum() losing literal types"
  - "Category values not type-safe"
  - "Need single source of truth for enum values"
date: 2026-02-03
---

# Type-Safe Const Tuples for Zod Enums

## Problem

When using `z.enum()` with dynamically generated arrays, TypeScript loses the literal string types:

**Problematic pattern:**
```typescript
// This loses literal types!
const CATEGORIES = [
  { value: "medical", label: "Medical" },
  { value: "dental", label: "Dental" },
]

// z.enum needs literal array, not string[]
const schema = z.enum(CATEGORIES.map(c => c.value))  // Error or loses types
```

## Root Cause

`z.enum()` requires a readonly tuple of string literals. When you use `.map()` or other array methods, TypeScript widens the type to `string[]`, losing the specific literal values.

## Solution

Use the **const tuple + derived type** pattern:

```typescript
// Step 1: Define values as const tuple (preserves literal types)
export const EXPENSE_CATEGORY_VALUES = [
  "medical-services",
  "dental-care",
  "vision-care",
  "prescriptions",
  // ... more values
] as const  // Critical: 'as const' preserves literal types

// Step 2: Derive union type from const tuple
export type ExpenseCategory = (typeof EXPENSE_CATEGORY_VALUES)[number]
// Result: "medical-services" | "dental-care" | "vision-care" | ...

// Step 3: Full metadata with type-safe values
export const EXPENSE_CATEGORIES = [
  { value: "medical-services", label: "Medical Services", description: "..." },
  { value: "dental-care", label: "Dental Care", description: "..." },
  // ...
] as const satisfies readonly {
  value: ExpenseCategory  // Enforces value matches the type
  label: string
  description: string
}[]

// Step 4: Use with Zod - works perfectly!
export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES).nullish(),
})
```

## Helper Functions

```typescript
// Type-safe label lookup
export function getCategoryLabel(value: ExpenseCategory | undefined | null): string {
  if (!value) return "Uncategorized"
  return EXPENSE_CATEGORIES.find(c => c.value === value)?.label ?? value
}

// Type guard for validating unknown strings (CSV import, API input)
export function isValidCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    (EXPENSE_CATEGORY_VALUES as readonly string[]).includes(value)
  )
}
```

## Why This Works

1. **`as const`** - Tells TypeScript to infer literal types, not widen to `string[]`
2. **`typeof X[number]`** - Extracts union type from array element types
3. **`as const satisfies`** - Validates structure while preserving inference
4. **Separate values array** - `z.enum()` needs just the values, not metadata

## Benefits

- **Single source of truth** - Values, types, and metadata in one file
- **Compile-time safety** - Invalid categories caught at build time
- **Zero runtime overhead** - Const assertions are compile-time only
- **CSV import compatible** - `isValidCategory()` validates unknown strings
- **Zod integration seamless** - `z.enum(EXPENSE_CATEGORY_VALUES)` just works

## Anti-Patterns to Avoid

```typescript
// DON'T: Derive values from metadata array
const VALUES = CATEGORIES.map(c => c.value)  // Loses literal types!

// DON'T: Use regular array without 'as const'
const VALUES = ["a", "b", "c"]  // Type is string[], not literal tuple

// DON'T: Manually duplicate values
const VALUES = ["a", "b"] as const
const METADATA = [{ value: "a" }, { value: "c" }]  // "c" typo not caught!

// DO: Use 'satisfies' to validate metadata matches values
const METADATA = [...] as const satisfies { value: ExpenseCategory }[]
```

## Related

- Zod docs: [Enums](https://zod.dev/?id=enums)
- TypeScript: [const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- TypeScript: [satisfies operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
