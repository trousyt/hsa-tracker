import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import schema from "../schema"
import { modules } from "../test.setup"
import { resolveGithubOwner } from "./ownerMigration"

describe("resolveGithubOwner", () => {
  it("returns the existing owner only when its legacy GitHub account matches", async () => {
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isOwner: true, githubId: "123" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "123" })
      return userId
    })
    expect(await t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))).toBe(ownerId)
    expect(await t.run((ctx) => resolveGithubOwner(ctx, "123", "123", ownerId))).toBe(ownerId)
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1)
  })

  it("rejects missing or invalid configuration and other accounts", async () => {
    const t = convexTest(schema, modules)
    for (const [profile, configured] of [["123", undefined], ["123", "0123"], ["456", "123"]] as const) {
      await expect(t.run((ctx) => resolveGithubOwner(ctx, profile, configured))).rejects.toThrow()
    }
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0)
  })

  it("rejects ambiguous legacy mappings without creating a user", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isOwner: true, githubId: "123" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "123" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "123" })
    })
    await expect(t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1)
  })

  it("rejects an owner with a mismatched legacy account or returning user", async () => {
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isOwner: true, githubId: "123" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "456" })
      return userId
    })
    await expect(t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))).rejects.toThrow()
    await expect(t.run((ctx) => resolveGithubOwner(ctx, "123", "123", ownerId))).rejects.toThrow()
  })

  it("rejects unowned records when a legacy owner exists", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isOwner: true, githubId: "123" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "123" })
      await ctx.db.insert("expenses", {
        datePaid: "2026-01-01", provider: "Example", amountCents: 100,
        documentIds: [], totalReimbursedCents: 0, status: "unreimbursed",
      })
    })
    await expect(t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))).rejects.toThrow()
  })

  it("creates the allowlisted owner only in an empty environment", async () => {
    const t = convexTest(schema, modules)
    const ownerId = await t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))
    expect(await t.run((ctx) => ctx.db.get(ownerId))).toMatchObject({ isOwner: true, githubId: "123" })
  })

  it("does not claim existing data in a userless environment", async () => {
    const t = convexTest(schema, modules)
    await t.run((ctx) => ctx.db.insert("expenses", {
      datePaid: "2026-01-01", provider: "Example", amountCents: 100,
      documentIds: [], totalReimbursedCents: 0, status: "unreimbursed",
    }))
    await expect(t.run((ctx) => resolveGithubOwner(ctx, "123", "123"))).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0)
  })
})
