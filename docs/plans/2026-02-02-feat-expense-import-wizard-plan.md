---
title: "feat: Add expense import wizard for CSV migration"
type: feat
date: 2026-02-02
revised: 2026-02-02
---

# feat: Add Expense Import Wizard for CSV Migration

## Overview

Build a 3-step import flow to migrate historical expense data from CSV, with optional PDF document matching. This is a one-time migration tool for users transitioning from Excel-based HSA expense tracking.

## Problem Statement / Motivation

Users currently have historical HSA expense data in Excel spreadsheets with associated PDF receipts. Manual entry of 50-200 expenses is tedious and error-prone. An import wizard enables bulk migration while maintaining data quality through validation and review before commit.

## Proposed Solution

A simplified 3-step flow:

1. **Upload & Review CSV** - Parse file, show read-only preview table with validation
2. **Match PDFs (optional)** - Auto-match documents by date, manual fallback for unmatched
3. **Done** - Summary and navigation back to expenses

### Key Design Decisions (Revised)

- **3 steps, not 4** - Combine upload+review; separate complete step is unnecessary
- **Read-only preview** - No inline editing; fix errors in CSV and re-upload
- **Binary match status** - "matched" or "unmatched", no confidence levels
- **2 files total** - One component, one utility module
- **Button in Expenses tab** - Not a primary navigation tab
- **Reuse existing utilities** - Use `parseCurrencyToCents` from currency.ts

## Technical Considerations

### Architecture (Simplified)

**New Files:**
```
src/components/import/
└── import-wizard.tsx      # Entire wizard (~300 lines)

src/lib/
└── import-utils.ts        # CSV parsing + PDF matching (~200 lines)
```

**No new dependencies required.**

### Entry Point

Add "Import from CSV" button to the Expenses tab header (next to existing "Download CSV" button). Opens the import wizard as a full-page view within the tab.

```typescript
// In expense-table.tsx
<Button variant="outline" onClick={() => setShowImportWizard(true)}>
  <Upload className="mr-2 h-4 w-4" />
  Import from CSV
</Button>
```

### CSV Parsing Strategy

Use native browser APIs. User exports Excel to CSV with ISO8601 dates.

```typescript
// src/lib/import-utils.ts
import { parseCurrencyToCents } from './currency'

export interface ParsedRow {
  date: string | null
  provider: string | null
  amountCents: number | null
  comment: string | null
  rowIndex: number
  errors: string[]
}

export interface ParseResult {
  rows: ParsedRow[]
  validCount: number
  errorCount: number
}
```

**Column Header Matching (case-insensitive):**
- `Date`, `date`, `Date Paid` → datePaid
- `Paid To`, `Provider`, `Vendor` → provider
- `Amount`, `amount` → amountCents
- `Comment`, `Comments`, `Notes` → comment

**Date Validation:**
```typescript
function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && dateStr === date.toISOString().split('T')[0]
}
```

**CSV Preprocessing (handle BOM and line endings):**
```typescript
const text = (await file.text())
  .replace(/^\uFEFF/, '')      // Remove BOM
  .replace(/\r\n/g, '\n')      // Normalize CRLF
  .replace(/\r/g, '\n')        // Normalize CR
```

### PDF Matching Algorithm (Simplified)

Binary matching: matched or unmatched (no confidence levels).

```typescript
export interface MatchResult {
  filename: string
  expenseId: Id<'expenses'> | null
  matched: boolean
  matchedExpense?: { date: string; provider: string }
}

export function matchPdfToExpense(filename: string, expenses: Expense[]): MatchResult {
  const extractedDate = extractDateFromFilename(filename)
  if (!extractedDate) return { filename, expenseId: null, matched: false }

  const sameDate = expenses.filter(e => e.datePaid === extractedDate)

  if (sameDate.length === 1) {
    return { filename, expenseId: sameDate[0]._id, matched: true, matchedExpense: {...} }
  }

  if (sameDate.length > 1) {
    // Fuzzy match provider (require min 4 chars to avoid false positives)
    const normalizedFilename = normalizeForMatching(filename)
    for (const expense of sameDate) {
      const normalizedProvider = normalizeForMatching(expense.provider)
      if (normalizedProvider.length >= 4 && normalizedFilename.includes(normalizedProvider)) {
        return { filename, expenseId: expense._id, matched: true, matchedExpense: {...} }
      }
    }
  }

  return { filename, expenseId: null, matched: false }
}
```

