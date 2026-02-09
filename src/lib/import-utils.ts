import { parseCurrencyToCents } from "./currency"
import { formatLocalDate } from "./dates"
import type { Id } from "../../convex/_generated/dataModel"
import {
  isValidCategory,
  EXPENSE_CATEGORY_VALUES,
  type ExpenseCategory,
} from "./constants/expense-categories"

// ============ Types ============

export interface ParsedRow {
  date: string | null
  provider: string | null
  amountCents: number | null
  comment: string | null
  category: ExpenseCategory | null
  categoryWarning?: string
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
  expenseId: Id<"expenses"> | null
  matched: boolean
  matchedExpense?: { date: string; provider: string; amountCents: number }
}

export interface ImportExpense {
  _id: Id<"expenses">
  datePaid: string
  provider: string
  amountCents: number
}

export interface ExtractedDate {
  fullDate: string | null  // YYYY-MM-DD (validated)
  yearMonth: string | null // YYYY-MM (validated)
}

// ============ CSV Parsing ============

const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ["date", "date paid", "datepaid"],
  provider: ["paid to", "paidto", "provider", "vendor"],
  amount: ["amount", "cost", "price"],
  comment: ["comment", "comments", "notes", "note"],
  category: ["category", "type", "expense type", "expensetype"],
}

export async function parseCsvFile(file: File): Promise<ParseResult> {
  const text = (await file.text())
    .replace(/^\uFEFF/, "") // Remove BOM
    .replace(/\r\n/g, "\n") // Normalize CRLF
    .replace(/\r/g, "\n") // Normalize CR

  const lines = text.split("\n").filter((line) => line.trim())

  if (lines.length < 2) {
    return { rows: [], validCount: 0, errorCount: 0 }
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const columnIndexes = detectColumnIndexes(headers)

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    if (cells.every((cell) => !cell.trim())) continue
    rows.push(parseRow(cells, columnIndexes, i + 1))
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length
  return { rows, validCount, errorCount: rows.length - validCount }
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
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
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
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
    const index = headers.findIndex((h) => aliases.includes(h))
    if (index !== -1) indexes[field] = index
  }
  return indexes
}

function parseRow(
  cells: string[],
  indexes: Record<string, number>,
  rowNum: number
): ParsedRow {
  const errors: string[] = []

  // Date (supports YYYY-MM-DD, MM-DD-YYYY, MM/DD/YYYY)
  let date: string | null = null
  if (indexes.date !== undefined) {
    const dateStr = cells[indexes.date]?.trim()
    date = parseDateToISO(dateStr)
    if (!date) {
      errors.push("Invalid date (expected YYYY-MM-DD or MM-DD-YYYY)")
    }
  } else {
    errors.push("Date column not found")
  }

  // Provider
  let provider: string | null = null
  if (indexes.provider !== undefined) {
    provider = cells[indexes.provider]?.trim() || null
    if (!provider) errors.push("Provider is required")
  } else {
    errors.push("Provider column not found")
  }

  // Amount (reuse existing utility)
  let amountCents: number | null = null
  if (indexes.amount !== undefined) {
    amountCents = parseCurrencyToCents(cells[indexes.amount] ?? "")
    if (amountCents === null || amountCents <= 0) {
      errors.push("Invalid amount")
      amountCents = null
    }
  } else {
    errors.push("Amount column not found")
  }

  // Comment (optional)
  const comment =
    indexes.comment !== undefined
      ? cells[indexes.comment]?.trim() || null
      : null

  // Category (OPTIONAL column - CSV files without a category column import normally)
  // If column exists but value is empty/invalid, import as uncategorized with optional warning
  let category: ExpenseCategory | null = null
  let categoryWarning: string | undefined = undefined
  if (indexes.category !== undefined) {
    const rawCategory = cells[indexes.category]?.trim()
    if (rawCategory) {
      const lowerCategory = rawCategory.toLowerCase()
      // Try exact match first
      if (isValidCategory(lowerCategory)) {
        category = lowerCategory as ExpenseCategory
      } else {
        // Try to match by converting spaces/underscores to hyphens
        const normalized = lowerCategory.replace(/[\s_]+/g, "-")
        if (isValidCategory(normalized)) {
          category = normalized as ExpenseCategory
        } else {
          // Try to find a partial match in the predefined values
          const matchedCategory = EXPENSE_CATEGORY_VALUES.find(
            (c) =>
              c.includes(normalized) ||
              normalized.includes(c.replace(/-/g, ""))
          )
          if (matchedCategory) {
            category = matchedCategory
          } else {
            // Invalid category - import as uncategorized with warning
            categoryWarning = `Unknown category "${rawCategory}" - imported as uncategorized`
          }
        }
      }
    }
  }

  return {
    date,
    provider,
    amountCents,
    comment,
    category,
    categoryWarning,
    rowIndex: rowNum,
    errors,
  }
}

/**
 * Parses a date string in various formats and returns YYYY-MM-DD or null if invalid.
 * Supports: YYYY-MM-DD, MM-DD-YYYY, MM/DD/YYYY
 */
