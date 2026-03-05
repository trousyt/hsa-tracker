---
title: "Polish notification UX: toast actions and soft-delete undo"
type: polish
status: completed
date: 2026-03-04
deepened: 2026-03-04
---

# Polish notification UX: toast actions and soft-delete undo

## Enhancement Summary

**Deepened on:** 2026-03-04
**Review agents used:** architecture-strategist, kieran-typescript-reviewer, julik-frontend-races-reviewer, data-integrity-guardian, performance-oracle, security-sentinel, code-simplicity-reviewer, Context7 (Sonner + Convex docs)

### Key Improvements from Original Plan
1. **Dropped `scheduledDeletionId`** — use `deletedAt` timestamp comparison for idempotency instead of storing/cancelling scheduled function IDs. Simpler schema, fewer mutations to maintain.
2. **Fixed critical race condition** — rapid delete/undo/delete cycles could cause premature permanent deletion. Fixed by passing `expectedDeletedAt` timestamp to the scheduled function.
3. **Fixed silent undo failure** — Sonner does not await async `onClick` handlers. Added explicit `.then()/.catch()` with follow-up toasts.
4. **Reduced scope** — 9 files instead of 11. Dropped `convex/documents.ts` edits and unnecessary mutation guards.

### New Considerations Discovered
- `onDelete` in column props must stay synchronous — parent handles async
- Auto-close `ExpenseDetail` requires `useEffect`, not inline render logic
- `permanentlyDelete` must NOT call `requireAuth` (no user session in scheduled functions)
- `expenses.update` and `expenses.acknowledgeOcr` also need soft-delete guards

## Overview

Two improvements to notification UX:

1. **Expense creation toast with "View" action** — After creating an expense, show a toast with a "View" button that opens the expense detail sheet
2. **Delete expense with soft-delete + undo** — Replace the hard-delete confirmation dialog with immediate soft delete, an "Undo" toast, and a 30-second recovery window via Convex scheduled functions

## Feature 1: Expense Creation Toast with "View" Action

### Approach

Add an `onCreated` callback prop to `ExpenseDialog`. When a new expense is created, the dialog calls `onCreated(expenseId)` instead of showing its own toast. The parent (`expense-table.tsx`) handles the toast with a "View" action button wired to `setViewExpenseId`.

### Changes

**`src/components/expenses/expense-dialog.tsx`**
- Add `onCreated?: (id: Id<"expenses">) => void` to the props interface (~line 40)
- In `handleSubmit` create branch: call `onCreated?.(expenseId)` right before `onOpenChange(false)`, after all side effects (document attach, OCR acknowledge) complete
- **Remove** the existing `toast.success("Expense created successfully")` — the parent now owns the toast. If `onCreated` is not provided, fall back to the plain toast.

**`src/components/expenses/expense-table.tsx`**
- Wire `onCreated` on the **create** `ExpenseDialog` instance only (not the edit instance):
  ```tsx
  onCreated={(id) => {
    toast.success("Expense created", {
      action: { label: "View", onClick: () => setViewExpenseId(id) },
    })
  }}
  ```
- This covers all three creation paths: manual, with receipt, and drag-and-drop (they all use the same `ExpenseDialog` instance)
- Batch import via `ImportWizard` is unaffected (different component, different toast)

### Research Insights

**Sonner action API** (from Context7 docs): The `action` property accepts `{ label: string, onClick: (event) => void }`. Clicking the action button **immediately dismisses the toast** and calls `onClick`. The `onClick` return value is ignored — Sonner does not await promises. This is fine for Feature 1 since `setViewExpenseId` is synchronous.

**Closure safety**: `setViewExpenseId` (from `useState`) is referentially stable for the component lifetime. The captured `id` is a plain string value. Both are safe in the toast closure for the default ~4 second toast duration.

### Edge Cases

- **Stale View action**: If the user navigates away from the Expenses tab before clicking "View", `setViewExpenseId` fires on an unmounted component — React 18 silently ignores it. Acceptable.
- **Convex cache latency**: If "View" is clicked before the Convex query cache updates, `ExpenseDetail` shows its skeleton loading state briefly. This already handles `undefined` gracefully.
- **Toast duration**: Use Sonner default (~4s). The user can always click the table row later.

## Feature 2: Soft-Delete with Undo Toast

### Approach

Replace the hard-delete confirmation dialog with:
1. Immediate soft delete (`deletedAt` timestamp set on the expense)
2. Convex scheduled function to permanently delete after 30 seconds
3. Toast with "Undo" button (10-second duration — timing is decoupled from server because the idempotency guard handles all races)
4. Undo simply clears `deletedAt` — no scheduled function cancellation needed

