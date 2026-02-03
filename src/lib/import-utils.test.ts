import { describe, it, expect } from "vitest"
import {
  parseCsvFile,
  parseCSVLine,
  isValidISODate,
  extractDateFromFilename,
  matchPdfToExpense,
  normalizeForMatching,
} from "./import-utils"

// ============ CSV Parsing Tests ============

describe("parseCSVLine", () => {
  it("parses simple comma-separated values", () => {
    expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"])
  })

  it("handles quoted fields", () => {
    expect(parseCSVLine('"hello, world",test')).toEqual(["hello, world", "test"])
  })

  it("handles escaped quotes within quoted fields", () => {
    expect(parseCSVLine('"say ""hello""",test')).toEqual(['say "hello"', "test"])
  })

  it("trims whitespace from values", () => {
    expect(parseCSVLine("  a  ,  b  ,  c  ")).toEqual(["a", "b", "c"])
  })

  it("handles empty values", () => {
    expect(parseCSVLine("a,,c")).toEqual(["a", "", "c"])
  })
})

describe("parseCsvFile", () => {
  it("parses a valid CSV with all columns", async () => {
    const csv = `Date,Paid To,Amount,Comment
2024-01-15,Dr. Smith,125.50,Office visit
2024-01-20,Pharmacy,$45.00,Prescription`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(2)
    expect(result.validCount).toBe(2)
    expect(result.errorCount).toBe(0)

    expect(result.rows[0]).toMatchObject({
      date: "2024-01-15",
      provider: "Dr. Smith",
      amountCents: 12550,
      comment: "Office visit",
      rowIndex: 2,
      errors: [],
    })

    expect(result.rows[1]).toMatchObject({
      date: "2024-01-20",
      provider: "Pharmacy",
      amountCents: 4500,
      comment: "Prescription",
      rowIndex: 3,
      errors: [],
    })
  })

  it("handles BOM at file start", async () => {
    const bom = "\uFEFF"
    const csv = `${bom}Date,Paid To,Amount
2024-01-15,Test,100`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(1)
    expect(result.validCount).toBe(1)
    expect(result.rows[0].date).toBe("2024-01-15")
  })

  it("handles CRLF line endings", async () => {
    const csv = "Date,Paid To,Amount\r\n2024-01-15,Test,100\r\n2024-01-16,Test2,200"

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(2)
    expect(result.validCount).toBe(2)
  })

  it("handles CR-only line endings", async () => {
    const csv = "Date,Paid To,Amount\r2024-01-15,Test,100"

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(1)
    expect(result.validCount).toBe(1)
  })

  it("reports errors for rows with missing required fields", async () => {
    const csv = `Date,Paid To,Amount
2024-01-15,,100
,Test,100
2024-01-15,Test,`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(3)
    expect(result.validCount).toBe(0)
    expect(result.errorCount).toBe(3)

    expect(result.rows[0].errors).toContain("Provider is required")
    expect(result.rows[1].errors).toContain("Invalid date (expected YYYY-MM-DD)")
    expect(result.rows[2].errors).toContain("Invalid amount")
  })

  it("handles alternative column names", async () => {
    const csv = `date,vendor,cost,notes
2024-01-15,Test Provider,50.00,A note`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(1)
    expect(result.validCount).toBe(1)
    expect(result.rows[0]).toMatchObject({
      date: "2024-01-15",
      provider: "Test Provider",
      amountCents: 5000,
      comment: "A note",
    })
  })

  it("returns empty result for file with only headers", async () => {
    const csv = "Date,Paid To,Amount"

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(0)
    expect(result.validCount).toBe(0)
  })

  it("skips empty rows", async () => {
    const csv = `Date,Paid To,Amount
2024-01-15,Test,100

2024-01-16,Test2,200
   `

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(2)
  })

  it("handles quoted fields with commas in data", async () => {
    const csv = `Date,Paid To,Amount,Comment
2024-01-15,"Smith, Dr. John",100,"Visit, checkup, etc."`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].provider).toBe("Smith, Dr. John")
    expect(result.rows[0].comment).toBe("Visit, checkup, etc.")
  })
})

// ============ Date Validation Tests ============

