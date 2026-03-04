/** Allowed MIME types for document uploads. */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Maximum number of expenses in a single batch import. */
export const MAX_BATCH_SIZE = 500

/** Maximum OCR pages processed per calendar month. */
export const MAX_OCR_PAGES_PER_MONTH = 200

/** Maximum target amount in cents for the reimbursement optimizer ($10,000). */
export const MAX_TARGET_CENTS = 1_000_000
