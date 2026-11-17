import { convexTest } from "convex-test"
import { afterEach, describe, expect, it, vi } from "vitest"
import { internal } from "./_generated/api"
import schema from "./schema"
import { modules } from "./test.setup"

const method = { name: "github" as const, profile: { id: "123", login: "owner", emailVerified: false } }

afterEach(() => vi.unstubAllEnvs())

describe("GitHub owner callbacks", () => {
  it("return the existing legacy owner and enforce the policy on every sign-in", async () => {
    vi.stubEnv("OWNER_GITHUB_ID", "123")
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const owner = await ctx.db.insert("users", { isOwner: true, githubId: "123" })
      await ctx.db.insert("authAccounts", { userId: owner, provider: "github", providerAccountId: "123" })
      return owner
    })
    expect(await t.mutation(internal.githubOwner.createUser, { method })).toBe(userId)
    expect(await t.mutation(internal.githubOwner.onSignIn, { method, userId })).toBeNull()
    vi.stubEnv("OWNER_GITHUB_ID", "456")
    await expect(t.mutation(internal.githubOwner.onSignIn, { method, userId })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1)
  })

  it("rejects an absent allowlist before creating an owner", async () => {
    vi.stubEnv("OWNER_GITHUB_ID", "")
    const t = convexTest(schema, modules)
    await expect(t.mutation(internal.githubOwner.createUser, { method })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0)
  })
})
