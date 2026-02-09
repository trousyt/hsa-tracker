# Testing Conventions

This project uses [Vitest](https://vitest.dev/) for unit testing. Tests run in the `edge-runtime` environment.

## Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test -- --watch

# Run a specific test file
bun run test src/lib/dates.test.ts

# Run tests matching a pattern
bun run test -- -t "parseLocalDate"
```

## Test Location

Tests live **next to the code they test** in `src/` or `convex/`:

```
src/lib/currency.ts          → src/lib/currency.test.ts
src/lib/import-utils.ts      → src/lib/import-utils.test.ts
src/lib/dates.ts             → src/lib/dates.test.ts
```

The Vitest config (`vitest.config.ts`) includes both `convex/**/*.test.ts` and `src/**/*.test.ts`.

## Test Structure

Use `describe`/`it`/`expect` from Vitest. Group related tests under a `describe` block named after the function or module.

```typescript
import { describe, it, expect } from "vitest"
import { myFunction } from "./my-module"

describe("myFunction", () => {
  it("handles the normal case", () => {
    expect(myFunction("input")).toBe("expected")
  })

  it("handles edge case X", () => {
    expect(myFunction("")).toBeNull()
  })
})
```

### Naming Conventions

- `describe` block: Name of the exported function or logical group (e.g., `"parseLocalDate"`, `"CSV Parsing Tests"`)
- `it` block: Describe the **behavior**, not the implementation. Start with a verb: `"parses"`, `"returns"`, `"throws"`, `"handles"`, `"rejects"`.
- Use section comments (`// ============ Section ============`) to separate major test groups in longer files

### Test Data

- Use inline test data for simple cases
- For repeated test fixtures (e.g., mock expenses), define them as `const` at the top of the `describe` block
- Use `as Id<"tableName">` for Convex ID type assertions in test data

```typescript
const mockExpenses = [
  { _id: "exp1" as Id<"expenses">, datePaid: "2024-01-15", provider: "Dr. Smith", amountCents: 12500 },
  { _id: "exp2" as Id<"expenses">, datePaid: "2024-01-20", provider: "Pharmacy", amountCents: 4500 },
]
```

## What to Test

### Always test utility functions in `src/lib/`

Every exported function in `src/lib/` should have corresponding tests. These are pure functions with no React dependencies — the easiest to test.

**Priority areas:**
- **Data transformations** — currency conversion, date parsing/formatting, CSV parsing
- **Validation logic** — date validation, amount parsing, file type checks
- **Matching algorithms** — PDF-to-expense matching, fuzzy string matching

### Test patterns for two-format values

This codebase has values that exist in multiple formats (cents/dollars, ISO strings/Date objects). Test the **conversion boundaries**:

```typescript
// Round-trip: format(parse(x)) === x
it("round-trips correctly", () => {
  expect(formatLocalDate(parseLocalDate("2025-06-15"))).toBe("2025-06-15")
})

// Boundary: conversion at the edge
it("does not shift dates at timezone boundaries", () => {
  const date = parseLocalDate("2025-01-01")
  expect(date.getDate()).toBe(1)  // Not Dec 31
})
```

### Test edge cases explicitly

Name edge cases in the test description so they serve as documentation:

```typescript
it("parses leap day correctly", () => { ... })
it("rejects Feb 30 as invalid", () => { ... })
it("handles empty string input", () => { ... })
it("does not match when provider name is too short (< 4 chars)", () => { ... })
```

## Mocking

### When to mock

- **External APIs / fetch calls** — mock `global.fetch` with `vi.fn()`
- **Environment variables** — use `vi.stubGlobal()` for `import.meta.env`
- **Browser APIs** — mock `URL.createObjectURL`, `Blob`, etc. when needed

### When NOT to mock

- **Pure utility functions** — test them directly, no mocks
- **Convex schema/validators** — test behavior, not internal types
- **Other project utilities** — import and use the real implementation

### Mock pattern

```typescript
import { vi, beforeEach, afterEach } from "vitest"

describe("fetchSecureFile error handling", () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("throws on 401 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    await expect(fetchSecureFile("doc123", "token")).rejects.toThrow("Authentication required")
  })
})
```

## What NOT to Test (for now)

- **React components** — No React Testing Library / component tests currently. UI behavior is verified through browser automation (see CLAUDE.md Completion Checklist).
- **Convex mutations/queries** — Backend logic is tested through integration via the dev server, not unit tests.
- **shadcn/ui components** — Do not test upstream library components.

## Adding Tests for New Utilities

When creating a new utility file in `src/lib/`, always create a corresponding test file:

1. Create `src/lib/my-util.ts` with exported functions
2. Create `src/lib/my-util.test.ts` with tests
3. Run `bun run test` to confirm all tests pass
4. Add test file to the same commit as the utility

## Checklist for New Test Files

- [ ] Import from `vitest`: `describe`, `it`, `expect` (and `vi`, `beforeEach`, `afterEach` if mocking)
- [ ] Test file is co-located with the module it tests
- [ ] Each exported function has a `describe` block
- [ ] Normal cases, edge cases, and error cases are covered
- [ ] Two-format values have round-trip tests
- [ ] Test descriptions explain the **behavior**, not the implementation
- [ ] `bun run test` passes
