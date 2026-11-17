import { convexTest } from "convex-test"
import { makeFunctionReference } from "convex/server"
import { registerCore } from "@convex-dev/auth/test"
import { registerGithubOauth } from "@convex-dev/auth/components/github/test"
import { afterEach, describe, expect, it, vi } from "vitest"
import schema from "./schema"
import { modules } from "./test.setup"

const start = makeFunctionReference<"mutation", { redirectTo: string }, { redirect: string; state: string }>("authV2:startSignInWithGithub")
const complete = makeFunctionReference<"mutation", { code: string; state: string }, { status: string }>("authV2:completeSignInWithGithub")

afterEach(() => vi.unstubAllEnvs())

describe("Auth v2 GitHub component boundary", () => {
  it("starts GitHub OAuth through the mounted component and rejects an invalid ticket", async () => {
    vi.stubEnv("AUTH_ALLOWED_REDIRECT_ORIGINS", "http://localhost:5173")
    vi.stubEnv("CLIENT_ID", "test-client")
    vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site/oauth/github")
    const t = convexTest(schema, modules)
    registerCore(t)
    registerGithubOauth(t)
    await expect(t.mutation(start, { redirectTo: "https://untrusted.example" })).rejects.toThrow(/not in allowedRedirectOrigins/)
    const result = await t.mutation(start, { redirectTo: "http://localhost:5173" })
    const url = new URL(result.redirect)
    expect(url.origin).toBe("https://github.com")
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.convex.site/oauth/github/callback")
    expect(await t.mutation(complete, { code: "invalid", state: result.state })).toEqual({
      status: "error", userError: { error: "INVALID_CODE" },
    })
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0)
  })
})
