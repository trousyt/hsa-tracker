# Fix Responsive Display Issues — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 mobile responsive issues: expense dialog scrolling, toolbar overflow, chart button overflow, page title length, and OCR banner overflow.

**Architecture:** Pure CSS/Tailwind responsive changes across 6 files. No new components needed except a collapsible preview toggle in the expense dialog. Each fix is independent — order doesn't matter, but we start with the simplest changes and work up to the most complex (dialog).

**Tech Stack:** React, Tailwind CSS v4, shadcn/ui, Lucide icons

**Design doc:** `docs/plans/2026-03-03-fix-responsive-display-issues-design.md`

---

### Task 1: Shorten page title and reduce padding on mobile

**Files:**
- Modify: `src/App.tsx:75-79`

**Step 1: Update the title and padding**

In `src/App.tsx`, make two changes:

1. Line 75 — change `p-8` to `p-4 sm:p-8`:
```tsx
<div className="mx-auto max-w-6xl p-4 sm:p-8">
```

2. Line 78 — conditionally hide "Expense Tracker" on small screens:
```tsx
<h1 className="text-3xl font-bold">
  HSA<span className="hidden sm:inline"> Expense Tracker</span>
</h1>
```

**Step 2: Verify**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: All pass, no type errors.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix(responsive): shorten page title and reduce padding on mobile

Closes part of #9"
```

---

### Task 2: Fix OCR banner button overflow in expense detail sheet

**Files:**
- Modify: `src/components/expenses/expense-detail.tsx:207-232`

**Step 1: Update the OCR banner layout**

Change line 208 from:
```tsx
<div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
```
to:
```tsx
<div className="flex flex-col gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg sm:flex-row sm:items-center sm:justify-between">
```

This stacks the text and buttons vertically on mobile, side-by-side on `sm+`.

**Step 2: Verify**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/components/expenses/expense-detail.tsx
git commit -m "fix(responsive): stack OCR banner buttons on mobile

Closes part of #9"
```

---

### Task 3: Fix chart time range buttons overflow

Both chart components have identical layout structure for the header. Apply the same change to both.

**Files:**
- Modify: `src/components/dashboard/monthly-spending-chart.tsx:126`
- Modify: `src/components/dashboard/compounding-savings-chart.tsx:107`

**Step 1: Update monthly-spending-chart.tsx**

Change line 126 from:
```tsx
<div className="flex flex-row items-start justify-between gap-4">
```
to:
```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
```

This stacks title above buttons on mobile, restoring the side-by-side layout on `sm+`.

**Step 2: Update compounding-savings-chart.tsx**

Change line 107 from:
```tsx
<div className="flex flex-row items-start justify-between gap-4">
```
to:
```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
```

**Step 3: Verify**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/components/dashboard/monthly-spending-chart.tsx src/components/dashboard/compounding-savings-chart.tsx
git commit -m "fix(responsive): stack chart time range buttons below title on mobile