### Bulk Import Strategy

Sequential processing with progress indicator (so user sees real-time progress):

```typescript
async function handleImportAll(rows: ValidatedRow[], onProgress: (n: number) => void) {
  const results: { rowIndex: number; expenseId?: Id<'expenses'>; error?: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    onProgress(i + 1)
    try {
      const id = await createExpense({
        datePaid: rows[i].date,
        provider: rows[i].provider,
        amountCents: rows[i].amountCents,
        comment: rows[i].comment,
      })
      results.push({ rowIndex: rows[i].rowIndex, expenseId: id })
    } catch (error) {
      results.push({ rowIndex: rows[i].rowIndex, error: String(error) })
    }
  }

  return results
}
```

## Acceptance Criteria

### Step 1: Upload & Review CSV
- [x] "Import from CSV" button in Expenses tab header
- [x] Accept .csv files via drag-drop or file picker
- [x] Parse file with BOM/CRLF handling
- [x] Validate dates are real ISO8601 dates (not just regex match)
- [x] Use existing `parseCurrencyToCents` for amount parsing
- [x] Show read-only preview table with row numbers
- [x] Display validation summary: valid rows, error rows
- [x] Show error messages per row (highlight rows with errors)
- [x] "Import All" button (disabled if any errors exist)
- [x] "Fix errors in your CSV file and re-upload" guidance for error state

### Step 2: Match PDFs (Optional)
- [x] Accept multiple PDF files via drag-drop
- [x] Auto-match by date extracted from filename
- [x] Binary status: green checkmark (matched) or yellow warning (unmatched)
- [x] Manual matching: dropdown to select expense for unmatched PDFs
- [x] "Attach Matched" button to upload and link documents
- [x] "Skip" button to finish without attaching documents
- [x] Progress indicator during upload

### Step 3: Complete
- [x] Summary: X expenses created, Y documents attached
- [x] "View Expenses" button returns to expense table
- [x] Clear wizard state

### Testing Requirements
- [x] Unit test: CSV parsing with various edge cases (BOM, CRLF, quoted fields)
- [x] Unit test: Date validation (valid dates, invalid dates like 2024-02-30)
- [x] Unit test: PDF filename date extraction
- [x] Unit test: Fuzzy provider matching (including min-length guard)

## Success Metrics

- User can import 50-200 expenses from CSV in under 3 minutes
- At least 80% of PDFs auto-match (given proper date-based naming)
- Zero data loss during import

## Dependencies & Risks

### Dependencies
- Existing `parseCurrencyToCents` from `src/lib/currency.ts`
- Existing three-step upload pattern for PDF uploads
- Existing expense creation mutation
- Existing document linking mutation

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Partial import failure | Medium | Medium | Sequential processing shows which rows failed |
| CSV edge cases | Low | Low | Handle BOM, CRLF, quoted fields |
| PDF matching false positives | Low | Low | Require min 4-char provider match |

## References

### Internal
- Currency utilities: `src/lib/currency.ts:34` (`parseCurrencyToCents`)
- Document upload: `src/components/documents/file-uploader.tsx`
- Expense form: `src/components/expenses/expense-form.tsx`

### Related Work
- Brainstorm: `docs/brainstorms/2026-02-02-expense-import-brainstorm.md`

---

## Implementation Code

### src/lib/import-utils.ts

