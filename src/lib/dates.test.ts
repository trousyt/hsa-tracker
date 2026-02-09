import { describe, it, expect } from "vitest"
import { parseLocalDate, formatLocalDate, displayLocalDate } from "./dates"

// ============ parseLocalDate Tests ============

describe("parseLocalDate", () => {
  it("parses a standard ISO date", () => {
    const date = parseLocalDate("2024-06-15")
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(5) // June = 5
    expect(date.getDate()).toBe(15)
  })

  it("parses Jan 1 without shifting to previous year (timezone boundary)", () => {
    const date = parseLocalDate("2024-01-01")
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(1)
  })

  it("parses Dec 31 correctly", () => {
    const date = parseLocalDate("2024-12-31")
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(11)
    expect(date.getDate()).toBe(31)
  })

  it("parses leap day", () => {
    const date = parseLocalDate("2024-02-29")
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBe(29)
  })

  it("parses month boundaries correctly", () => {
    // Last day of each 30-day month
    const apr30 = parseLocalDate("2024-04-30")
    expect(apr30.getMonth()).toBe(3)
    expect(apr30.getDate()).toBe(30)

    // Last day of February in non-leap year
    const feb28 = parseLocalDate("2023-02-28")
    expect(feb28.getMonth()).toBe(1)
    expect(feb28.getDate()).toBe(28)
  })

  it("creates a local midnight date, not UTC", () => {
    const date = parseLocalDate("2024-01-01")
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })
})

// ============ formatLocalDate Tests ============

describe("formatLocalDate", () => {
  it("formats a standard date", () => {
    const date = new Date(2024, 5, 15) // June 15, 2024
    expect(formatLocalDate(date)).toBe("2024-06-15")
  })

  it("zero-pads single-digit months and days", () => {
    const date = new Date(2024, 0, 5) // January 5, 2024
    expect(formatLocalDate(date)).toBe("2024-01-05")
  })

  it("handles year boundaries", () => {
    const dec31 = new Date(2024, 11, 31)
    expect(formatLocalDate(dec31)).toBe("2024-12-31")

    const jan1 = new Date(2025, 0, 1)
    expect(formatLocalDate(jan1)).toBe("2025-01-01")
  })

  it("handles leap day", () => {
    const date = new Date(2024, 1, 29)
    expect(formatLocalDate(date)).toBe("2024-02-29")
  })

  it("uses local time, not UTC", () => {
    // Create a date at local midnight
    const date = new Date(2024, 0, 1, 0, 0, 0)
    // Should still read as Jan 1 regardless of timezone
    expect(formatLocalDate(date)).toBe("2024-01-01")
  })
})

// ============ Round-trip Tests ============

describe("formatLocalDate(parseLocalDate(x)) round-trip", () => {
  it("round-trips standard dates", () => {
    expect(formatLocalDate(parseLocalDate("2024-06-15"))).toBe("2024-06-15")
  })

  it("round-trips month boundaries", () => {
    expect(formatLocalDate(parseLocalDate("2024-01-31"))).toBe("2024-01-31")
    expect(formatLocalDate(parseLocalDate("2024-04-30"))).toBe("2024-04-30")
    expect(formatLocalDate(parseLocalDate("2024-02-29"))).toBe("2024-02-29")
  })

  it("round-trips all 12 months", () => {
    for (let m = 1; m <= 12; m++) {
      const iso = `2024-${String(m).padStart(2, "0")}-15`
      expect(formatLocalDate(parseLocalDate(iso))).toBe(iso)
    }
  })

  it("round-trips timezone boundary dates", () => {
    expect(formatLocalDate(parseLocalDate("2024-01-01"))).toBe("2024-01-01")
    expect(formatLocalDate(parseLocalDate("2024-12-31"))).toBe("2024-12-31")
  })
})

// ============ displayLocalDate Tests ============

describe("displayLocalDate", () => {
  it("formats a date for display with default options", () => {
    const result = displayLocalDate("2024-06-15")
    // Default is en-US with long month
    expect(result).toBe("June 15, 2024")
  })

  it("uses specified locale", () => {
    const result = displayLocalDate("2024-06-15", "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    expect(result).toBe("Jun 15, 2024")
  })

  it("handles Jan 1 without shifting to previous year", () => {
    const result = displayLocalDate("2024-01-01")
    expect(result).toBe("January 1, 2024")
  })
})

// ============ Save Path Regression Tests ============

describe("save path regression: formatLocalDate(new Date())", () => {
  it("formats today's date without timezone shift", () => {
    const now = new Date()
    const formatted = formatLocalDate(now)
    // Should match today's local date components
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    expect(formatted).toBe(expected)
  })

  it("formats a midnight date without shifting", () => {
    const midnight = new Date(2024, 0, 1, 0, 0, 0)
    expect(formatLocalDate(midnight)).toBe("2024-01-01")
  })
})