No confirmation dialog needed — the action is reversible.

### Schema Change

**`convex/schema.ts`** — Add one optional field to `expenses` table:

```typescript
deletedAt: v.optional(v.number()),  // Date.now() timestamp; undefined = not deleted
```

Optional, backward-compatible. Existing records have `undefined`.

> **Why no `scheduledDeletionId`?** The `permanentlyDelete` function uses timestamp comparison for idempotency (see below), making scheduled function cancellation unnecessary. The orphaned scheduled function fires harmlessly and returns — a trivial cost for a 30-second-delayed function that runs at most once per delete.

### Backend Changes

**`convex/expenses.ts`** — Replace the existing `remove` mutation and add two new mutations:

1. **`softDelete` mutation** (public — replaces `remove`):
   - Call `requireAuth(ctx)` and verify `expense.userId === userId`
   - Set `deletedAt = Date.now()` on the expense
   - Schedule permanent deletion: `await ctx.scheduler.runAfter(30_000, internal.expenses.permanentlyDelete, { id, expectedDeletedAt: now })`
   - Return `{ id }` for toast reference

   ```typescript
   export const softDelete = mutation({
     args: { id: v.id("expenses") },
     handler: async (ctx, args) => {
       const userId = await requireAuth(ctx)
       const expense = await ctx.db.get(args.id)
       if (!expense || expense.userId !== userId) throw new Error("Expense not found")
       if (expense.deletedAt) throw new Error("Expense already deleted")
       const now = Date.now()
       await ctx.db.patch(args.id, { deletedAt: now })
       await ctx.scheduler.runAfter(30_000, internal.expenses.permanentlyDelete, {
         id: args.id,
         expectedDeletedAt: now,
       })
       return { id: args.id }
     },
   })
   ```

2. **`undoSoftDelete` mutation** (public):
   - Call `requireAuth(ctx)` and verify ownership
   - Verify `deletedAt` is set (guard against double-undo)
   - Clear `deletedAt` via `ctx.db.patch(id, { deletedAt: undefined })`
   - The orphaned scheduled function will fire later and no-op (timestamp mismatch)

   ```typescript
   export const undoSoftDelete = mutation({
     args: { id: v.id("expenses") },
     handler: async (ctx, args) => {
       const userId = await requireAuth(ctx)
       const expense = await ctx.db.get(args.id)
       if (!expense || expense.userId !== userId) throw new Error("Expense not found")
       if (!expense.deletedAt) return // Already restored, no-op
       await ctx.db.patch(args.id, { deletedAt: undefined })
     },
   })
   ```

3. **`permanentlyDelete` internal mutation** (scheduled):
   - **No `requireAuth`** — scheduled functions run without user session context. Auth was enforced at the `softDelete` entry point.
   - **Timestamp-based idempotency guard**: If expense doesn't exist, or `expense.deletedAt !== args.expectedDeletedAt`, return early. This handles:
     - Undo race: `deletedAt` was cleared → `undefined !== T1` → no-op
     - Rapid delete/undo/delete: old job sees `T2 !== T1` → no-op; new job sees `T2 === T2` → proceeds
   - Cascade-delete all reimbursements via `by_expense` index (same as current `remove`)
   - Delete the expense record
   - Do NOT delete associated documents (matches current behavior)
   - Convex mutations are fully atomic — if any delete fails, the entire mutation rolls back

   ```typescript
   export const permanentlyDelete = internalMutation({
     args: { id: v.id("expenses"), expectedDeletedAt: v.number() },
     handler: async (ctx, args) => {
       const expense = await ctx.db.get(args.id)
       if (!expense || expense.deletedAt !== args.expectedDeletedAt) return
       // Cascade-delete reimbursements
       const reimbursements = await ctx.db
         .query("reimbursements")
         .withIndex("by_expense", (q) => q.eq("expenseId", args.id))
         .collect()
       for (const r of reimbursements) {
         await ctx.db.delete(r._id)
       }
       await ctx.db.delete(args.id)
     },
   })
   ```

4. **Remove the old `remove` mutation** from the public API. If `dev.clearAllData` needs hard delete, it can inline that logic directly (it already does `ctx.db.delete`).

### Query Filtering

Add soft-delete filtering to user-facing queries. Use JS-level filtering (consistent with existing `status`/`category` filtering pattern):

