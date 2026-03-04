---
title: "Vitest @convex Path Alias Not Resolving in src/ Tests"
category: test-infrastructure
tags:
  - vitest
  - tsconfig
  - path-aliases
  - convex
  - module-resolution
module: src/lib
symptom: |
  Test files in src/ that import from @convex/* fail with:
  Error: Cannot find package '@convex/lib/constants'
  The import works in application code and in convex/ test files.
root_cause: |
  vitest.config.ts resolve.alias did not include the @convex mapping.
  Vitest does NOT inherit tsconfig.json "paths" — aliases must be
  explicitly configured in both files independently.
---

# Vitest @convex Path Alias Not Resolving in src/ Tests

## Symptom

A test file in `src/lib/constants/file-types.test.ts` that imported from `@convex/lib/constants` failed:

```
Error: Cannot find package '@convex/lib/constants' imported from
'src/lib/constants/file-types.test.ts'
```

The same `@convex/*` import worked in application code (`*.tsx` files) and TypeScript showed no errors.

## Root Cause

`tsconfig.json` defines the path alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@convex/*": ["./convex/*"]
    }
  }
}
```

But `vitest.config.ts` only had the `@` alias:

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    // @convex was MISSING
  },
},
```

**Vitest does not automatically read tsconfig.json paths.** Each alias must be explicitly added to `vitest.config.ts`. Application code worked because Vite's own config (or the TypeScript plugin) resolved the paths, but the test runner uses a separate resolution chain.

## Solution

Add the `@convex` alias to `vitest.config.ts`:

```typescript
// vitest.config.ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@convex": path.resolve(__dirname, "./convex"),
  },
},
```

## Why This Matters

Without this fix, no `src/` test file can import from the `convex/` directory using the `@convex` alias. This blocks cross-boundary tests like validating that frontend constants stay in sync with backend constants — exactly the kind of test that catches config drift bugs.

## Prevention

1. **When adding a tsconfig path alias, always add it to vitest.config.ts too.** These are independent config files that must be kept in sync manually.
2. **The `file-types.test.ts` cross-import test acts as a canary** — if the alias breaks, this test will fail immediately.
3. Consider adding a comment in `tsconfig.json` near the `paths` section:
   ```json
   // Keep in sync with vitest.config.ts resolve.alias
   ```

## Related

- [`docs/solutions/build-errors/tsc-checking-convex-files.md`](../build-errors/tsc-checking-convex-files.md) — Another frontend/backend boundary issue with separate tsconfig files
- [`docs/testing-conventions.md`](../../testing-conventions.md) — Project testing guide
