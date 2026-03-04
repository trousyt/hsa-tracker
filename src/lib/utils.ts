import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract a user-friendly error message from an error, stripping Convex
 * server internals (request IDs, validator details, stack traces).
 * Falls back to the provided default message for server errors.
 */
export function getUserErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!(error instanceof Error)) return fallback

  const msg = error.message
  // Convex server errors contain these markers — never show them to users
  if (
    msg.includes("Server Error") ||
    msg.includes("[CONVEX") ||
    msg.includes("Validator:") ||
    msg.includes("Request ID:")
  ) {
    return fallback
  }

  return msg
}