```typescript
expenses = expenses.filter((e) => e.deletedAt === undefined)
```

For `expenses.get` (direct `ctx.db.get` lookup), add to the existing ownership check:

```typescript
if (!expense || expense.userId !== userId || expense.deletedAt) return null
```

| File | Query | Approach |
|------|-------|----------|
| `convex/expenses.ts` | `list` | JS filter after `.collect()` |
| `convex/expenses.ts` | `get` | Field check after `ctx.db.get()` |
| `convex/expenses.ts` | `listWithOcrStatus` | JS filter after `.collect()` |
| `convex/expenses.ts` | `getSummary` | JS filter after `.collect()` |
| `convex/charts.ts` | `getChartData` | JS filter after `.collect()` |
| `convex/optimizer.ts` | `findOptimal` | JS filter after `.collect()` |

**Do NOT filter** in admin queries (`dev.clearAllData`).

> **Why no compound index?** A `["userId", "deletedAt"]` index would be premature. Soft-deleted records exist for only ~30 seconds, and the dataset is small (hundreds per user). The existing in-memory filter pattern is appropriate.

### Related Mutation Guards

Add `deletedAt` check to mutations that could create or modify financial records against a soft-deleted expense. Add `|| expense.deletedAt` to the existing ownership check:

```typescript
if (!expense || expense.userId !== userId || expense.deletedAt) {
  throw new Error("Expense not found")
}
```

**Must guard:**
- `expenses.update` — prevents editing a soft-deleted expense
- `expenses.acknowledgeOcr` — prevents OCR acknowledgment on soft-deleted expense
- `reimbursements.record` — prevents creating reimbursement against soft-deleted expense
- `reimbursements.recordFull` — same as above

**Skip guards (acceptable risk):**
- `reimbursements.undo` — operates on the reimbursement itself; if expense is permanently deleted, `ctx.db.get` returns null and throws naturally
- `documents.addToExpense` / `documents.removeFromExpense` — no realistic UI path to trigger during the soft-delete window, and documents aren't cascade-deleted anyway

### Frontend Changes

**`src/components/expenses/expense-table.tsx`**:
- Add `useMutation(api.expenses.softDelete)` and `useMutation(api.expenses.undoSoftDelete)`
- Keep `onDelete` in column props as **synchronous** `(expense: Expense) => void`. The parent handles the async logic via fire-and-forget with error handling:
  ```tsx
  const handleSoftDelete = async (expense: Expense) => {
    try {
      await softDelete({ id: expense._id })
      toast("Deleted " + expense.provider + " — " + formatCurrency(expense.amountCents), {
        action: {
          label: "Undo",
          onClick: () => {
            undoSoftDelete({ id: expense._id })
              .then(() => toast.success("Expense restored"))
              .catch(() => toast.error("Failed to undo — expense was permanently deleted"))
          },
        },
        duration: 10_000,
      })
    } catch {
      toast.error("Failed to delete expense")
    }
  }

  // In getExpenseColumns:
  onDelete: (expense) => void handleSoftDelete(expense)
  ```
- Add `softDelete` and `undoSoftDelete` to the `useMemo` dependency array for `columns` (even though Convex mutation refs are stable, it documents intent and prevents future refactor bugs)
- Remove `deleteExpense` state variable
- Remove `DeleteExpenseDialog` lazy import and Suspense boundary
- Remove `DeleteExpenseDialog` render block

> **Why `.then()/.catch()` on undo?** Sonner does not await async `onClick` handlers — it immediately dismisses the toast and ignores the returned Promise. Without explicit error handling, a failed undo mutation would be silent. The follow-up toast pattern provides clear user feedback.

**`src/components/expenses/expense-columns.tsx`**:
- `onDelete` type stays as `(expense: Expense) => void` (unchanged — the parent uses `void` keyword to fire-and-forget)

**`src/components/expenses/delete-expense-dialog.tsx`**:
- Delete this file entirely

**`src/components/expenses/expense-detail.tsx`**:
- Add a `useEffect` to auto-close the sheet when a previously-loaded expense becomes `null` (soft-deleted):
  ```tsx
  useEffect(() => {
    if (expenseId && expense === null) {
      onOpenChange(false)
    }
  }, [expenseId, expense, onOpenChange])
  ```
- Note: `expense === null` (not found/deleted) vs `expense === undefined` (still loading). The strict equality `=== null` ensures we don't close during initial load.

### Edge Cases