Closes part of #9"
```

---

### Task 4: Fix expense table toolbar overflow

**Files:**
- Modify: `src/components/expenses/expense-table.tsx:191-249`

**Step 1: Add filter toggle state**

At line 69 (after the `globalFilter` state), add:
```tsx
const [showFilters, setShowFilters] = useState(false)
```

Import `Filter` from lucide-react — update the import on line 30:
```tsx
import { Plus, Download, Upload, Search, Filter } from "lucide-react"
```

**Step 2: Restructure the toolbar**

Replace lines 192-249 (the toolbar section, from `<div className="space-y-4">` through the closing of the toolbar area, stopping before the table `<div className="rounded-md border">`) with:

```tsx
<div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-semibold">Expenses</h2>
    <div className="flex items-center gap-2 sm:gap-4">
      {/* Search - always visible */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search expenses..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-8 w-full sm:w-[200px]"
        />
      </div>

      {/* Filters toggle - mobile only */}
      <Button
        variant="outline"
        size="icon"
        className="md:hidden"
        onClick={() => setShowFilters((prev) => !prev)}
        aria-label="Toggle filters"
        aria-expanded={showFilters}
      >
        <Filter className="h-4 w-4" />
      </Button>

      {/* Filters and utility buttons - hidden on mobile, visible on md+ */}
      <Select
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
      >
        <SelectTrigger className="hidden md:flex w-[150px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="unreimbursed">Unreimbursed</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="reimbursed">Reimbursed</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={categoryFilter}
        onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
      >
        <SelectTrigger className="hidden md:flex w-[180px]">
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="uncategorized">Uncategorized</SelectItem>
          {EXPENSE_CATEGORIES.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={() => setShowImportWizard(true)} className="hidden md:inline-flex">
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <Button variant="outline" onClick={handleExport} className="hidden md:inline-flex">
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>

      {/* Add Expense - always visible */}
      <Button onClick={() => setCreateDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Add Expense</span>
        <span className="sm:hidden">Add</span>
      </Button>
    </div>
  </div>

  {/* Mobile filter row - shown when filter toggle is active */}
  {showFilters && (
    <div className="flex flex-wrap items-center gap-2 md:hidden">
      <Select
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="unreimbursed">Unreimbursed</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="reimbursed">Reimbursed</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={categoryFilter}
        onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="uncategorized">Uncategorized</SelectItem>
          {EXPENSE_CATEGORIES.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setShowImportWizard(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  )}
```

Keep the rest of the component (table, dialogs) unchanged.

**Step 3: Verify**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/components/expenses/expense-table.tsx
git commit -m "fix(responsive): hide filters behind toggle on mobile toolbar

Show only search and add expense on mobile. Filter toggle reveals
filters, import/export in a second row.

Closes part of #9"
```

---

### Task 5: Fix expense dialog — full-screen on mobile with collapsible preview

This is the most complex change. The dialog currently uses a centered, bounded dialog that doesn't scroll properly on mobile when the document preview is showing.

**Files:**
- Modify: `src/components/expenses/expense-dialog.tsx:358-580`

**Step 1: Add ChevronDown/ChevronUp import and preview toggle state**

Update the lucide-react import (line 7) to include `ChevronDown` and `ChevronUp`:
```tsx
import { Sparkles, Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
```

Add state for preview collapse after the existing state declarations (around line 77):
```tsx
const [previewCollapsed, setPreviewCollapsed] = useState(true)
```

Reset it in the `useEffect` that handles open/close (line 120-136). Add inside the `else` block:
```tsx
setPreviewCollapsed(true)
```

**Step 2: Update DialogContent for full-screen on mobile**

Change lines 361-364 from:
```tsx
<DialogContent
  className={cn(
    "p-0 gap-0 overflow-hidden max-h-[90vh]",
    showPreview ? "sm:max-w-5xl" : "sm:max-w-[425px]"
  )}
```
to:
```tsx
<DialogContent
  className={cn(
    "p-0 gap-0 overflow-hidden",
    "max-h-[100dvh] max-w-full rounded-none border-0 top-0 left-0 translate-x-0 translate-y-0",
    "md:max-h-[90vh] md:max-w-[calc(100%-2rem)] md:rounded-lg md:border md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%]",
    showPreview ? "md:max-w-5xl" : "md:max-w-[425px]"
  )}
```

This makes the dialog full-screen on mobile (`< md`), and restores the centered bounded dialog on `md+`.

**Step 3: Update the two-panel layout**

Change lines 386-389 from:
```tsx
<div className={cn(
  "flex flex-col overflow-y-auto",
  showPreview && "md:flex-row md:min-h-[500px] md:overflow-y-hidden"
)}>
```
to:
```tsx
<div className={cn(
  "flex flex-col h-[100dvh] md:h-auto overflow-y-auto",
  showPreview && "md:flex-row md:min-h-[500px] md:overflow-y-hidden"
)}>
```

**Step 4: Replace the preview panel with collapsible version on mobile**

Replace the entire preview section (lines 391-436) with:

```tsx
{/* Left Panel: Document Preview (60%) */}
{showPreview && (
  <>
    {/* Skip link for keyboard users */}
    <a
      href="#expense-form-panel"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:border focus:rounded focus:m-2"
    >
      Skip to expense form
    </a>

    {/* Mobile: collapsible preview toggle */}
    <button
      type="button"
      className="flex items-center justify-between w-full p-3 min-h-[44px] bg-muted/30 border-b text-sm font-medium md:hidden"
      onClick={() => setPreviewCollapsed((prev) => !prev)}
      aria-expanded={!previewCollapsed}
      aria-controls="preview-panel"
    >
      <span className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        View Receipt
      </span>
      {previewCollapsed ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      )}
    </button>

    <div
      id="preview-panel"
      role="region"
      aria-label="Document preview"
      className={cn(
        "border-b md:border-b-0 md:border-r bg-muted/30 overflow-auto",
        "md:h-auto md:w-3/5 md:block",
        previewCollapsed ? "hidden md:block" : "h-[40vh]"
      )}
    >
      {previewLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : previewBlobUrl ? (
        isImage ? (
          <img
            src={previewBlobUrl}
            alt={previewDocument?.filename ?? "Receipt"}
            className="w-full h-full object-contain p-2"
          />
        ) : isPdf ? (
          <iframe
            src={previewBlobUrl}
            title={previewDocument?.filename ?? "Receipt"}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-2" />
            <p className="text-sm">No preview for this file type</p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <FileText className="h-12 w-12 mb-2" />
          <p className="text-sm">Preview unavailable</p>
        </div>
      )}
    </div>
  </>
)}
```

**Step 5: Update the form panel**

Change lines 443-446 from:
```tsx
className={cn(
  "p-6 overflow-y-auto",
  showPreview ? "md:w-2/5 md:max-h-[80vh]" : "w-full"
)}
```
to:
```tsx
className={cn(
  "p-6 overflow-y-auto flex-1",
  showPreview ? "md:w-2/5 md:max-h-[80vh] md:flex-initial" : "w-full"
)}
```

Adding `flex-1` ensures the form panel fills remaining space after the collapsible preview on mobile. `md:flex-initial` restores the desktop behavior.

**Step 6: Verify**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: All pass.

**Step 7: Commit**

```bash
git add src/components/expenses/expense-dialog.tsx
git commit -m "fix(responsive): full-screen dialog on mobile with collapsible preview

On mobile, dialog goes full-screen with a 44px-tall 'View Receipt'
toggle bar. Preview is collapsed by default so form is immediately
usable. Desktop layout unchanged.

Closes #9"
```

---

### Task 6: Final verification

**Step 1: Run full verification**

```bash
bunx tsc --noEmit && bun run lint && bun run test
```

**Step 2: Run build**

```bash
bun run build
```

**Step 3: Manual testing (browser)**

Start dev server and test at phone (375x667), tablet (768x1024), and desktop (1280x800) breakpoints:

1. Dashboard: verify chart time range buttons stack below title on phone, stay beside on desktop
2. Expenses page: verify toolbar shows only search + add on phone, filter toggle reveals filters
3. Edit expense dialog: verify full-screen on phone, collapsible preview toggle works, form scrolls to save button
4. Expense details sheet: verify OCR banner buttons stack on phone
5. Page header: verify title shows "HSA" on phone, "HSA Expense Tracker" on desktop
6. Verify all desktop layouts are unchanged
