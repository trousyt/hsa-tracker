import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

const numericGithubId = /^[1-9][0-9]*$/

/** Resolve an allowlisted GitHub identity without reassigning existing records. */
export async function resolveGithubOwner(
  ctx: MutationCtx,
  githubId: string,
  configuredGithubId: string | undefined,
  existingUserId?: Id<"users">,
): Promise<Id<"users">> {
  if (!configuredGithubId || !numericGithubId.test(configuredGithubId) ||
      !numericGithubId.test(githubId) || githubId !== configuredGithubId) {
    throw new Error("GitHub owner authorization failed")
  }

  const users = await ctx.db.query("users").collect()
  const accounts = await ctx.db.query("authAccounts").collect()
  if (users.length === 0) {
    if (existingUserId || accounts.length !== 0 ||
        await ctx.db.query("expenses").first() ||
        await ctx.db.query("documents").first() ||
        await ctx.db.query("reimbursements").first() ||
        await ctx.db.query("ocrUsage").first() ||
        await ctx.db.query("securityAuditLogs").first() ||
        await ctx.db.query("fileAccessLogs").first() ||
        await ctx.db.query("authSessions").first() ||
        await ctx.db.query("authRefreshTokens").first() ||
        await ctx.db.query("authVerificationCodes").first() ||
        await ctx.db.query("authVerifiers").first() ||
        await ctx.db.query("authRateLimits").first() ||
        await ctx.db.system.query("_storage").first()) {
      throw new Error("Cannot initialize a nonempty environment")
    }
    return await ctx.db.insert("users", { isOwner: true, githubId })
  }

  if (users.length !== 1 || !users[0].isOwner || users[0].githubId !== githubId ||
      (existingUserId !== undefined && existingUserId !== users[0]._id)) {
    throw new Error("Ambiguous owner mapping")
  }
  const owner = users[0]
  const githubAccounts = accounts.filter((account) => account.provider === "github")
  if (accounts.some((account) => account.userId !== owner._id) ||
      githubAccounts.length > 1 ||
      githubAccounts.some((account) => account.providerAccountId !== githubId) ||
      (existingUserId === undefined && githubAccounts.length !== 1)) {
    throw new Error("Ambiguous legacy account mapping")
  }

  for (const table of ["expenses", "documents", "reimbursements"] as const) {
    const records = await ctx.db.query(table).collect()
    if (records.some((record) => record.userId !== owner._id)) {
      throw new Error("Ambiguous record ownership")
    }
  }
  return owner._id
}
