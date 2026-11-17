import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConvexError } from "convex/values"
import type { OauthFlowError } from "@convex-dev/auth/methods/github/react"
import { SignIn } from "./sign-in"
import { AuthLoading } from "./auth-loading"

const oauth = vi.hoisted(() => ({ flowError: null as OauthFlowError | null, signIn: vi.fn() }))
vi.mock("@convex-dev/auth/methods/github/react", () => ({
  useSignInWithGithub: () => ({ signIn: oauth.signIn }),
  useOauth: () => ({ flowError: oauth.flowError }),
}))

// Static UI fixtures verify names/semantics and safe output, not focus execution or live OAuth.
describe("SignIn", () => {
  beforeEach(() => { oauth.flowError = null })

  it("renders an ordinary initial sign-in with a named native button and no expiry warning", () => {
    const html = renderToStaticMarkup(createElement(SignIn))
    expect(html).toContain("<main")
    expect(html).toContain("<h1")
    expect(html).toContain("Sign in with GitHub")
    expect(html).not.toContain("Your session ended")
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('aria-busy="false"')
  })

  it.each([
    [{ error: "ACCESS_DENIED" }, "Sign-in was cancelled."],
    [{ error: "EXPIRED" }, "This sign-in attempt expired or was already used."],
    [{ error: "INVALID_FLOW" }, "This sign-in attempt could not be verified in this browser."],
    [{ error: "OTHER_ERROR", cause: new Error("private callback detail") }, "Sign-in could not be completed."],
    [{ error: "OTHER_ERROR", cause: new ConvexError({ code: "OWNER_ACCESS_DENIED" }) }, "This account cannot access this app."],
  ] satisfies [OauthFlowError, string][])("renders actionable callback feedback and a retry control", (error, text) => {
    oauth.flowError = error
    const html = renderToStaticMarkup(createElement(SignIn))
    expect(html).toContain(text)
    expect(html).toContain('role="alert"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('aria-describedby="auth-feedback"')
    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("Try GitHub sign-in again")
    expect(html).not.toContain("private callback detail")
    expect(html).not.toContain("OWNER_ACCESS_DENIED")
  })

  it("provides focusable, live session-loss guidance with a sign-in control", () => {
    const html = renderToStaticMarkup(createElement(SignIn, { notice: "session-lost" }))
    expect(html).toContain("Your session ended. Sign in again to continue.")
    expect(html).toContain('role="status"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain("Sign in with GitHub")
  })

  it("does not show deliberate sign-out as expiry", () => {
    const html = renderToStaticMarkup(createElement(SignIn, { notice: "signed-out" }))
    expect(html).toContain("You’re signed out.")
    expect(html).not.toContain("Your session ended")
  })
})

describe("AuthLoading", () => {
  it("announces session checking instead of an expiry message", () => {
    const html = renderToStaticMarkup(createElement(AuthLoading))
    expect(html).toContain('role="status"')
    expect(html).toContain("Checking your session…")
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain("session ended")
  })
})
