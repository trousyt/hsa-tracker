import { describe, it, expect } from "vitest"
import {
  calculateCompounding,
  filterYTD,
  generateMonthRange,
  MONTHLY_RATE,
  type CompoundingExpense,
} from "./compounding"

// ============ generateMonthRange Tests ============

describe("generateMonthRange", () => {
  it("generates a single month", () => {
    expect(generateMonthRange("2024-06", "2024-06")).toEqual(["2024-06"])
  })

  it("generates months within a year", () => {
    expect(generateMonthRange("2024-01", "2024-03")).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
    ])
  })

  it("generates months across year boundaries", () => {
    expect(generateMonthRange("2024-11", "2025-02")).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ])
  })

  it("returns empty if start is after end", () => {
    expect(generateMonthRange("2025-01", "2024-01")).toEqual([])
  })
})

// ============ calculateCompounding Tests ============

describe("calculateCompounding", () => {
  it("returns empty result for no expenses", () => {
    const result = calculateCompounding([])
    expect(result.dataPoints).toEqual([])
    expect(result.totalGainCents).toBe(0)
    expect(result.totalInvestedCents).toBe(0)
  })

  it("calculates compound growth for a single expense over 12 months", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 100000, // $1,000
        reimbursements: [],
      },
    ]

    const result = calculateCompounding(expenses, "2024-12-31")

    // $1,000 compounded monthly for 12 months at 10% annual
    // Expected: $1,000 * (1 + MONTHLY_RATE)^12 - $1,000
    const expectedGain = 100000 * (Math.pow(1 + MONTHLY_RATE, 12) - 1)
    expect(result.totalGainCents).toBeCloseTo(expectedGain, 0)
    expect(result.dataPoints).toHaveLength(12)

    // First month should have a small gain
    expect(result.dataPoints[0].cumulativeGainCents).toBeGreaterThan(0)

    // Gains should be monotonically increasing
    for (let i = 1; i < result.dataPoints.length; i++) {
      expect(result.dataPoints[i].cumulativeGainCents).toBeGreaterThan(
        result.dataPoints[i - 1].cumulativeGainCents
      )
    }
  })

  it("returns zero gains when fully reimbursed immediately", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 100000,
        reimbursements: [{ date: "2024-01-15", amountCents: 100000 }],
      },
    ]

    const result = calculateCompounding(expenses, "2024-06-30")

    // Net contribution is 0, so balance is 0, gain is 0
    // All data points should be 0
    for (const dp of result.dataPoints) {
      expect(dp.cumulativeGainCents).toBe(0)
    }
    expect(result.totalGainCents).toBe(0)
  })

  it("handles partial reimbursement with carry-forward gains", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 100000, // $1,000
        reimbursements: [{ date: "2024-07-15", amountCents: 30000 }], // $300 reimbursed after 6 months
      },
    ]

    const result = calculateCompounding(expenses, "2024-12-31")

    // After 6 months: balance = $1,000 * (1+r)^6, then subtract $300
    // The remaining balance includes gains from first 6 months
    // So total gain should be more than if we just invested $700 for 12 months
    const naiveGain = 70000 * (Math.pow(1 + MONTHLY_RATE, 12) - 1)
    expect(result.totalGainCents).toBeGreaterThan(Math.round(naiveGain))

    // Verify the total invested is $700 (1000 - 300)
    expect(result.totalInvestedCents).toBe(70000)
  })

  it("handles multiple expenses at different dates", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 50000, // $500
        reimbursements: [],
      },
      {
        datePaid: "2024-06-15",
        amountCents: 30000, // $300
        reimbursements: [],
      },
    ]

    const result = calculateCompounding(expenses, "2024-12-31")

    // Both should be contributing to gains
    expect(result.totalGainCents).toBeGreaterThan(0)
    expect(result.totalInvestedCents).toBe(80000)
    expect(result.dataPoints).toHaveLength(12)

    // Gain should jump when second expense is added
    const junGain = result.dataPoints[5].cumulativeGainCents
    const julGain = result.dataPoints[6].cumulativeGainCents
    // The increase from Jun to Jul should be larger than May to Jun
    // because more principal is invested
    const mayToJun = junGain - result.dataPoints[4].cumulativeGainCents
    const junToJul = julGain - junGain
    expect(junToJul).toBeGreaterThan(mayToJun)
  })

  it("handles expense dated at the end of the simulation period", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-12-15",
        amountCents: 100000,
        reimbursements: [],
      },
    ]

    const result = calculateCompounding(expenses, "2024-12-31")

    // Only 1 month of compounding
    expect(result.dataPoints).toHaveLength(1)
    expect(result.totalGainCents).toBeGreaterThan(0)
    expect(result.totalGainCents).toBeLessThan(1000) // Should be small (~$8)
  })

  it("does not go negative when reimbursement exceeds current balance", () => {
    // Edge case: reimbursement in same month as expense but larger
    // (shouldn't happen in real data, but be safe)
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 50000,
        reimbursements: [{ date: "2024-01-20", amountCents: 50000 }],
      },
    ]

    const result = calculateCompounding(expenses, "2024-06-30")

    // Balance should be 0 (or very close), not negative
    for (const dp of result.dataPoints) {
      expect(dp.cumulativeGainCents).toBeGreaterThanOrEqual(-1) // Allow rounding
    }
  })

  it("handles multiple partial reimbursements over time", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-01-15",
        amountCents: 100000, // $1,000
        reimbursements: [
          { date: "2024-04-01", amountCents: 20000 }, // $200
          { date: "2024-08-01", amountCents: 30000 }, // $300
        ],
      },
    ]

    const result = calculateCompounding(expenses, "2024-12-31")

    // Net invested: $1000 - $200 - $300 = $500
    expect(result.totalInvestedCents).toBe(50000)
    expect(result.totalGainCents).toBeGreaterThan(0)
    expect(result.dataPoints).toHaveLength(12)
  })
})

