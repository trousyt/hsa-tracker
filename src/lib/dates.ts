/**
 * Date utilities for timezone-safe date handling.
 *
 * ISO date strings like "2024-01-15" are parsed by `new Date()` as UTC midnight,
 * which can shift the displayed date backward by one day in western timezones.
 * These utilities avoid UTC by constructing dates with local-time components.
 */

/**
 * Parse an ISO date string ("YYYY-MM-DD") into a local-time Date object.
 *
 * Using `new Date("2024-01-15")` interprets the string as UTC midnight,
 * which displays as the previous day in timezones behind UTC (e.g., US timezones).
 * This function splits the string and uses `new Date(year, month - 1, day)`
 * to create a midnight date in the user's local timezone instead.
 */
export function parseLocalDate(isoString: string): Date {
  const [year, month, day] = isoString.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a Date object as an ISO date string ("YYYY-MM-DD") using local time.
 *
 * Unlike `date.toISOString().split("T")[0]` which uses UTC and can shift
 * the date, this reads the local year/month/day components directly.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Parse an ISO date string and format it for display using the user's locale.
 *
 * Convenience wrapper that avoids the UTC-shift bug in display paths.
 * Defaults to "en-US" locale with long month, numeric day and year.
 */
export function displayLocalDate(
  isoString: string,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  const date = parseLocalDate(isoString)
  return date.toLocaleDateString(locale, options)
}
