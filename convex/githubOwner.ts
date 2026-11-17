import { v } from "convex/values"
import { vGithubProfile } from "@convex-dev/auth/methods/github/server"
import { internalMutation } from "./_generated/server"
import { resolveGithubOwner } from "./lib/ownerMigration"

const githubMethod = v.object({ name: v.literal("github"), profile: vGithubProfile })

/** Link the attested GitHub identity to the unambiguous legacy owner. */
export const createUser = internalMutation({
  args: { method: githubMethod },
  returns: v.id("users"),
  handler: async (ctx, { method }) =>
    await resolveGithubOwner(ctx, method.profile.id, process.env.OWNER_GITHUB_ID),
})

/** Enforce the same owner policy for every successful GitHub sign-in. */
export const onSignIn = internalMutation({
  args: { method: githubMethod, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { method, userId }) => {
    await resolveGithubOwner(ctx, method.profile.id, process.env.OWNER_GITHUB_ID, userId)
    return null
  },
})
