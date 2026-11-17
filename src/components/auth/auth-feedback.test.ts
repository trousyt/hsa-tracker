import { afterEach, describe, expect, it, vi } from "vitest"
import { ConvexError } from "convex/values"
import { ConvexHttpClient } from "convex/browser"
import { makeFunctionReference } from "convex/server"
import {
  authErrorMessage,
  initialSessionFeedback,
  sessionFeedback,
  sessionNoticeMessage,
} from "./auth-feedback"

const loading = { type: "auth", isLoading: true, isAuthenticated: false } as const
const signedIn = { type: "auth", isLoading: false, isAuthenticated: true } as const
const signedOut = { type: "auth", isLoading: false, isAuthenticated: false } as const

// These fixtures verify frontend feedback only, not real OAuth or backend authorization.
describe("authErrorMessage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("explains cancellation without calling it an owner-policy refusal", () => {
    expect(authErrorMessage({ error: "ACCESS_DENIED" }, "callback")).toContain("cancelled")
  })

  it("explains expired and already-used attempts with a new-start recovery", () => {
    expect(authErrorMessage({ error: "EXPIRED" }, "callback")).toBe(
      "This sign-in attempt expired or was already used. Please start again.",
    )
  })

  it("explains a callback with no matching browser flow", () => {
    expect(authErrorMessage({ error: "INVALID_FLOW" }, "callback")).toBe(
      "This sign-in attempt could not be verified in this browser. Please start again.",
    )
  })

  it.each(["start", "callback"] as const)("recognizes only the safe owner-policy code during %s", (phase) => {
    const message = authErrorMessage({
      error: "OTHER_ERROR", cause: new ConvexError({ code: "OWNER_ACCESS_DENIED" }),
    }, phase)
    expect(message).toBe("This account cannot access this app. Try again with the owner’s GitHub account.")
  })

  it.each([
    new Error("OWNER_ACCESS_DENIED private diagnostic"),
    new ConvexError({ code: "UNKNOWN", diagnostic: "private diagnostic" }),
    { code: "OWNER_ACCESS_DENIED", message: "private diagnostic" },
    { data: { code: "OWNER_ACCESS_DENIED" } },
    "private diagnostic",
    null,
  ])("keeps unknown callback causes generic and excludes diagnostics", (cause) => {
    expect(authErrorMessage({ error: "OTHER_ERROR", cause }, "callback")).toBe(
      "Sign-in could not be completed. Please try again.",
    )
  })

  it("offers connection/retry guidance for a start failure without claiming session expiry", () => {
    expect(authErrorMessage({ error: "OTHER_ERROR", cause: new TypeError("fetch failed") }, "start")).toBe(
      "Could not start sign-in. Check your connection and try again.",
    )
  })

  it("recognizes structured data reconstructed by the public Convex HTTP transport", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "error",
      errorMessage: "private diagnostic not intended for the UI",
      errorData: { code: "OWNER_ACCESS_DENIED" },
    }), { status: 560, headers: { "Content-Type": "application/json" } })))
    const client = new ConvexHttpClient("https://auth-ux-fixture.convex.cloud", { logger: false })
    const cause = await client.mutation(makeFunctionReference<"mutation">("authV2:completeSignInWithGithub"), {})
      .catch((error: unknown) => error)
    expect(cause).toBeInstanceOf(ConvexError)
    expect(authErrorMessage({ error: "OTHER_ERROR", cause }, "callback")).toBe(
      "This account cannot access this app. Try again with the owner’s GitHub account.",
    )
  })
})

describe("sessionFeedback", () => {
  it("does not label first arrival or initial loading as session loss", () => {
    const state = sessionFeedback(initialSessionFeedback, loading)
    expect(state.notice).toBeNull()
    expect(sessionFeedback(state, signedOut).notice).toBeNull()
  })

  it("waits for a confirmed signed-out state after an established session", () => {
    const established = sessionFeedback(initialSessionFeedback, signedIn)
    const checking = sessionFeedback(established, loading)
    expect(checking.notice).toBeNull()
    expect(sessionFeedback(checking, signedOut).notice).toBe("session-lost")
  })

  it("does not mistake ordinary refresh/loading or an unchanged session during network trouble for loss", () => {
    const established = sessionFeedback(initialSessionFeedback, signedIn)
    expect(sessionFeedback(established, signedIn)).toBe(established)
    const refreshed = sessionFeedback(sessionFeedback(established, loading), signedIn)
    expect(refreshed.notice).toBeNull()
    expect(refreshed.established).toBe(true)
  })

  it("distinguishes deliberate sign-out, including intermediate loading", () => {
    const established = sessionFeedback(initialSessionFeedback, signedIn)
    const requested = sessionFeedback(established, { type: "sign-out-started" })
    expect(sessionFeedback(requested, signedIn).deliberateSignOut).toBe(true)
    const state = sessionFeedback(sessionFeedback(requested, loading), signedOut)
    expect(state.notice).toBe("signed-out")
    expect(sessionFeedback(state, signedOut).notice).toBe("signed-out")
  })

  it("keeps sign-out intent if a concurrent refresh finishes before sign-out", () => {
    const established = sessionFeedback(initialSessionFeedback, signedIn)
    const requested = sessionFeedback(established, { type: "sign-out-started" })
    const refreshed = sessionFeedback(sessionFeedback(requested, loading), signedIn)
    expect(sessionFeedback(refreshed, signedOut).notice).toBe("signed-out")
  })

  it("does not suppress later real session loss after a failed sign-out", () => {
    const established = sessionFeedback(initialSessionFeedback, signedIn)
    const requested = sessionFeedback(established, { type: "sign-out-started" })
    const failed = sessionFeedback(requested, { type: "sign-out-failed" })
    expect(sessionFeedback(failed, signedOut).notice).toBe("session-lost")
  })

  it("keeps deliberate sign-out wording if local sign-out completes before a remote error", () => {
    const requested = sessionFeedback(sessionFeedback(initialSessionFeedback, signedIn), { type: "sign-out-started" })
    const locallySignedOut = sessionFeedback(requested, signedOut)
    expect(sessionFeedback(locallySignedOut, { type: "sign-out-failed" }).notice).toBe("signed-out")
  })

  it("keeps the explanation through loading and clears it only after successful reauthentication", () => {
    const ended = sessionFeedback(sessionFeedback(initialSessionFeedback, signedIn), signedOut)
    const retry = sessionFeedback(ended, loading)
    expect(sessionFeedback(retry, signedOut).notice).toBe("session-lost")
    expect(sessionFeedback(retry, signedIn).notice).toBeNull()
    expect(sessionFeedback(sessionFeedback(retry, signedIn), signedOut).notice).toBe("session-lost")
  })
})

describe("sessionNoticeMessage", () => {
  it("has no initial signed-out explanation", () => {
    expect(sessionNoticeMessage(null)).toBeNull()
  })
  it("does not claim a specific reason such as expiry for confirmed loss", () => {
    expect(sessionNoticeMessage("session-lost")).toBe("Your session ended. Sign in again to continue.")
  })
  it("explains deliberate sign-out without implying expiry", () => {
    expect(sessionNoticeMessage("signed-out")).toBe("You’re signed out. You can sign in again whenever you’re ready.")
  })
})
