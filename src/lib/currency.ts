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
