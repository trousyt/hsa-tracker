import { convexTest } from "convex-test"
import { vi } from "vitest"
import { anyApi, componentsGeneric, internalMutationGeneric, makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import { setupConvexAuth } from "@convex-dev/auth/server"
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server"
import { registerCore, sessionIdentity } from "@convex-dev/auth/test"
import { registerPassword } from "@convex-dev/auth/components/password/test"
import { registerUsername } from "@convex-dev/auth/components/username/test"
import type { ComponentApi as CoreApi } from "@convex-dev/auth/_generated/component"
import type { ComponentApi as PasswordApi } from "@convex-dev/auth/components/password/_generated/component"
import type { ComponentApi as UsernameApi } from "@convex-dev/auth/components/username/_generated/component"
import schema from "../../convex/schema"
import { modules } from "../../convex/test.setup"

// Password hashing is outside these session-authorization tests; the v2 core remains real.
vi.mock("password-hash-wasm/argon2id", () => ({
  hashPassword: async () => "test-only-hash",
  verifyPassword: async () => false,
}))

const components = componentsGeneric() as unknown as { auth: CoreApi; authPassword: PasswordApi; authUsername: UsernameApi }
const auth = setupConvexAuth({ component: components.auth })
const password = setupUsernamePassword(auth, {
  component: components.authPassword,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({ createUser: anyApi.sessionFixture.createUser })
const createUser = internalMutationGeneric({
  args: { method: v.object({ name: v.literal("usernamePassword"), profile: v.object({}) }) },
  returns: v.id("users"),
  handler: async (ctx) => await ctx.db.insert("users", { isOwner: true }),
})
const testModules = { ...modules, "./sessionFixture.ts": async () => ({ createUser, ...password }) }
export const signUpTestUser = makeFunctionReference<"mutation", { username: string; password: string }, { status: string; tokens?: { accessToken: string; userId: string; refreshToken: string } }>("sessionFixture:signUpWithUsernamePassword")

/** Use supported v2 password components only to create real test sessions, never in production auth. */
export async function createSessionContext() {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud")
  vi.stubEnv("AUTH_ALLOWED_REDIRECT_ORIGINS", "http://localhost:5173")
  const t = convexTest(schema, testModules)
  registerCore(t)
  registerPassword(t)
  registerUsername(t)
  const result = await t.mutation(signUpTestUser, { username: "testuser", password: "correct horse battery staple" })
  if (result.status !== "complete" || !result.tokens) throw new Error("Test sign-up failed")
  const userId = await t.run(async (ctx) => {
    const id = ctx.db.normalizeId("users", result.tokens!.userId)
    if (!id) throw new Error("Invalid test user id")
    return id
  })
  return { t, authed: t.withIdentity(sessionIdentity(result.tokens)), userId, tokens: result.tokens }
}
