---
title: "Currency Display Using Wrong Format Function"
category: logic-errors
tags: [currency, formatting, cents, dollars, display]
module: currency-handling
symptoms:
  - "Dollar amounts display as 100x their actual value"
  - "Amount shows $2550.00 instead of $25.50"
  - "Currency formatting looks correct but values are wrong"
root_cause: "formatCurrency() called with dollars when it expects cents"
date: 2026-02-05
---

# Currency Display Using Wrong Format Function

## Problem

When displaying OCR-extracted amounts in diff indicators, values appeared as 100x their actual value. An expense of $25.50 displayed as "$2550.00" in the OCR comparison tooltip.

**Observed behavior:**
1. OCR extracts amount as `25.50` (dollars, decimal format)
2. Diff indicator displays "$2550.00"
3. No errors in console

## Root Cause

The codebase has two currency display functions with different expectations:

```typescript
// formatCurrency expects CENTS (integer)
formatCurrency(2550)  // → "$25.50"

// formatDollars expects DOLLARS (decimal)
formatDollars(25.50)  // → "$25.50"
```

The bug occurred because OCR values are already in dollars, but `formatCurrency()` was used:

```typescript
// ❌ WRONG - formatCurrency expects cents, not dollars
const ocrAmount = 25.50  // Already in dollars from OCR
formatCurrency(ocrAmount)  // Treats 25.50 as cents → "$2550.00"

// ✓ CORRECT
formatDollars(ocrAmount)  // → "$25.50"
```

## Why This Happens

Values exist in two formats throughout the app:

| Source | Format | Example |
|--------|--------|---------|
| Database | Integer cents | `2550` |
| Form inputs | Decimal dollars | `25.50` |
| OCR extraction | Decimal dollars | `25.50` |
| API responses | Usually cents | `2550` |

The confusion arises at boundaries where formats change:
- `centsToDollars()` converts database → form
- `dollarsToCents()` converts form → database
- Display functions must match the format they receive

## Solution

Match the display function to the value format:

```typescript
// Database value (cents) → formatCurrency
formatCurrency(expense.amountCents)  // ✓

// Form/OCR value (dollars) → formatDollars
formatDollars(ocrValues.amount)  // ✓

// Double conversion (common mistake)
formatCurrency(centsToDollars(expense.amountCents))  // ❌ Wrong!
formatDollars(centsToDollars(expense.amountCents))   // ✓ Correct
```

## Prevention

### Check the variable's origin

Before formatting, trace where the value comes from:

1. **From database (convex query)?** → It's cents → use `formatCurrency()`
2. **From form state?** → It's dollars → use `formatDollars()`
3. **From OCR/external source?** → Usually dollars → use `formatDollars()`
4. **After `centsToDollars()` conversion?** → It's dollars → use `formatDollars()`

### Naming convention

Use consistent suffixes to make format obvious:

```typescript
const amountCents = expense.amountCents        // Cents (integer)
const amountDollars = centsToDollars(amountCents)  // Dollars (decimal)

formatCurrency(amountCents)   // ✓ Clear
formatDollars(amountDollars)  // ✓ Clear
```

### Type safety (future improvement)

Consider branded types to catch mismatches at compile time:

```typescript
type Cents = number & { __brand: 'cents' }
type Dollars = number & { __brand: 'dollars' }

function formatCurrency(cents: Cents): string
function formatDollars(dollars: Dollars): string
```

## Related

- `src/lib/currency.ts` - Currency utility functions
- `docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md` - Form data flow issues
