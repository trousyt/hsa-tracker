# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Start development server (frontend + Convex)
bun run dev          # Start Vite dev server
bunx convex dev      # Start Convex dev server (run in separate terminal)

# Build for production
bun run build

# Type check
bunx tsc --noEmit

# Push Convex schema/functions
bunx convex dev --once

# Add new shadcn component
bunx shadcn@latest add <component-name>

# Verify changes (run after every code change)
bunx tsc --noEmit && bun run lint && bun run test 

# Verify build (run right before commit)
bun run build
```

**Important:** After every code change, run lint, test, and build to confirm changes work correctly.

## Completion Checklist

Before considering a feature or fix complete, run browser automation checks (Claude in Chrome) against the running dev server at `http://localhost:5173`:

1. **Functionality**: Verify the feature works end-to-end (click through flows, submit forms, check state updates)
2. **Design fidelity**: Take screenshots and zoom into key UI elements to confirm layout, spacing, and visual quality
3. **Accessibility**: Inspect the accessibility tree (`read_page`), verify all interactive elements have accessible names, check `aria-live` regions update, test keyboard navigation (Tab/Enter), and confirm visible focus indicators
4. **Responsive design**: Use `resize_window` to test at phone (375x667), tablet (768x1024), and desktop (1280x800) breakpoints. Verify layouts adapt correctly and nothing overflows or becomes unusable

## Project Architecture

This is an HSA (Health Savings Account) expense tracking application.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite
- UI Components: shadcn/ui + Tailwind CSS v4
- Backend: Convex (real-time database + file storage)
- Forms: React Hook Form + Zod validation
- Tables: TanStack Table

**Key Directories:**
- `src/components/ui/` - shadcn/ui components (do not edit directly, use `bunx shadcn add`)
- `src/components/expenses/` - Expense CRUD components
- `src/components/documents/` - Document upload and viewing
- `src/components/reimbursements/` - Reimbursement tracking
- `src/components/optimizer/` - Reimbursement optimizer
- `src/components/dashboard/` - Dashboard and summary views
- `src/lib/` - Utilities (currency, compression, validation schemas)
- `convex/` - Backend functions and schema

**Data Model:**
- All monetary amounts stored as integer cents (not floating point)
- Use `dollarsToCents()` / `centsToDollars()` from `src/lib/currency.ts`
- Documents stored using Convex file storage with three-step pattern

## Conventions

- Use shadcn/ui components from `@/components/ui/*`
- Use path alias `@/` for imports from `src/`
- Currency: Store as cents, use `formatCurrency(cents)` for DB values, `formatDollars(dollars)` for form values
- Dates: Store as ISO strings (YYYY-MM-DD), use `parseLocalDate()` / `formatLocalDate()` / `displayLocalDate()` from `src/lib/dates.ts` for timezone-safe handling
- Toasts: Use Sonner via `toast.success()`, `toast.error()`
- Forms: Use React Hook Form with Zod resolver for validation
- Mutations/Queries: Import from `convex/_generated/api`
- **Docstrings:** Add JSDoc comments to functions, especially Convex mutations/queries and exported utilities
- **Accessibility**: All interactive elements must have accessible names (`aria-label` or visible text). Use `role`, `aria-live`, and `aria-hidden` appropriately. Ensure visible focus indicators on all focusable elements. Decorative elements should have `aria-hidden="true"`.

## Testing

See [`docs/testing-conventions.md`](docs/testing-conventions.md) for full testing guide.

- **Framework:** Vitest with `edge-runtime` environment
- **Location:** Tests live next to the code they test (e.g., `src/lib/dates.ts` → `src/lib/dates.test.ts`)
- **Required:** Every new utility in `src/lib/` must have a corresponding `.test.ts` file
- **Run:** `bun run test` (included in the verify command above)
- **Key patterns:** Round-trip tests for two-format values, explicit edge case coverage, mock `global.fetch` for external calls

## Safety Rules

**Never run destructive operations without explicit permission.** This includes:
- `bunx convex run dev:clearAllData` or any data deletion mutations
- Database migrations that drop or truncate tables
- `git reset --hard`, `git clean -f`, or other commands that discard changes
- Deleting files or directories

When implementing destructive functionality: write the code, push/deploy it, then **stop and wait** for the user to decide when to run it.

## User Preferences

- **Ask for information instead of using placeholders.** When you need specific information (URLs, credentials, names, etc.), ask the user directly rather than inserting placeholders or leaving manual steps.

## Plans

Plans are stored in `docs/plans/` using the format:
```
YYYY-MM-DD-{type}-{description}-plan.md
```
Where `{type}` is one of: `feat`, `fix`, `refactor`, `polish`, etc.

## Key Patterns

**Creating a new expense form:**
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { api } from "convex/_generated/api"
```

**File upload pattern:**
1. `generateUploadUrl()` - Get signed URL from Convex
2. `fetch(url, { method: "POST", body: file })` - Upload file
3. `saveDocument({ storageId, ... })` - Save document record

## Currency Handling in Forms

**Two-format rule:** Values exist in two formats:
- **Database**: Integer cents (2550 = $25.50)
- **Forms**: Decimal dollars (25.50)

**Display functions:**
- `formatCurrency(cents)` - For database values (converts internally)
- `formatDollars(dollars)` - For form values or already-converted amounts

**Conversion boundaries:**
- Form → Database: `dollarsToCents(formValue)`
- Database → Form: `centsToDollars(dbValue)`

**Common mistake:**
```typescript
// ❌ WRONG - formatCurrency expects cents, not dollars
formatCurrency(centsToDollars(expense.amountCents))

// ✓ CORRECT
formatCurrency(expense.amountCents)  // OR
formatDollars(centsToDollars(expense.amountCents))
```

## Form Field Wiring Checklist

When adding fields to dialog-wrapped forms, ensure all sync points:

- [ ] Zod schema in `src/lib/validations/*.ts`
- [ ] Form JSX in form component
- [ ] Dialog prop type definition
- [ ] Dialog `defaultValues` construction
- [ ] Dialog create mutation call
- [ ] Dialog update mutation call
- [ ] Backend mutation validator in `convex/*.ts`

See: `docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md`

## null vs undefined for Optional Fields

**Frontend (Zod):**
- `.nullish()` = accepts undefined, null, or value (use for clearable fields)

**Backend (Convex):**
- `v.optional(v.string())` = undefined or string (rejects null!)
- `v.optional(v.union(v.string(), v.null()))` = undefined, null, or string

**Pattern for clearable fields:**
```typescript
// Frontend passes
category: data.category ?? null  // undefined → null

// Backend accepts
category: v.optional(v.union(v.string(), v.null()))
```

**Pattern for non-clearable fields:**
```typescript
// Frontend passes
comment: data.comment || undefined  // empty/null → undefined

// Backend accepts
comment: v.optional(v.string())
```