describe("isValidISODate", () => {
  it("accepts valid ISO dates", () => {
    expect(isValidISODate("2024-01-15")).toBe(true)
    expect(isValidISODate("2024-12-31")).toBe(true)
    expect(isValidISODate("2020-02-29")).toBe(true) // Leap year
  })

  it("rejects invalid format", () => {
    expect(isValidISODate("01-15-2024")).toBe(false)
    expect(isValidISODate("2024/01/15")).toBe(false)
    expect(isValidISODate("Jan 15, 2024")).toBe(false)
    expect(isValidISODate("")).toBe(false)
  })

  it("rejects invalid dates that pass regex", () => {
    expect(isValidISODate("2024-02-30")).toBe(false) // Feb 30 doesn't exist
    expect(isValidISODate("2024-13-01")).toBe(false) // Month 13 doesn't exist
    expect(isValidISODate("2024-00-15")).toBe(false) // Month 0 doesn't exist
    expect(isValidISODate("2023-02-29")).toBe(false) // Not a leap year
  })
})

// ============ PDF Filename Date Extraction Tests ============

describe("extractDateFromFilename", () => {
  it("extracts ISO format date (YYYY-MM-DD)", () => {
    expect(extractDateFromFilename("2024-01-15-DrSmith.pdf")).toBe("2024-01-15")
    expect(extractDateFromFilename("receipt-2024-12-31.pdf")).toBe("2024-12-31")
    expect(extractDateFromFilename("2024-01-15.pdf")).toBe("2024-01-15")
  })

  it("extracts compact format date (YYYYMMDD)", () => {
    expect(extractDateFromFilename("20240115-receipt.pdf")).toBe("2024-01-15")
    expect(extractDateFromFilename("scan_20241231.pdf")).toBe("2024-12-31")
  })

  it("returns null for files without recognizable date", () => {
    expect(extractDateFromFilename("DrSmith-receipt.pdf")).toBeNull()
    expect(extractDateFromFilename("scan001.pdf")).toBeNull()
    expect(extractDateFromFilename("january-15.pdf")).toBeNull()
  })

  it("handles various file extensions", () => {
    expect(extractDateFromFilename("2024-01-15.PDF")).toBe("2024-01-15")
    expect(extractDateFromFilename("2024-01-15.jpeg")).toBe("2024-01-15")
    expect(extractDateFromFilename("2024-01-15.png")).toBe("2024-01-15")
  })
})

// ============ PDF Matching Tests ============

describe("matchPdfToExpense", () => {
  const mockExpenses = [
    { _id: "exp1" as any, datePaid: "2024-01-15", provider: "Dr. Smith" },
    { _id: "exp2" as any, datePaid: "2024-01-15", provider: "Pharmacy Plus" },
    { _id: "exp3" as any, datePaid: "2024-01-20", provider: "Hospital" },
  ]

  it("matches by date when only one expense on that date", () => {
    const result = matchPdfToExpense("2024-01-20-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp3")
    expect(result.matchedExpense?.provider).toBe("Hospital")
  })

  it("matches by date and fuzzy provider when multiple expenses on same date", () => {
    const result = matchPdfToExpense("2024-01-15-DrSmith.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp1")
    expect(result.matchedExpense?.provider).toBe("Dr. Smith")
  })

  it("matches with normalized provider name", () => {
    const result = matchPdfToExpense("2024-01-15-pharmacyplus.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp2")
  })

  it("does not match when provider is too short (< 4 chars)", () => {
    const shortProviderExpenses = [
      { _id: "exp1" as any, datePaid: "2024-01-15", provider: "Dr" },
      { _id: "exp2" as any, datePaid: "2024-01-15", provider: "CVS" },
    ]

    const result = matchPdfToExpense("2024-01-15-dr-receipt.pdf", shortProviderExpenses)
    expect(result.matched).toBe(false)
  })

  it("returns unmatched for file without date", () => {
    const result = matchPdfToExpense("random-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  it("returns unmatched for date with no matching expenses", () => {
    const result = matchPdfToExpense("2024-02-01-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  it("returns unmatched when multiple expenses on date and no provider match", () => {
    const result = matchPdfToExpense("2024-01-15-UnknownProvider.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })
})

describe("normalizeForMatching", () => {
  it("lowercases text", () => {
    expect(normalizeForMatching("DrSmith")).toBe("drsmith")
  })

  it("removes non-alphanumeric characters", () => {
    expect(normalizeForMatching("Dr. Smith-Jones")).toBe("drsmithjones")
  })

  it("handles empty string", () => {
    expect(normalizeForMatching("")).toBe("")
  })
})
