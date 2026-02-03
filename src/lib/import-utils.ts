import { parseCurrencyToCents } from "./currency"
import type { Id } from "../../convex/_generated/dataModel"

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
  expenseId: Id<"expenses"> | null
  matched: boolean
  matchedExpense?: { date: string; provider: string }
}

export interface ImportExpense {
  _id: Id<"expenses">
  datePaid: string
  provider: string
}

// ============ CSV Parsing ============

const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ["date", "date paid", "datepaid"],
  provider: ["paid to", "paidto", "provider", "vendor"],
  amount: ["amount", "cost", "price"],
  comment: ["comment", "comments", "notes", "note"],
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

  // Date
  let date: string | null = null
  if (indexes.date !== undefined) {
    const dateStr = cells[indexes.date]?.trim()
    if (dateStr && isValidISODate(dateStr)) {
      date = dateStr
    } else {
      errors.push("Invalid date (expected YYYY-MM-DD)")
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

  return { date, provider, amountCents, comment, rowIndex: rowNum, errors }
}

export function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr + "T00:00:00")
  return !isNaN(date.getTime()) && dateStr === date.toISOString().split("T")[0]
}

// ============ PDF Matching ============

const MIN_PROVIDER_LENGTH = 4

export function matchPdfToExpense(
  filename: string,
  expenses: ImportExpense[]
): MatchResult {
  const extractedDate = extractDateFromFilename(filename)

  if (!extractedDate) {
    return { filename, expenseId: null, matched: false }
  }

  const sameDate = expenses.filter((e) => e.datePaid === extractedDate)

  if (sameDate.length === 0) {
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
      },
    }
  }

  // Multiple expenses on same date: fuzzy match provider
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
        matchedExpense: { date: expense.datePaid, provider: expense.provider },
      }
    }
  }

  return { filename, expenseId: null, matched: false }
}

export function extractDateFromFilename(filename: string): string | null {
  const name = filename.replace(/\.[^.]+$/, "")

  // YYYY-MM-DD
  const isoMatch = name.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  // YYYYMMDD
  const compactMatch = name.match(/(\d{4})(\d{2})(\d{2})/)
  if (compactMatch)
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`

  return null
}

export function normalizeForMatching(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "")
}
