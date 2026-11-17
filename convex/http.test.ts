import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import schema from "./schema"
import { modules } from "./test.setup"
import { sessionIdentity } from "@convex-dev/auth/test"
import { makeFunctionReference } from "convex/server"
import { createSessionContext, signUpTestUser } from "../src/test/session.fixture"

describe("secure file HTTP endpoint", () => {
  test("rejects anonymous requests for a valid document without writing an audit log", async () => {
    const t = convexTest(schema, modules)
    const documentId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" }))
      return await ctx.db.insert("documents", {
        userId: "owner",
        storageId,
        originalFilename: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 7,
        ocrStatus: "completed",
      })
    })

    const response = await t.fetch(`/api/files/${documentId}`)
    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer")
    expect(await t.run(async (ctx) => ctx.db.query("fileAccessLogs").collect())).toEqual([])
  })

  test("serves an owner's file and denies a different identity", async () => {
    const { t, authed: owner, userId, tokens } = await createSessionContext()
    const documentId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" }))
      return await ctx.db.insert("documents", {
        userId,
        storageId,
        originalFilename: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 7,
        ocrStatus: "completed",
      })
    })

    const otherResult = await t.mutation(signUpTestUser, { username: "otheruser", password: "correct horse battery staple" })
    if (!otherResult.tokens) throw new Error("Test sign-up failed")
    const other = t.withIdentity(sessionIdentity(otherResult.tokens))
    const invalidSession = t.withIdentity({ subject: "invalid-session" })
    expect((await invalidSession.fetch(`/api/files/${documentId}`)).status).toBe(401)
    const denied = await other.fetch(`/api/files/${documentId}`)
    expect(denied.status).toBe(403)
    const response = await owner.fetch(`/api/files/${documentId}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("receipt")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0")
    const signOut = makeFunctionReference<"mutation", { refreshToken: string }, null>("authV2:signOut")
    await t.mutation(signOut, { refreshToken: tokens.refreshToken })
    expect((await owner.fetch(`/api/files/${documentId}`)).status).toBe(401)
  })

  test("rejects an invalid document ID", async () => {
    const t = convexTest(schema, modules)
    const response = await t.fetch("/api/files/invalid")
    expect(response.status).toBe(400)
  })
})
