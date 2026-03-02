/** Shared time range type used by dashboard charts. */
export type TimeRange = "all" | "5y" | "1y" | "6mo" | "ytd"

/** Format "YYYY-MM" as "Jan '24" for X-axis labels. */
export function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split("-")
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const monthIndex = parseInt(monthStr, 10) - 1
  return `${monthNames[monthIndex]} '${yearStr.slice(2)}`
}

/** Format "YYYY-MM" as "March 2024" for tooltip labels. */
export function formatMonthFull(month: string): string {
  const [yearStr, monthStr] = month.split("-")
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return `${monthNames[parseInt(monthStr, 10) - 1]} ${yearStr}`
}
