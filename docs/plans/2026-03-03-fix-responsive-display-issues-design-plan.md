# Responsive Display Issues — Design Document

**Issue:** [#9 — Responsive display issues](https://github.com/trousyt/hsa-tracker/issues/9)
**Date:** 2026-03-03
**Status:** Approved

## Problem Statement

Multiple UI elements break on mobile viewports (iPhone ~375px width):

1. Edit expense dialog can't scroll — document preview pushes form off-screen
2. Expense page toolbar overflows — 6 elements don't fit narrow screens
3. Dashboard chart time range buttons spill out of card
4. Page title "HSA Expense Tracker" too long on mobile
5. OCR banner buttons overflow in expense details sheet

## Design

### 1. Edit Expense Dialog — Full-screen on mobile with collapsible preview

**Mobile (`< md`):**
- Dialog becomes full-screen: `h-[100dvh]`, `max-w-full`, positioned at `top-0 left-0` (no centering transform)
- Document preview wrapped in a collapsible section, **collapsed by default**
- Toggle bar: full-width, min 44px height, shows "View Receipt" label with chevron icon — large tap target for mobile
- Form area gets `overflow-y-auto` and `flex-1` to fill remaining space and scroll freely
- Dialog footer (save/cancel) stays pinned at the bottom

**Desktop (`md+`):** No changes — keeps current side-by-side layout.

**File:** `src/components/expenses/expense-dialog.tsx`

### 2. Expense Page Toolbar — Responsive visibility

**Mobile (`< md`):**
- Show only Search (full-width) and Add Expense button
- Filters (status, category) and utility buttons (import, export) hidden with `hidden md:flex`
- Add a mobile-only "Filters" toggle button (`md:hidden`) that reveals filters in a row below when tapped
- Search input changes from `w-[200px]` to `w-full md:w-[200px]`

**Desktop (`md+`):** No changes.

**File:** `src/components/expenses/expense-table.tsx`

### 3. Chart Time Range Buttons — Stack below title on mobile

**Mobile (`< sm`):**
- CardHeader layout changes from `flex-row` to `flex-col`
- Time range buttons render below the title/value block at full width
- Keeps `sm:flex-row sm:items-start sm:justify-between` for wider screens

**Desktop (`sm+`):** No changes — buttons stay beside title.

**Files:**
- `src/components/dashboard/monthly-spending-chart.tsx`
- `src/components/dashboard/compounding-savings-chart.tsx`

### 4. Page Title — Shorten on mobile

- Title becomes: `HSA<span className="hidden sm:inline"> Expense Tracker</span>`
- Page container padding: `p-4 sm:p-8` (reduce padding on mobile)

**File:** `src/App.tsx`

### 5. OCR Banner — Stack buttons below text on mobile

- Banner layout: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
- On mobile: icon + text on first row, buttons on second row
- Buttons remain `flex gap-2`

**File:** `src/components/expenses/expense-detail.tsx`

## Files Affected

| File | Change |
|------|--------|
| `src/components/expenses/expense-dialog.tsx` | Full-screen mobile layout, collapsible preview |
| `src/components/expenses/expense-table.tsx` | Responsive toolbar with filter toggle |
| `src/components/expenses/expense-detail.tsx` | OCR banner stacking on mobile |
| `src/components/dashboard/monthly-spending-chart.tsx` | Time range buttons below title on mobile |
| `src/components/dashboard/compounding-savings-chart.tsx` | Time range buttons below title on mobile |
| `src/App.tsx` | Shortened title, reduced padding on mobile |
