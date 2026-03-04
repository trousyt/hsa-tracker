import { expect, test, describe } from "vitest"
import {
  validateAmountCents,
  validateProvider,
  validateDatePaid,
  validateCategory,
  validateExpenseFields,
} from "./validation"

describe("validateAmountCents", () => {
  test("accepts positive integers", () => {
    expect(() => validateAmountCents(100)).not.toThrow()
    expect(() => validateAmountCents(1)).not.toThrow()
    expect(() => validateAmountCents(9999999)).not.toThrow()
  })

  test("rejects zero", () => {
    expect(() => validateAmountCents(0)).toThrow("positive integer")
  })

  test("rejects negative numbers", () => {
    expect(() => validateAmountCents(-100)).toThrow("positive integer")
  })

  test("rejects floating point", () => {
    expect(() => validateAmountCents(10.5)).toThrow("positive integer")
  })

  test("rejects NaN", () => {
    expect(() => validateAmountCents(NaN)).toThrow("positive integer")
  })

  test("rejects Infinity", () => {
    expect(() => validateAmountCents(Infinity)).toThrow("positive integer")
  })
})

describe("validateProvider", () => {
  test("accepts normal strings", () => {
    expect(() => validateProvider("Dr. Smith")).not.toThrow()
  })

  test("rejects empty string", () => {
    expect(() => validateProvider("")).toThrow("cannot be empty")
  })

  test("rejects whitespace-only", () => {
    expect(() => validateProvider("   ")).toThrow("cannot be empty")
  })

  test("rejects strings over 200 chars", () => {
    expect(() => validateProvider("a".repeat(201))).toThrow("200 characters")
  })

  test("accepts exactly 200 chars", () => {
    expect(() => validateProvider("a".repeat(200))).not.toThrow()
  })
})

describe("validateDatePaid", () => {
  test("accepts YYYY-MM-DD format", () => {
    expect(() => validateDatePaid("2026-01-15")).not.toThrow()
    expect(() => validateDatePaid("2020-12-31")).not.toThrow()
  })

  test("rejects invalid formats", () => {
    expect(() => validateDatePaid("01-15-2026")).toThrow("YYYY-MM-DD")
    expect(() => validateDatePaid("2026/01/15")).toThrow("YYYY-MM-DD")
    expect(() => validateDatePaid("not-a-date")).toThrow("YYYY-MM-DD")
    expect(() => validateDatePaid("")).toThrow("YYYY-MM-DD")
  })

  test("rejects invalid calendar dates", () => {
    expect(() => validateDatePaid("2026-02-31")).toThrow("YYYY-MM-DD")
    expect(() => validateDatePaid("2026-04-31")).toThrow("YYYY-MM-DD")
    expect(() => validateDatePaid("2025-02-29")).toThrow("YYYY-MM-DD") // 2025 not a leap year
  })

  test("accepts valid leap year date", () => {
    expect(() => validateDatePaid("2024-02-29")).not.toThrow() // 2024 is a leap year
  })
})

describe("validateCategory", () => {
  test("accepts valid categories", () => {
    expect(() => validateCategory("dental-care")).not.toThrow()
    expect(() => validateCategory("prescriptions")).not.toThrow()
  })

  test("accepts null and undefined", () => {
    expect(() => validateCategory(null)).not.toThrow()
    expect(() => validateCategory(undefined)).not.toThrow()
  })

  test("rejects invalid category strings", () => {
    expect(() => validateCategory("invalid-category")).toThrow("Invalid category")
  })
})

describe("validateExpenseFields", () => {
  test("validates all fields together", () => {
    expect(() =>
      validateExpenseFields({
        amountCents: 1500,
        provider: "Dr. Smith",
        datePaid: "2026-01-15",
      })
    ).not.toThrow()
  })

  test("validates partial fields for updates", () => {
    expect(() =>
      validateExpenseFields({ amountCents: 1500 })
    ).not.toThrow()
  })

  test("throws on first invalid field", () => {
    expect(() =>
      validateExpenseFields({ amountCents: -1 })
    ).toThrow("positive integer")
  })
})
