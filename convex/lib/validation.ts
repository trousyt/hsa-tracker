import { EXPENSE_CATEGORY_VALUES } from "../../src/lib/constants/expense-categories"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Validate that amountCents is a positive integer. */
export function validateAmountCents(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error("Amount must be a positive integer (cents)")
  }
}

/** Validate that provider is non-empty and within length limit. */
export function validateProvider(value: string): void {
  if (!value.trim()) {
    throw new Error("Provider cannot be empty")
  }
  if (value.length > 200) {
    throw new Error("Provider must be 200 characters or fewer")
  }
}

/** Validate that datePaid is a valid calendar date in YYYY-MM-DD format. */
export function validateDatePaid(value: string): void {
  if (!DATE_REGEX.test(value)) {
    throw new Error("Date must be in YYYY-MM-DD format")
  }
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error("Date must be in YYYY-MM-DD format")
  }
}

/** Validate that category is in the allowlist, or null/undefined. */
export function validateCategory(value: string | null | undefined): void {
  if (value === null || value === undefined) return
  if (!(EXPENSE_CATEGORY_VALUES as readonly string[]).includes(value)) {
    throw new Error(`Invalid category: ${value}`)
  }
}

/** Validate all provided expense fields. Only validates fields that are present. */
export function validateExpenseFields(fields: {
  amountCents?: number
  provider?: string
  datePaid?: string
  category?: string | null
}): void {
  if (fields.amountCents !== undefined) validateAmountCents(fields.amountCents)
  if (fields.provider !== undefined) validateProvider(fields.provider)
  if (fields.datePaid !== undefined) validateDatePaid(fields.datePaid)
  if ("category" in fields) validateCategory(fields.category)
}