```typescript
import { parseCurrencyToCents } from './currency'
import type { Id } from 'convex/_generated/dataModel'

// ============ Types ============

export interface ParsedRow {
  date: string | null
  provider: string | null
  amountCents: number | null
  comment: string | null
  rowIndex: number
  errors: string[]
}

export interface ParseResult {
  rows: ParsedRow[]
  validCount: number
  errorCount: number
}

export interface MatchResult {
  filename: string
  expenseId: Id<'expenses'> | null
  matched: boolean
  matchedExpense?: { date: string; provider: string }
}

interface Expense {
  _id: Id<'expenses'>
  datePaid: string
  provider: string
}

// ============ CSV Parsing ============

const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'date paid', 'datepaid'],
  provider: ['paid to', 'paidto', 'provider', 'vendor'],
  amount: ['amount', 'cost', 'price'],
  comment: ['comment', 'comments', 'notes', 'note'],
}

export async function parseCsvFile(file: File): Promise<ParseResult> {
  const text = (await file.text())
    .replace(/^\uFEFF/, '')      // Remove BOM
    .replace(/\r\n/g, '\n')      // Normalize CRLF
    .replace(/\r/g, '\n')        // Normalize CR

  const lines = text.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    return { rows: [], validCount: 0, errorCount: 0 }
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  const columnIndexes = detectColumnIndexes(headers)

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    if (cells.every(cell => !cell.trim())) continue
    rows.push(parseRow(cells, columnIndexes, i + 1))
  }

  const validCount = rows.filter(r => r.errors.length === 0).length
  return { rows, validCount, errorCount: rows.length - validCount }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function detectColumnIndexes(headers: string[]): Record<string, number> {
  const indexes: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
    const index = headers.findIndex(h => aliases.includes(h))
    if (index !== -1) indexes[field] = index
  }
  return indexes
}

function parseRow(cells: string[], indexes: Record<string, number>, rowNum: number): ParsedRow {
  const errors: string[] = []

  // Date
  let date: string | null = null
  if (indexes.date !== undefined) {
    const dateStr = cells[indexes.date]?.trim()
    if (dateStr && isValidISODate(dateStr)) {
      date = dateStr
    } else {
      errors.push('Invalid date (expected YYYY-MM-DD)')
    }
  } else {
    errors.push('Date column not found')
  }

  // Provider
  let provider: string | null = null
  if (indexes.provider !== undefined) {
    provider = cells[indexes.provider]?.trim() || null
    if (!provider) errors.push('Provider is required')
  } else {
    errors.push('Provider column not found')
  }

  // Amount (reuse existing utility)
  let amountCents: number | null = null
  if (indexes.amount !== undefined) {
    amountCents = parseCurrencyToCents(cells[indexes.amount] ?? '')
    if (amountCents === null || amountCents <= 0) {
      errors.push('Invalid amount')
      amountCents = null
    }
  } else {
    errors.push('Amount column not found')
  }

  // Comment (optional)
  const comment = indexes.comment !== undefined
    ? cells[indexes.comment]?.trim() || null
    : null

  return { date, provider, amountCents, comment, rowIndex: rowNum, errors }
}

function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr + 'T00:00:00')
  return !isNaN(date.getTime()) && dateStr === date.toISOString().split('T')[0]
}

// ============ PDF Matching ============

const MIN_PROVIDER_LENGTH = 4

export function matchPdfToExpense(filename: string, expenses: Expense[]): MatchResult {
  const extractedDate = extractDateFromFilename(filename)

  if (!extractedDate) {
    return { filename, expenseId: null, matched: false }
  }

  const sameDate = expenses.filter(e => e.datePaid === extractedDate)

  if (sameDate.length === 0) {
    return { filename, expenseId: null, matched: false }
  }

  if (sameDate.length === 1) {
    return {
      filename,
      expenseId: sameDate[0]._id,
      matched: true,
      matchedExpense: { date: sameDate[0].datePaid, provider: sameDate[0].provider },
    }
  }

  // Multiple expenses on same date: fuzzy match provider
  const normalizedFilename = normalizeForMatching(filename)

  for (const expense of sameDate) {
    const normalizedProvider = normalizeForMatching(expense.provider)
    if (normalizedProvider.length >= MIN_PROVIDER_LENGTH &&
        normalizedFilename.includes(normalizedProvider)) {
      return {
        filename,
        expenseId: expense._id,
        matched: true,
        matchedExpense: { date: expense.datePaid, provider: expense.provider },
      }
    }
  }

  return { filename, expenseId: null, matched: false }
}

function extractDateFromFilename(filename: string): string | null {
  const name = filename.replace(/\.[^.]+$/, '')

  // YYYY-MM-DD
  const isoMatch = name.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  // YYYYMMDD
  const compactMatch = name.match(/(\d{4})(\d{2})(\d{2})/)
  if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`

  return null
}

function normalizeForMatching(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}
```