export function parseDateToISO(dateStr: string): string | null {
  if (!dateStr) return null

  // Try YYYY-MM-DD first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    if (isValidDateParts(year, month, day)) {
      return `${year}-${month}-${day}`
    }
  }

  // Try MM-DD-YYYY or MM/DD/YYYY
  const usMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    const paddedMonth = month.padStart(2, "0")
    const paddedDay = day.padStart(2, "0")
    if (isValidDateParts(year, paddedMonth, paddedDay)) {
      return `${year}-${paddedMonth}-${paddedDay}`
    }
  }

  return null
}

function isValidDateParts(year: string, month: string, day: string): boolean {
  const dateStr = `${year}-${month}-${day}`
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return !isNaN(date.getTime()) && dateStr === formatLocalDate(date)
}

export function isValidISODate(dateStr: string): boolean {
  return parseDateToISO(dateStr) !== null
}

// ============ PDF Matching ============

const MIN_PROVIDER_LENGTH = 4

export function matchPdfToExpense(
  filename: string,
  expenses: ImportExpense[]
): MatchResult {
  const extracted = extractDateFromFilename(filename)

  // Strategy 1: Exact date match (existing behavior)
  if (extracted.fullDate) {
    const sameDate = expenses.filter((e) => e.datePaid === extracted.fullDate)

    if (sameDate.length === 0) {
      // No exact match - do NOT fall back to month matching for full-date files
      return { filename, expenseId: null, matched: false }
    }

    if (sameDate.length === 1) {
      return {
        filename,
        expenseId: sameDate[0]._id,
        matched: true,
        matchedExpense: {
          date: sameDate[0].datePaid,
          provider: sameDate[0].provider,
          amountCents: sameDate[0].amountCents,
        },
      }
    }

    // Multiple expenses on same date - try provider fuzzy match
    const normalizedFilename = normalizeForMatching(filename)
    for (const expense of sameDate) {
      const normalizedProvider = normalizeForMatching(expense.provider)
      if (
        normalizedProvider.length >= MIN_PROVIDER_LENGTH &&
        normalizedFilename.includes(normalizedProvider)
      ) {
        return {
          filename,
          expenseId: expense._id,
          matched: true,
          matchedExpense: {
            date: expense.datePaid,
            provider: expense.provider,
            amountCents: expense.amountCents,
          },
        }
      }
    }

    return { filename, expenseId: null, matched: false }
  }

  // Strategy 2: Month + provider fuzzy match (only for month-only filenames)
  if (extracted.yearMonth) {
    const sameMonth = expenses.filter((e) =>
      e.datePaid.startsWith(extracted.yearMonth!)
    )

    if (sameMonth.length === 0) {
      return { filename, expenseId: null, matched: false }
    }

    if (sameMonth.length === 1) {
      // Only one expense in that month - auto-match
      return {
        filename,
        expenseId: sameMonth[0]._id,
        matched: true,
        matchedExpense: {
          date: sameMonth[0].datePaid,
          provider: sameMonth[0].provider,
          amountCents: sameMonth[0].amountCents,
        },
      }
    }

    // Multiple expenses in month - fuzzy match provider from filename
    const normalizedFilename = normalizeForMatching(filename)
    for (const expense of sameMonth) {
      const normalizedProvider = normalizeForMatching(expense.provider)
      if (
        normalizedProvider.length >= MIN_PROVIDER_LENGTH &&
        normalizedFilename.includes(normalizedProvider)
      ) {
        return {
          filename,
          expenseId: expense._id,
          matched: true,
          matchedExpense: {
            date: expense.datePaid,
            provider: expense.provider,
            amountCents: expense.amountCents,
          },
        }
      }
    }
  }

  return { filename, expenseId: null, matched: false }
}

function isValidFullDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return !isNaN(date.getTime()) && dateStr === formatLocalDate(date)
}

export function extractDateFromFilename(filename: string): ExtractedDate {
  const name = filename.replace(/\.[^.]+$/, "")

  // Try YYYY-MM-DD first (with validation)
  const isoMatch = name.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    if (isValidFullDate(dateStr)) {
      return { fullDate: dateStr, yearMonth: `${isoMatch[1]}-${isoMatch[2]}` }
    }
  }

  // Try YYYYMMDD (8 consecutive digits, with validation)
  const compactMatch = name.match(/(\d{4})(\d{2})(\d{2})/)
  if (compactMatch) {
    const dateStr = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`
    if (isValidFullDate(dateStr)) {
      return { fullDate: dateStr, yearMonth: `${compactMatch[1]}-${compactMatch[2]}` }
    }
  }

  // Try YYYY-MM only (month-based, no full date in filename)
  // Use boundaries to avoid matching partial dates like 2024-01-15
  const monthMatch = name.match(/(?:^|[^0-9])(\d{4})-(\d{2})(?:[^0-9]|$)/)
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10)
    const month = parseInt(monthMatch[2], 10)
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return { fullDate: null, yearMonth: `${monthMatch[1]}-${monthMatch[2]}` }
    }
  }

  return { fullDate: null, yearMonth: null }
}

export function normalizeForMatching(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "")
}
