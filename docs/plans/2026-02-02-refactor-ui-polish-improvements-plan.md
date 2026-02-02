---
title: UI Polish Improvements
type: refactor
date: 2026-02-02
---

# UI Polish Improvements

Polish pass to improve loading UX, fix spacing issues, and evaluate form library alignment.

## Acceptance Criteria

### 1. Form Library Decision (No Migration)

- [x] Document decision: **Stay with React Hook Form**
  - TanStack Form is stable (v1.28.0) but migration cost outweighs benefits
  - Current RHF 7.71 + Zod setup works well, shadcn/ui form.tsx is RHF-based
  - Simple 4-5 field forms don't benefit from TanStack Form's advanced composition
  - Revisit if shadcn/ui officially switches default form implementation

### 2. Skeleton Loading States (Everywhere)

Add shadcn skeleton component and implement consistent loading states:

- [x] Add skeleton component: `bunx shadcn@latest add skeleton`
- [x] `expense-table.tsx` - Table skeleton (5 rows matching column structure)
- [x] `expense-detail.tsx` - Sheet content skeleton when `expense === undefined`
- [x] `document-gallery.tsx` - Image placeholder skeletons during load
- [x] `reimbursement-history.tsx` - List item skeletons
- [x] `optimizer.tsx` - Card skeleton matching dashboard pattern

**Pattern to follow** (from `dashboard.tsx`):
```tsx
if (data === undefined) {
  return (
    <div className="...">
      <Skeleton className="h-X w-Y" />
    </div>
  )
}
```

### 3. Sheet Content Spacing Fix

Fix whitespace/margin in SheetContent body area:

- [x] Add `SheetBody` component to `src/components/ui/sheet.tsx`:
  ```tsx
  function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
    return (
      <div
        data-slot="sheet-body"
        className={cn("flex-1 overflow-y-auto px-4 pb-4", className)}
        {...props}
      />
    )
  }
  ```
- [x] Export `SheetBody` from sheet.tsx
- [x] Update `expense-detail.tsx` to use `<SheetBody>` instead of `<div className="mt-6 space-y-4">`

### 4. Browser Testing

Test all pages using browser automation: **SKIPPED** - browser automation tools not available

- [ ] Dashboard tab - skeleton loads, cards render, responsive grid
- [ ] Expenses tab - table loads, sorting, filtering, row click opens sheet
- [ ] Expense dialog - create, edit, validation errors
- [ ] Expense detail sheet - opens smoothly, tabs switch, scroll works
- [ ] Documents tab - upload, preview, delete
- [ ] Reimbursements tab - form submit, quick reimburse, history
- [ ] Optimizer tab - input, calculate, results display
- [ ] Responsive breakpoints (375px, 768px, 1280px)

**Manual verification recommended** - throttle network in DevTools to see skeletons

## Context

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/ui/sheet.tsx` | Add SheetBody component |
| `src/components/ui/skeleton.tsx` | New file (via shadcn CLI) |
| `src/components/expenses/expense-table.tsx` | Add table skeleton |
| `src/components/expenses/expense-detail.tsx` | Add sheet skeleton, use SheetBody |
| `src/components/documents/document-gallery.tsx` | Add image skeletons |
| `src/components/reimbursements/reimbursement-history.tsx` | Add list skeletons |
| `src/components/optimizer/optimizer.tsx` | Add card skeleton |

**TanStack Form vs React Hook Form Summary:**
- TanStack Form v1 is production-ready (May 2025 stable release)
- Better TypeScript inference but RHF 7.71 is adequate
- shadcn/ui supports both, but defaults to RHF
- Migration would touch 4 files - not worth it for simple forms
- **Decision: Keep React Hook Form**, monitor shadcn/ui direction

## References

- shadcn/ui Skeleton: https://ui.shadcn.com/docs/components/skeleton
- TanStack Form docs: https://tanstack.com/form/latest
- Current form implementation: `src/components/ui/form.tsx`
