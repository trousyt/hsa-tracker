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

  it("returns a safe structured denial only for a definitively different numeric GitHub ID", async () => {
    vi.stubEnv("OWNER_GITHUB_ID", "123")
    const t = convexTest(schema, modules)
    await expect(t.mutation(internal.githubOwner.createUser, {
      method: { ...method, profile: { ...method.profile, id: "456" } },
    })).rejects.toMatchObject({ data: { code: "OWNER_ACCESS_DENIED" } })
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([])
  })

  it.each([undefined, "", "0123", "123 ", "not-numeric"])(
    "keeps configuration failures generic (%s)", async (configured) => {
      vi.stubEnv("OWNER_GITHUB_ID", configured)
      const t = convexTest(schema, modules)
      await expect(t.mutation(internal.githubOwner.createUser, { method })).rejects.not.toHaveProperty("data")
      expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([])
    },
  )

  it("rejects an absent allowlist before creating an owner", async () => {
    vi.stubEnv("OWNER_GITHUB_ID", "")
    const t = convexTest(schema, modules)
    await expect(t.mutation(internal.githubOwner.createUser, { method })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0)
  })
})

// These callback tests assert app-owned invariants, not successful OAuth ticket
// redemption/transaction rollback across mounted components (a separate live gate).
describe("GitHub callback identity and history preservation", () => {
  it("retains owner, financial rows, blobs, legacy auth and audits across retries and mutable profile changes", async () => {
    vi.stubEnv("OWNER_GITHUB_ID", "123")
    const t = convexTest(schema, modules)
    const { userId, storageId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isOwner: true, githubId: "123", name: "Original name" })
      await ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "123" })
      await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1000 })
      const storageId = await ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" }))
      const documentId = await ctx.db.insert("documents", {
        userId, storageId, originalFilename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: 7, ocrStatus: "completed",
      })
      const expenseId = await ctx.db.insert("expenses", {
        userId, datePaid: "2026-01-01", provider: "Example", amountCents: 100,
        documentIds: [documentId], totalReimbursedCents: 50, status: "partial",
      })
      await ctx.db.insert("reimbursements", { userId, expenseId, amountCents: 50, date: "2026-01-02" })
      await ctx.db.insert("securityAuditLogs", { userId, action: "historical-event", timestamp: 1 })
      await ctx.db.insert("fileAccessLogs", { userId, documentId, action: "view", timestamp: 2, success: true })
      return { userId, storageId }
    })
    const snapshot = () => t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      accounts: await ctx.db.query("authAccounts").collect(),
      sessions: await ctx.db.query("authSessions").collect(),
      expenses: await ctx.db.query("expenses").collect(),
      documents: await ctx.db.query("documents").collect(),
      reimbursements: await ctx.db.query("reimbursements").collect(),
      securityAuditLogs: await ctx.db.query("securityAuditLogs").collect(),
      fileAccessLogs: await ctx.db.query("fileAccessLogs").collect(),
      blob: await (await ctx.storage.get(storageId))?.text(),
    }))
    const before = await snapshot()
    const renamedMethod = { ...method, profile: { ...method.profile, login: "renamed", email: "changed@example.com", emailVerified: true } }
    for (const currentMethod of [method, renamedMethod, method]) {
      expect(await t.mutation(internal.githubOwner.createUser, { method: currentMethod })).toBe(userId)
      await t.mutation(internal.githubOwner.onSignIn, { method: currentMethod, userId })
    }
    await expect(t.mutation(internal.githubOwner.onSignIn, {
      method: { ...method, profile: { ...method.profile, id: "456" } }, userId,
    })).rejects.toMatchObject({ data: { code: "OWNER_ACCESS_DENIED" } })
    expect(await snapshot()).toEqual(before)
  })
})
