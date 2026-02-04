import { getAuthUserId } from "@convex-dev/auth/server"
import type { QueryCtx, MutationCtx } from "../_generated/server"

/**
 * Require authentication and return the user ID.
 * Throws an error if the user is not authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new Error("Not authenticated")
  }
  return userId as unknown as string
}

/**
 * Get the user ID if authenticated, or null if not.
 * Use this for queries that should return empty results for unauthenticated users
 * instead of throwing an error.
 */
export async function getOptionalAuth(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const userId = await getAuthUserId(ctx)
  return userId ? (userId as unknown as string) : null
}
