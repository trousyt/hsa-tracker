import { describe, it, expect } from "vitest"
import {
  parseCsvFile,
  parseCSVLine,
  isValidISODate,
  parseDateToISO,
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
    expect(result.rows[1].errors).toContain("Invalid date (expected YYYY-MM-DD or MM-DD-YYYY)")
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

  it("handles MM-DD-YYYY date format", async () => {
    const csv = `Date,Paid To,Amount
01-15-2024,Dr. Smith,125.50
12-31-2024,Pharmacy,$45.00`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(2)
    expect(result.validCount).toBe(2)
    expect(result.rows[0].date).toBe("2024-01-15")
    expect(result.rows[1].date).toBe("2024-12-31")
  })

  it("handles MM/DD/YYYY date format", async () => {
    const csv = `Date,Paid To,Amount
01/15/2024,Dr. Smith,125.50
1/5/2024,Pharmacy,$45.00`

    const file = new File([csv], "test.csv", { type: "text/csv" })
    const result = await parseCsvFile(file)

    expect(result.rows).toHaveLength(2)
    expect(result.validCount).toBe(2)
    expect(result.rows[0].date).toBe("2024-01-15")
    expect(result.rows[1].date).toBe("2024-01-05")
  })
})

// ============ Date Validation Tests ============

describe("parseDateToISO", () => {
  it("parses YYYY-MM-DD format", () => {
    expect(parseDateToISO("2024-01-15")).toBe("2024-01-15")
    expect(parseDateToISO("2024-12-31")).toBe("2024-12-31")
    expect(parseDateToISO("2020-02-29")).toBe("2020-02-29") // Leap year
  })

  it("parses MM-DD-YYYY format", () => {
    expect(parseDateToISO("01-15-2024")).toBe("2024-01-15")
    expect(parseDateToISO("12-31-2024")).toBe("2024-12-31")
    expect(parseDateToISO("02-29-2020")).toBe("2020-02-29") // Leap year
  })

  it("parses MM/DD/YYYY format", () => {
    expect(parseDateToISO("01/15/2024")).toBe("2024-01-15")
    expect(parseDateToISO("12/31/2024")).toBe("2024-12-31")
  })

  it("handles single-digit month and day", () => {
    expect(parseDateToISO("1-5-2024")).toBe("2024-01-05")
    expect(parseDateToISO("1/5/2024")).toBe("2024-01-05")
  })

  it("returns null for invalid formats", () => {
    expect(parseDateToISO("2024/01/15")).toBeNull()
    expect(parseDateToISO("Jan 15, 2024")).toBeNull()
    expect(parseDateToISO("")).toBeNull()
    expect(parseDateToISO("invalid")).toBeNull()
  })

  it("returns null for invalid dates", () => {
    expect(parseDateToISO("2024-02-30")).toBeNull() // Feb 30 doesn't exist
    expect(parseDateToISO("02-30-2024")).toBeNull()
    expect(parseDateToISO("2024-13-01")).toBeNull() // Month 13 doesn't exist
    expect(parseDateToISO("13-01-2024")).toBeNull()
    expect(parseDateToISO("2023-02-29")).toBeNull() // Not a leap year
  })
})

describe("isValidISODate", () => {
  it("accepts valid dates in supported formats", () => {
    expect(isValidISODate("2024-01-15")).toBe(true)
    expect(isValidISODate("01-15-2024")).toBe(true)
    expect(isValidISODate("01/15/2024")).toBe(true)
    expect(isValidISODate("2020-02-29")).toBe(true) // Leap year
  })

  it("rejects invalid formats", () => {
    expect(isValidISODate("2024/01/15")).toBe(false)
    expect(isValidISODate("Jan 15, 2024")).toBe(false)
    expect(isValidISODate("")).toBe(false)
  })

  it("rejects invalid dates", () => {
    expect(isValidISODate("2024-02-30")).toBe(false) // Feb 30 doesn't exist
    expect(isValidISODate("2024-13-01")).toBe(false) // Month 13 doesn't exist
    expect(isValidISODate("2023-02-29")).toBe(false) // Not a leap year
  })
})

// ============ PDF Filename Date Extraction Tests ============

