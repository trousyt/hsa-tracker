/**
 * IRS-aligned HSA qualified medical expense categories.
 * Based on IRS Publication 502.
 * @see https://www.irs.gov/publications/p502
 */

// Define values as const tuple for proper type inference with z.enum()
export const EXPENSE_CATEGORY_VALUES = [
  "medical-services",
  "dental-care",
  "vision-care",
  "prescriptions",
  "mental-health",
  "hospital-facility",
  "lab-diagnostic",
  "physical-therapy",
  "chiropractic",
  "medical-equipment",
  "medical-supplies",
  "hearing",
  "nursing-home-care",
  "transportation",
  "long-term-care",
  "preventive-care",
  "other-qualified",
] as const

// Derive union type from const tuple
export type ExpenseCategory = (typeof EXPENSE_CATEGORY_VALUES)[number]

// Full category metadata with type-safe values
export const EXPENSE_CATEGORIES = [
  {
    value: "medical-services",
    label: "Medical Services",
    description: "Doctor visits, specialists, exams",
  },
  {
    value: "dental-care",
    label: "Dental Care",
    description: "Fillings, extractions, dentures, braces",
  },
  {
    value: "vision-care",
    label: "Vision Care",
    description: "Exams, glasses, contacts, surgery",
  },
  {
    value: "prescriptions",
    label: "Prescriptions",
    description: "Rx drugs, insulin",
  },
  {
    value: "mental-health",
    label: "Mental Health",
    description: "Therapy, psychiatry, counseling",
  },
  {
    value: "hospital-facility",
    label: "Hospital/Facility",
    description: "Inpatient, outpatient, ER",
  },
  {
    value: "lab-diagnostic",
    label: "Lab & Diagnostic",
    description: "Blood work, imaging, tests",
  },
  {
    value: "physical-therapy",
    label: "Physical Therapy",
    description: "PT sessions, rehabilitation",
  },
  {
    value: "chiropractic",
    label: "Chiropractic",
    description: "Chiropractic adjustments, care",
  },
  {
    value: "medical-equipment",
    label: "Medical Equipment",
    description: "Monitors, CPAP, mobility aids",
  },
  {
    value: "medical-supplies",
    label: "Medical Supplies",
    description: "Bandages, first aid, OTC eligible",
  },
  {
    value: "hearing",
    label: "Hearing",
    description: "Exams, hearing aids, batteries",
  },
  {
    value: "nursing-home-care",
    label: "Nursing/Home Care",
    description: "Nursing services, home health",
  },
  {
    value: "transportation",
    label: "Transportation",
    description: "Medical travel, mileage, parking",
  },
  {
    value: "long-term-care",
    label: "Long-Term Care",
    description: "Long-term care services",
  },
  {
    value: "preventive-care",
    label: "Preventive Care",
    description: "Vaccines, screenings",
  },
  {
    value: "other-qualified",
    label: "Other Qualified Expense",
    description: "Other IRS-qualified expenses",
  },
] as const satisfies readonly {
  value: ExpenseCategory
  label: string
  description: string
}[]

// Type-safe label lookup
export function getCategoryLabel(
  value: ExpenseCategory | undefined | null
): string {
  if (!value) return "Uncategorized"
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

// Type guard for validating unknown strings (useful for CSV import)
export function isValidCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    (EXPENSE_CATEGORY_VALUES as readonly string[]).includes(value)
  )
}
