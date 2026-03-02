/**
 * Currency utilities for handling monetary values.
 * All amounts are stored as integer cents to avoid floating-point errors.
 */

/**
 * Convert dollars to cents (integer)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Convert cents to dollars (for display)
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Format cents as a currency string (e.g., "$25.50")
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents))
}

/**
 * Format dollars as a currency string (e.g., "$25.50")
 * Use when you already have a dollar amount (not cents)
 */
export function formatDollars(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars)
}

/**
 * Format cents as an abbreviated currency string for chart axes.
 * Under $1K: "$850", $1K-$999K: "$1.2K", $1M+: "$1.2M"
 */
export function formatCurrencyShort(cents: number): string {
  const dollars = Math.abs(centsToDollars(cents))
  const sign = cents < 0 ? "-" : ""

  if (dollars < 1000) {
    return `${sign}$${Math.round(dollars)}`
  }
  if (dollars < 1_000_000) {
    const k = dollars / 1000
    const kRounded = Math.round(k * 10) / 10
    if (kRounded < 1000) {
      return `${sign}$${kRounded % 1 === 0 ? kRounded.toFixed(0) : kRounded.toFixed(1)}K`
    }
    // Boundary: rounding pushed K to 1000+, fall through to M
  }
  const m = dollars / 1_000_000
  const mRounded = Math.round(m * 10) / 10
  return `${sign}$${mRounded % 1 === 0 ? mRounded.toFixed(0) : mRounded.toFixed(1)}M`
}

/**
 * Parse a currency input string to cents
 * Handles formats like: "25.50", "$25.50", "25", "25.5"
 */
export function parseCurrencyToCents(input: string): number | null {
  // Remove currency symbol and whitespace
  const cleaned = input.replace(/[$,\s]/g, "").trim()

  if (!cleaned) return null

  const parsed = parseFloat(cleaned)

  if (isNaN(parsed) || parsed < 0) return null

  return dollarsToCents(parsed)
}