describe("extractDateFromFilename", () => {
  it("extracts ISO format date (YYYY-MM-DD)", () => {
    const result1 = extractDateFromFilename("2024-01-15-DrSmith.pdf")
    expect(result1.fullDate).toBe("2024-01-15")
    expect(result1.yearMonth).toBe("2024-01")

    const result2 = extractDateFromFilename("receipt-2024-12-31.pdf")
    expect(result2.fullDate).toBe("2024-12-31")
    expect(result2.yearMonth).toBe("2024-12")

    const result3 = extractDateFromFilename("2024-01-15.pdf")
    expect(result3.fullDate).toBe("2024-01-15")
  })

  it("extracts compact format date (YYYYMMDD)", () => {
    const result1 = extractDateFromFilename("20240115-receipt.pdf")
    expect(result1.fullDate).toBe("2024-01-15")
    expect(result1.yearMonth).toBe("2024-01")

    const result2 = extractDateFromFilename("scan_20241231.pdf")
    expect(result2.fullDate).toBe("2024-12-31")
  })

  it("extracts month-only date (YYYY-MM)", () => {
    const result1 = extractDateFromFilename("2024-01 Dr Smith.pdf")
    expect(result1.fullDate).toBeNull()
    expect(result1.yearMonth).toBe("2024-01")

    const result2 = extractDateFromFilename("2024-12 Pharmacy.pdf")
    expect(result2.fullDate).toBeNull()
    expect(result2.yearMonth).toBe("2024-12")
  })

  it("does not extract month-only from full date filenames", () => {
    // Full date should be extracted, not just month
    const result = extractDateFromFilename("2024-01-15-DrSmith.pdf")
    expect(result.fullDate).toBe("2024-01-15")
    expect(result.yearMonth).toBe("2024-01")
  })

  it("rejects invalid dates (month 13)", () => {
    const result = extractDateFromFilename("2024-13-01.pdf")
    expect(result.fullDate).toBeNull()
    // Month-only extraction should also reject invalid months
    const result2 = extractDateFromFilename("2024-13 Provider.pdf")
    expect(result2.yearMonth).toBeNull()
  })

  it("rejects invalid dates (Feb 30)", () => {
    const result = extractDateFromFilename("2024-02-30.pdf")
    expect(result.fullDate).toBeNull()
  })

  it("returns null for files without recognizable date", () => {
    const result1 = extractDateFromFilename("DrSmith-receipt.pdf")
    expect(result1.fullDate).toBeNull()
    expect(result1.yearMonth).toBeNull()

    const result2 = extractDateFromFilename("scan001.pdf")
    expect(result2.fullDate).toBeNull()
    expect(result2.yearMonth).toBeNull()

    const result3 = extractDateFromFilename("january-15.pdf")
    expect(result3.fullDate).toBeNull()
    expect(result3.yearMonth).toBeNull()
  })

  it("handles various file extensions", () => {
    expect(extractDateFromFilename("2024-01-15.PDF").fullDate).toBe("2024-01-15")
    expect(extractDateFromFilename("2024-01-15.jpeg").fullDate).toBe("2024-01-15")
    expect(extractDateFromFilename("2024-01-15.png").fullDate).toBe("2024-01-15")
  })
})

// ============ PDF Matching Tests ============

describe("matchPdfToExpense", () => {
  const mockExpenses = [
    { _id: "exp1" as any, datePaid: "2024-01-15", provider: "Dr. Smith", amountCents: 12500 },
    { _id: "exp2" as any, datePaid: "2024-01-15", provider: "Pharmacy Plus", amountCents: 4500 },
    { _id: "exp3" as any, datePaid: "2024-01-20", provider: "Hospital", amountCents: 50000 },
    { _id: "exp4" as any, datePaid: "2024-02-10", provider: "Dentist", amountCents: 20000 },
    { _id: "exp5" as any, datePaid: "2024-03-05", provider: "Eye Doctor", amountCents: 15000 },
    { _id: "exp6" as any, datePaid: "2024-03-20", provider: "Physical Therapy", amountCents: 7500 },
  ]

  it("matches by date when only one expense on that date", () => {
    const result = matchPdfToExpense("2024-01-20-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp3")
    expect(result.matchedExpense?.provider).toBe("Hospital")
    expect(result.matchedExpense?.amountCents).toBe(50000)
  })

  it("matches by date and fuzzy provider when multiple expenses on same date", () => {
    const result = matchPdfToExpense("2024-01-15-DrSmith.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp1")
    expect(result.matchedExpense?.provider).toBe("Dr. Smith")
    expect(result.matchedExpense?.amountCents).toBe(12500)
  })

  it("matches with normalized provider name", () => {
    const result = matchPdfToExpense("2024-01-15-pharmacyplus.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp2")
  })

  it("does not match when provider is too short (< 4 chars)", () => {
    const shortProviderExpenses = [
      { _id: "exp1" as any, datePaid: "2024-01-15", provider: "Dr", amountCents: 1000 },
      { _id: "exp2" as any, datePaid: "2024-01-15", provider: "CVS", amountCents: 2000 },
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
    const result = matchPdfToExpense("2024-05-01-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  it("returns unmatched when multiple expenses on date and no provider match", () => {
    const result = matchPdfToExpense("2024-01-15-UnknownProvider.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  // Month-based matching tests
  it("matches by month when only one expense in that month", () => {
    const result = matchPdfToExpense("2024-02 Dentist.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp4")
    expect(result.matchedExpense?.provider).toBe("Dentist")
    expect(result.matchedExpense?.amountCents).toBe(20000)
  })

  it("matches by month and provider when multiple expenses in same month", () => {
    const result = matchPdfToExpense("2024-03 Eye Doctor.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp5")
    expect(result.matchedExpense?.provider).toBe("Eye Doctor")
  })

  it("matches by month with partial provider match", () => {
    const result = matchPdfToExpense("2024-03 physicaltherapy.pdf", mockExpenses)

    expect(result.matched).toBe(true)
    expect(result.expenseId).toBe("exp6")
  })

  it("returns unmatched when multiple expenses in month and no provider match", () => {
    const result = matchPdfToExpense("2024-03.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  it("does NOT fall back to month matching for full-date files", () => {
    // File has full date but no expense on that exact date
    // Should NOT match to any expense in January
    const result = matchPdfToExpense("2024-01-25-receipt.pdf", mockExpenses)

    expect(result.matched).toBe(false)
    expect(result.expenseId).toBeNull()
  })

  it("returns unmatched for month with no expenses", () => {
    const result = matchPdfToExpense("2024-04 Provider.pdf", mockExpenses)

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
