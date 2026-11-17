import { afterEach, describe, expect, it, vi } from "vitest"
import { sessionIdentity } from "@convex-dev/auth/test"
import { api } from "../_generated/api"
import { createSessionContext, signUpTestUser } from "../../src/test/session.fixture"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("v2 session authorization through protected application operations", () => {
  it("isolates financial records from another real session without allowing mutations", async () => {
    const { t, authed } = await createSessionContext()
    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-01", provider: "Example", amountCents: 100,
    })
    const reimbursementId = await authed.mutation(api.reimbursements.record, { expenseId, amountCents: 50 })
    const otherResult = await t.mutation(signUpTestUser, { username: "otheruser", password: "correct horse battery staple" })
    if (!otherResult.tokens) throw new Error("Test sign-up failed")
    const other = t.withIdentity(sessionIdentity(otherResult.tokens))
    expect(await other.query(api.expenses.list, {})).toEqual([])
    expect(await other.query(api.reimbursements.getByExpense, { expenseId })).toEqual([])
    await expect(other.mutation(api.expenses.update, { id: expenseId, amountCents: 200 })).rejects.toThrow()
    await expect(other.mutation(api.reimbursements.record, { expenseId, amountCents: 50 })).rejects.toThrow()
    await expect(other.mutation(api.reimbursements.undo, { reimbursementId })).rejects.toThrow()
    expect(await authed.query(api.expenses.get, { id: expenseId })).toMatchObject({ amountCents: 100, totalReimbursedCents: 50 })
  })

  it.each(["sign-out", "expiry"])("denies reads and writes after %s without changing financial history", async (endSession) => {
    const { t, authed, tokens } = await createSessionContext()
    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-01", provider: "Example", amountCents: 100,
    })
    const reimbursementId = await authed.mutation(api.reimbursements.record, { expenseId, amountCents: 50 })
    const snapshot = () => t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      expenses: await ctx.db.query("expenses").collect(),
      reimbursements: await ctx.db.query("reimbursements").collect(),
    }))
    const before = await snapshot()
    if (endSession === "sign-out") {
      await t.mutation(api.authV2.signOut, { refreshToken: tokens.refreshToken })
    } else {
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000)
      expect(await t.mutation(api.authV2.refreshSession, { refreshToken: tokens.refreshToken })).toEqual({ kind: "noSession" })
    }
    expect(await authed.query(api.expenses.get, { id: expenseId })).toBeNull()
    expect(await authed.query(api.expenses.list, {})).toEqual([])
    expect(await authed.query(api.reimbursements.getByExpense, { expenseId })).toEqual([])
    await expect(authed.mutation(api.expenses.update, { id: expenseId, amountCents: 200 })).rejects.toThrow("Not authenticated")
    await expect(authed.mutation(api.reimbursements.undo, { reimbursementId })).rejects.toThrow("Not authenticated")
    await expect(authed.mutation(api.documents.generateUploadUrl, {})).rejects.toThrow("Not authenticated")
    expect(await snapshot()).toEqual(before)
  })

  it("refreshes a valid session while retaining the application identity and record access", async () => {
    const { t, authed, tokens, userId } = await createSessionContext()
    const expenseId = await authed.mutation(api.expenses.create, {
      datePaid: "2026-01-01", provider: "Example", amountCents: 100,
    })
    const refreshed = await t.mutation(api.authV2.refreshSession, { refreshToken: tokens.refreshToken })
    expect(refreshed.kind).toBe("rotated")
    if (refreshed.kind !== "rotated") throw new Error("Test session did not refresh")
    expect(refreshed.tokens.userId).toBe(userId)
    expect(await t.withIdentity(sessionIdentity(refreshed.tokens)).query(api.expenses.get, { id: expenseId })).toMatchObject({ userId })
  })
})