// ============ filterYTD Tests ============

describe("filterYTD", () => {
  it("filters to only current year months", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2023-01-15",
        amountCents: 100000,
        reimbursements: [],
      },
    ]

    const fullResult = calculateCompounding(expenses, "2025-06-30")
    const ytdResult = filterYTD(fullResult, 2025)

    // Should only have 2025 months
    expect(ytdResult.dataPoints.every((dp) => dp.month.startsWith("2025"))).toBe(true)
    expect(ytdResult.dataPoints).toHaveLength(6) // Jan-Jun 2025
  })

  it("subtracts previous year baseline from gains", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2023-01-15",
        amountCents: 100000,
        reimbursements: [],
      },
    ]

    const fullResult = calculateCompounding(expenses, "2025-06-30")
    const ytdResult = filterYTD(fullResult, 2025)

    // YTD gains should be less than total gains
    expect(ytdResult.totalGainCents).toBeLessThan(fullResult.totalGainCents)
    expect(ytdResult.totalGainCents).toBeGreaterThan(0)

    // The baseline is the cumulative gain at end of 2024
    const dec2024Point = fullResult.dataPoints.find(
      (dp) => dp.month === "2024-12"
    )
    expect(dec2024Point).toBeDefined()

    // First YTD month's gain = Jan 2025 cumulative gain - Dec 2024 cumulative gain
    const jan2025Full = fullResult.dataPoints.find(
      (dp) => dp.month === "2025-01"
    )!
    expect(ytdResult.dataPoints[0].cumulativeGainCents).toBe(
      jan2025Full.cumulativeGainCents - dec2024Point!.cumulativeGainCents
    )
  })

  it("returns empty for year with no data", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2024-06-15",
        amountCents: 100000,
        reimbursements: [],
      },
    ]

    const fullResult = calculateCompounding(expenses, "2024-12-31")
    const ytdResult = filterYTD(fullResult, 2030)

    expect(ytdResult.dataPoints).toEqual([])
    expect(ytdResult.totalGainCents).toBe(0)
  })

  it("works when expenses start in the YTD year", () => {
    const expenses: CompoundingExpense[] = [
      {
        datePaid: "2025-03-15",
        amountCents: 50000,
        reimbursements: [],
      },
    ]

    const fullResult = calculateCompounding(expenses, "2025-06-30")
    const ytdResult = filterYTD(fullResult, 2025)

    // No baseline (no data before 2025), so YTD = full gains
    expect(ytdResult.totalGainCents).toBe(fullResult.totalGainCents)
  })
})
