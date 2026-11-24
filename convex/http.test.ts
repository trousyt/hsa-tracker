import { convexTest } from "convex-test"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sessionIdentity } from "@convex-dev/auth/test"
import { makeFunctionReference } from "convex/server"
import schema from "./schema"
import { modules } from "./test.setup"
import { createSessionContext, signUpTestUser } from "../src/test/session.fixture"

const signOut = makeFunctionReference<"mutation", { refreshToken: string }, null>("authV2:signOut")

async function createFileContext() {
  const context = await createSessionContext()
  const documentId = await context.t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["receipt"], { type: "application/pdf" }))
    return await ctx.db.insert("documents", {
      userId: context.userId,
      storageId,
      originalFilename: 'receipt "private".pdf',
      mimeType: "application/pdf",
      sizeBytes: 7,
      ocrStatus: "completed",
    })
  })
  return { ...context, documentId, path: `/api/files/${documentId}` }
}

function expectPrivateResponse(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0")
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("secure file HTTP endpoint", () => {
  it("serves owner bytes with safe inline headers and a bounded audit entry, not credentials", async () => {
    const { t, authed, userId, path, documentId, tokens } = await createFileContext()
    vi.stubEnv("SITE_URL", "https://app.example.com")
    const consoleLog = vi.spyOn(console, "log")
    const consoleError = vi.spyOn(console, "error")
    const consoleWarn = vi.spyOn(console, "warn")
    const userAgent = "a".repeat(600)
    const response = await authed.fetch(path, {
      headers: {
        Origin: "https://app.example.com",
        Authorization: `Bearer ${tokens.accessToken}`,
        "User-Agent": userAgent,
      },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("receipt")
    expectPrivateResponse(response)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Length")).toBe("7")
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="receipt%20%22private%22.pdf"')
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN")
    const logs = await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ userId, documentId, action: "view", success: true, userAgent: "a".repeat(512) })
    expect(JSON.stringify(logs)).not.toContain(tokens.accessToken)
    expect(JSON.stringify(logs)).not.toContain(tokens.refreshToken)
    expect(consoleLog).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it("rejects absent, invalid and bare-user-ID sessions without writing attacker-controlled audits", async () => {
    const { t, userId, path } = await createFileContext()
    for (const caller of [t, t.withIdentity({ subject: "invalid-session" }), t.withIdentity({ subject: userId })]) {
      const response = await caller.fetch(path)
      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer")
      expectPrivateResponse(response)
    }
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toEqual([])
  })

  it("denies a different real v2 session without exposing document metadata", async () => {
    const { t, path, documentId } = await createFileContext()
    const otherResult = await t.mutation(signUpTestUser, { username: "otheruser", password: "correct horse battery staple" })
    if (!otherResult.tokens) throw new Error("Test sign-up failed")
    const other = t.withIdentity(sessionIdentity(otherResult.tokens))
    const response = await other.fetch(path)
    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Forbidden")
    expect(response.headers.get("Content-Disposition")).toBeNull()
    expectPrivateResponse(response)
    const logs = await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ documentId, userId: otherResult.tokens.userId, success: false, errorReason: "Document not found or access denied" })
  })

  it("denies a signed-out/revoked session even with its previously usable identity", async () => {
    const { t, authed, path, tokens } = await createFileContext()
    await t.mutation(signOut, { refreshToken: tokens.refreshToken })
    const response = await authed.fetch(path)
    expect(response.status).toBe(401)
    expectPrivateResponse(response)
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toEqual([])
  })

  it("denies a session after the public refresh API detects expiry", async () => {
    const { t, authed, path, tokens } = await createFileContext()
    // The component removes expired sessions during refresh; the deployment, not
    // withIdentity, verifies access-token expiry. No private component writes.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000)
    const refresh = makeFunctionReference<"mutation", { refreshToken: string }, { kind: string }>("authV2:refreshSession")
    expect(await t.mutation(refresh, { refreshToken: tokens.refreshToken })).toEqual({ kind: "noSession" })
    const response = await authed.fetch(path)
    expect(response.status).toBe(401)
    expectPrivateResponse(response)
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toEqual([])
  })

  it("rejects malformed IDs without logging or caching the request", async () => {
    const t = convexTest(schema, modules)
    const response = await t.fetch("/api/files/invalid")
    expect(response.status).toBe(400)
    expectPrivateResponse(response)
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toEqual([])
  })

  it("does not distinguish a missing document from an inaccessible one", async () => {
    const { t, authed, path, documentId } = await createFileContext()
    await t.run((ctx) => ctx.db.delete(documentId))
    const response = await authed.fetch(path)
    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Forbidden")
    expectPrivateResponse(response)
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toMatchObject([
      { documentId, success: false, errorReason: "Document not found or access denied" },
    ])
  })

  it("returns a private 404 and safe audit when the document blob is missing", async () => {
    const { t, authed, path, documentId } = await createFileContext()
    await t.run(async (ctx) => {
      const doc = await ctx.db.get(documentId)
      if (!doc) throw new Error("Missing fixture document")
      await ctx.storage.delete(doc.storageId)
    })
    const response = await authed.fetch(path)
    expect(response.status).toBe(404)
    expectPrivateResponse(response)
    expect(await t.run((ctx) => ctx.db.query("fileAccessLogs").collect())).toMatchObject([
      { documentId, success: false, errorReason: "File not found in storage" },
    ])
  })

  it("does not reflect a disallowed origin or allow credentials in file preflights", async () => {
    const t = convexTest(schema, modules)
    vi.stubEnv("SITE_URL", "https://app.example.com")
    for (const origin of ["https://app.example.com", "https://untrusted.example"]) {
      const response = await t.fetch("/api/files/document123", {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
      })
      expect(response.status).toBe(204)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS")
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type")
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull()
      expectPrivateResponse(response)
    }
  })

  it.each([undefined, "", "*", "invalid", "https://app.example.com/path", "https://user:password@app.example.com", "http://untrusted.example", "data:text/plain,hello"])(
    "fails file CORS closed for missing or unsafe SITE_URL (%s)", async (origin) => {
      vi.stubEnv("SITE_URL", origin)
      const t = convexTest(schema, modules)
      const response = await t.fetch("/api/files/document123", { method: "OPTIONS" })
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("")
    },
  )
})
