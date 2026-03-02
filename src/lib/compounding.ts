/**
 * Compounding savings calculation for HSA investment strategy.
 *
 * Uses a portfolio simulation: expenses add to the invested balance,
 * reimbursements withdraw. The balance grows monthly at a rate derived
 * from the S&P 500 average annual return (10% nominal).
 */

/** Annual return rate (S&P 500 average) */
const ANNUAL_RATE = 0.10

/** Monthly compounding rate: (1 + annual)^(1/12) - 1 */
export const MONTHLY_RATE = Math.pow(1 + ANNUAL_RATE, 1 / 12) - 1

export interface CompoundingExpense {
  datePaid: string // "YYYY-MM-DD"
  amountCents: number
  reimbursements: Array<{
    date: string // "YYYY-MM-DD"
    amountCents: number
  }>
}

export interface CompoundingDataPoint {
  month: string // "YYYY-MM"
  cumulativeGainCents: number
}

export interface CompoundingResult {
  /** Monthly data points for chart rendering */
  dataPoints: CompoundingDataPoint[]
  /** Total gains as of today */
  totalGainCents: number
  /** Total currently invested (expenses minus reimbursements) */
  totalInvestedCents: number
}

/**
 * Extract "YYYY-MM" from an ISO date string.
 */
function toMonth(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/**
 * Generate a sequence of "YYYY-MM" strings from startMonth to endMonth inclusive.
 */
export function generateMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = []
  const [startY, startM] = startMonth.split("-").map(Number)
  const [endY, endM] = endMonth.split("-").map(Number)

  let y = startY
  let m = startM

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  return months
}

/**
 * Get today's date as "YYYY-MM-DD" in local time.
 */
function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Calculate compounding savings using a portfolio simulation.
 *
 * For each month from the earliest expense to today:
 * 1. Add any new expenses (contributions) that fall in this month
 * 2. Subtract any reimbursements (withdrawals) that fall in this month
 * 3. Grow the balance by the monthly rate
 * 4. Record the cumulative gain (balance - net contributions)
 */
export function calculateCompounding(
  expenses: CompoundingExpense[],
  asOfDate?: string
): CompoundingResult {
  if (expenses.length === 0) {
    return { dataPoints: [], totalGainCents: 0, totalInvestedCents: 0 }
  }

  const endDate = asOfDate ?? todayISO()
  const endMonth = toMonth(endDate)

  // Build a map of month -> net contributions (expenses minus reimbursements)
  const monthlyContributions = new Map<string, number>()

  for (const expense of expenses) {
    const month = toMonth(expense.datePaid)
    monthlyContributions.set(
      month,
      (monthlyContributions.get(month) ?? 0) + expense.amountCents
    )

    for (const reimb of expense.reimbursements) {
      const rMonth = toMonth(reimb.date)
      monthlyContributions.set(
        rMonth,
        (monthlyContributions.get(rMonth) ?? 0) - reimb.amountCents
      )
    }
  }

  // Find the earliest month across all events
  const allMonths = [...monthlyContributions.keys()].sort()
  const startMonth = allMonths[0]

  if (!startMonth || startMonth > endMonth) {
    return { dataPoints: [], totalGainCents: 0, totalInvestedCents: 0 }
  }

  // Simulate month by month
  const monthRange = generateMonthRange(startMonth, endMonth)
  const dataPoints: CompoundingDataPoint[] = []
  let balance = 0
  let totalContributions = 0

  for (const month of monthRange) {
    // Apply contributions/withdrawals for this month
    const contribution = monthlyContributions.get(month) ?? 0
    balance += contribution
    totalContributions += contribution

    // Grow the balance (compound interest)
    balance = balance * (1 + MONTHLY_RATE)

    // Record the gain (balance minus what was put in)
    const gain = Math.round(balance - totalContributions)
    dataPoints.push({
      month,
      cumulativeGainCents: gain,
    })
  }

  const lastPoint = dataPoints[dataPoints.length - 1]

  return {
    dataPoints,
    totalGainCents: lastPoint?.cumulativeGainCents ?? 0,
    totalInvestedCents: Math.round(totalContributions),
  }
}

/**
 * Filter compounding data to show only YTD gains.
 *
 * YTD gain for each month = cumulativeGain(month) - cumulativeGain(Dec 31 of previous year)
 */
export function filterYTD(
  result: CompoundingResult,
  year?: number
): CompoundingResult {
  const targetYear = year ?? new Date().getFullYear()
  const yearStr = String(targetYear)
  const prevYearLastMonth = `${targetYear - 1}-12`

  // Find the cumulative gain at the end of the previous year
  const prevYearPoint = result.dataPoints.find(
    (dp) => dp.month === prevYearLastMonth
  )
  const baselineGain = prevYearPoint?.cumulativeGainCents ?? 0

  // Filter to only months in the target year and subtract the baseline
  const ytdPoints = result.dataPoints
    .filter((dp) => dp.month.startsWith(yearStr))
    .map((dp) => ({
      month: dp.month,
      cumulativeGainCents: dp.cumulativeGainCents - baselineGain,
    }))

  const lastPoint = ytdPoints[ytdPoints.length - 1]

  return {
    dataPoints: ytdPoints,
    totalGainCents: lastPoint?.cumulativeGainCents ?? 0,
    totalInvestedCents: result.totalInvestedCents,
  }
}
