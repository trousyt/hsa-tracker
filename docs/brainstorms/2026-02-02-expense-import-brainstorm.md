# Expense Import Feature Brainstorm

**Date:** 2026-02-02
**Status:** Ready for planning

## What We're Building

A dedicated import page (`/import`) with a step-by-step wizard to migrate historical expense data from Excel, with automatic PDF document matching.

### User Story

As a user migrating from Excel-based tracking, I want to import my historical expenses and attach my saved PDF receipts in bulk, so I can consolidate all my HSA data in one place without manual data entry.

## Context

- **Source data:** Excel spreadsheet with columns: Date, Paid To, Amount, Comment
- **Volume:** 50-200 expenses (one-time migration)
- **Documents:** PDFs named with date/provider pattern (e.g., `2024-01-15-DrSmith.pdf`), one per expense
- **Mapping:** Direct mapping to existing expense fields (datePaid, provider, amountCents, comment)
- **Status:** All imported expenses will be "unreimbursed"

## Chosen Approach: Step-by-Step Wizard

### Step 1: Upload Excel
- Accept .xlsx/.xls file via drag-drop or file picker
- Parse using a library (e.g., SheetJS/xlsx)
- Show validation summary:
  - Row count
  - Date range
  - Total amount
  - Any parsing errors (missing required fields, invalid dates, etc.)

### Step 2: Review & Edit
- Display parsed data in an editable table
- **Inline editing:** Click any cell to edit directly (Excel-like UX)
- **Row selection:** Checkboxes for multi-select with bulk delete
- **Validation:**
  - Required fields only: Date, Provider, Amount must be present
  - Cell highlighting: Red border on invalid cells with tooltip showing error
  - Row-level indicator: Warning icon on rows with any issues
- **No sorting/filtering:** Keep it simple for one-time use
- "Import All" button to create expenses in Convex (disabled if validation errors exist)

### Step 3: Upload & Match PDFs
- Drag-drop multiple PDF files
- Auto-match algorithm:
  1. Parse date from filename
  2. Find expenses on that date
  3. If multiple, use fuzzy provider name matching
- Display match results:
  - Matched PDFs (green checkmark)
  - Unmatched PDFs (yellow warning) - need manual selection
  - Expenses without documents (gray indicator)
- Allow manual matching for unmatched items
- "Attach All" to upload and link documents

### Step 4: Done
- Summary of import results
- Link back to expense table

## Key Decisions

1. **Wizard over modal** - Full page gives room for table editing and better UX for 50-200 rows
2. **Two-step file upload** - Excel first (preview before commit), then PDFs (match against created expenses)
3. **Date-first matching** - Match PDFs by date from filename, fuzzy provider as tiebreaker
4. **Manual fallback** - Unmatched items flagged with warning for manual intervention
5. **Simple implementation** - One-time use means no need for saved mappings, import history, or duplicate detection
6. **Ignore unused columns** - "Preparing?" and "Reimbursed" columns will be ignored
7. **Inline editing** - Click cells to edit directly, Excel-like experience
8. **Checkbox selection** - Multi-select rows for bulk deletion
9. **Minimal validation** - Only check required fields (Date, Provider, Amount)

## Technical Notes

- Excel parsing: SheetJS (xlsx) library - runs client-side
- PDF filename parsing: Simple regex for date extraction
- Fuzzy matching: Basic string similarity (e.g., Levenshtein distance or contains check)
- State management: React state sufficient for wizard flow (no need for global state)
- Reuses existing patterns:
  - Document upload (three-step pattern from CLAUDE.md)
  - Currency conversion (dollarsToCents)
  - Convex mutations (expenses.create, documents.save, documents.addToExpense)

## Testing Strategy

- **Unit tests** for:
  - Excel parsing logic (column detection, row extraction)
  - Data validation (required fields, date parsing, amount parsing)
  - PDF filename parsing (date extraction regex)
  - Fuzzy provider matching algorithm
- **Browser verification** deferred (agent-browser Windows issue, Claude-in-Chrome not connected)

## Open Questions

None - ready for implementation planning.

## Out of Scope

- Column mapping UI (direct mapping is sufficient)
- Duplicate detection (one-time import, user can verify in preview)
- Import history/undo (manual deletion if needed)
- OCR on imported PDFs (can run later via existing document UI)
- Table sorting/filtering (not needed for one-time import)
- Format/range validation (trust user's Excel data)
