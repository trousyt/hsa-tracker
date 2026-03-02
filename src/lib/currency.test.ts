import { describe, it, expect } from "vitest"
import {
  dollarsToCents,
  centsToDollars,
  formatCurrency,
  formatDollars,
  formatCurrencyShort,
  parseCurrencyToCents,
} from "./currency"

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(25)).toBe(2500)
  })

  it("converts dollars with cents", () => {
    expect(dollarsToCents(25.5)).toBe(2550)
  })

  it("rounds to nearest cent", () => {
    expect(dollarsToCents(25.555)).toBe(2556)
  })

  it("handles zero", () => {
    expect(dollarsToCents(0)).toBe(0)
  })
})

describe("centsToDollars", () => {
  it("converts cents to dollars", () => {
    expect(centsToDollars(2550)).toBe(25.5)
  })

  it("handles zero", () => {
    expect(centsToDollars(0)).toBe(0)
  })
})

describe("formatCurrency", () => {
  it("formats cents as dollar string", () => {
    expect(formatCurrency(2550)).toBe("$25.50")
  })

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00")
  })

  it("formats large amounts with commas", () => {
    expect(formatCurrency(125050)).toBe("$1,250.50")
  })
})

describe("formatDollars", () => {
  it("formats dollar amount", () => {
    expect(formatDollars(25.5)).toBe("$25.50")
  })
})

describe("formatCurrencyShort", () => {
  it("formats small amounts without abbreviation", () => {
    expect(formatCurrencyShort(0)).toBe("$0")
    expect(formatCurrencyShort(5000)).toBe("$50")
    expect(formatCurrencyShort(85000)).toBe("$850")
    expect(formatCurrencyShort(99900)).toBe("$999")
  })

  it("formats thousands with K suffix", () => {
    expect(formatCurrencyShort(100000)).toBe("$1K")
    expect(formatCurrencyShort(150000)).toBe("$1.5K")
    expect(formatCurrencyShort(125000)).toBe("$1.3K") // rounds to 1 decimal
    expect(formatCurrencyShort(1000000)).toBe("$10K")
    expect(formatCurrencyShort(99900000)).toBe("$999K")
  })

  it("formats millions with M suffix", () => {
    expect(formatCurrencyShort(100000000)).toBe("$1M")
    expect(formatCurrencyShort(150000000)).toBe("$1.5M")
    expect(formatCurrencyShort(250000000)).toBe("$2.5M")
  })

  it("handles exact thousands without decimal", () => {
    expect(formatCurrencyShort(500000)).toBe("$5K")
    expect(formatCurrencyShort(1000000)).toBe("$10K")
  })

  it("handles negative amounts", () => {
    expect(formatCurrencyShort(-150000)).toBe("-$1.5K")
    expect(formatCurrencyShort(-5000)).toBe("-$50")
  })
})

describe("parseCurrencyToCents", () => {
  it("parses plain number", () => {
    expect(parseCurrencyToCents("25.50")).toBe(2550)
  })

  it("parses dollar sign format", () => {
    expect(parseCurrencyToCents("$25.50")).toBe(2550)
  })

  it("returns null for empty string", () => {
    expect(parseCurrencyToCents("")).toBeNull()
  })

  it("returns null for negative", () => {
    expect(parseCurrencyToCents("-5")).toBeNull()
  })

  it("returns null for non-numeric", () => {
    expect(parseCurrencyToCents("abc")).toBeNull()
  })
})
