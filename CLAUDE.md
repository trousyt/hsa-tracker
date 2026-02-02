# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start development server (frontend + Convex)
npm run dev          # Start Vite dev server
npx convex dev       # Start Convex dev server (run in separate terminal)

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Push Convex schema/functions
npx convex dev --once
```

## Project Architecture

This is an HSA (Health Savings Account) expense tracking application.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite
- UI Components: shadcn/ui + Tailwind CSS v4
- Backend: Convex (real-time database + file storage)
- Forms: React Hook Form + Zod validation

**Key Directories:**
- `src/components/ui/` - shadcn/ui components (do not edit directly, use `npx shadcn add`)
- `src/components/expenses/` - Expense CRUD components
- `src/lib/` - Utilities (currency formatting, validation schemas)
- `convex/` - Backend functions and schema

**Data Model:**
- All monetary amounts stored as integer cents (not floating point)
- Use `dollarsToCents()` / `centsToDollars()` from `src/lib/currency.ts`

## Conventions

- Use shadcn/ui components from `@/components/ui/*`
- Use path alias `@/` for imports from `src/`
- Currency: Always store as cents, display with `formatCurrency()`
- Dates: Store as ISO strings (YYYY-MM-DD), use date-fns for formatting