- **User closes tab**: Scheduled function fires server-side regardless. Permanent delete happens as expected.
- **Rapid delete/undo/delete cycles**: Each `softDelete` sets a new `deletedAt` timestamp and schedules a new job with that timestamp. When the first job fires, it sees `expense.deletedAt !== expectedDeletedAt` (the re-delete set a newer timestamp) and no-ops. The second job fires with the correct timestamp and proceeds. **No data loss.**
- **Multiple simultaneous deletes**: Each expense gets its own toast with its own Undo button. Sonner shows max 3 visible (default `visibleToasts`). Queued toasts continue counting down while not visible.
- **Create then immediately delete**: Both toasts visible. If user clicks "View" on creation toast after soft-deleting, `expenses.get` returns `null` and the `useEffect` auto-closes the detail sheet.
- **Undo after permanent delete**: If user somehow calls `undoSoftDelete` after the expense was permanently deleted, `ctx.db.get` returns `null` and the mutation throws "Expense not found". The `.catch()` handler shows "Failed to undo — expense was permanently deleted".
- **`permanentlyDelete` atomicity**: Convex mutations are transactional. If any delete in the cascade loop fails, the entire mutation rolls back. No partial cascade.
- **Orphaned documents**: Documents are intentionally NOT cascade-deleted (receipts have independent value in an HSA tracker). After permanent deletion, documents remain accessible in the documents list.

## Acceptance Criteria

### Feature 1
- [x] After creating an expense, toast shows "Expense created" with a "View" action button
- [x] Clicking "View" opens the expense detail sheet for the new expense
- [x] No duplicate toasts (old plain toast removed from dialog)
- [x] Works for manual creation, receipt upload, and drag-and-drop creation
- [x] `onCreated` callback only fires on create path, not edit path

### Feature 2
- [x] Clicking "Delete" on an expense row immediately soft-deletes (no confirmation dialog)
- [x] Toast appears with expense info and "Undo" button (10s duration)
- [x] Clicking "Undo" restores the expense to the list with success feedback toast
- [x] Failed undo shows error toast
- [x] Soft-deleted expenses excluded from all user-facing queries and summary stats
- [x] After 30 seconds, scheduled function permanently deletes expense + reimbursements
- [x] Documents are NOT cascade-deleted
- [x] `permanentlyDelete` uses timestamp comparison for idempotency (safe against all race conditions)
- [x] Expense mutations (`update`, `acknowledgeOcr`, `record`, `recordFull`) reject soft-deleted expenses
- [x] `DeleteExpenseDialog` component removed, no dead code
- [x] ExpenseDetail auto-closes via `useEffect` if the viewed expense is soft-deleted

### Tests
- [x] Soft delete sets `deletedAt` and schedules permanent deletion
- [x] Undo clears `deletedAt`; orphaned scheduled function no-ops (timestamp mismatch)
- [x] Permanent delete cascade-deletes reimbursements but not documents
- [x] Permanent delete no-ops if `deletedAt` doesn't match `expectedDeletedAt`
- [x] Permanent delete no-ops if expense was already restored (deletedAt undefined)
- [x] Soft-deleted expenses excluded from list, get, listWithOcrStatus, getSummary queries
- [x] `expenses.update` rejects soft-deleted expenses
- [x] `reimbursements.record` rejects soft-deleted expenses
- [x] Double soft-delete throws "Expense already deleted"
- [x] Double undo is a no-op (not an error)

## Implementation Order

1. Feature 1 (toast View action) — frontend-only, no backend changes
2. Feature 2 schema change — add `deletedAt` field
3. Feature 2 backend — `softDelete`, `undoSoftDelete`, `permanentlyDelete` mutations; query filters; mutation guards; remove old `remove` mutation
4. Feature 2 frontend — remove dialog, wire soft delete + undo toast, add auto-close effect
5. Feature 2 cleanup — delete `delete-expense-dialog.tsx`
6. Tests for both features

## Files Changed

| File | Action | Feature |
|------|--------|---------|
| `src/components/expenses/expense-dialog.tsx` | Edit | 1 |
| `src/components/expenses/expense-table.tsx` | Edit | 1, 2 |
| `src/components/expenses/expense-detail.tsx` | Edit | 2 |
| `src/components/expenses/delete-expense-dialog.tsx` | Delete | 2 |
| `convex/schema.ts` | Edit | 2 |
| `convex/expenses.ts` | Edit | 2 |
| `convex/charts.ts` | Edit | 2 |
| `convex/optimizer.ts` | Edit | 2 |
| `convex/reimbursements.ts` | Edit | 2 |
