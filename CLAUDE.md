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
```

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
- Currency: Always store as cents, display with `formatCurrency()`
- Dates: Store as ISO strings (YYYY-MM-DD), use date-fns for formatting
- Toasts: Use Sonner via `toast.success()`, `toast.error()`
- Forms: Use React Hook Form with Zod resolver for validation
- Mutations/Queries: Import from `convex/_generated/api`

## Safety Rules

**Never run destructive operations without explicit permission.** This includes:
- `bunx convex run dev:clearAllData` or any data deletion mutations
- Database migrations that drop or truncate tables
- `git reset --hard`, `git clean -f`, or other commands that discard changes
- Deleting files or directories

When implementing destructive functionality: write the code, push/deploy it, then **stop and wait** for the user to decide when to run it.

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
