import { describe, expect, it, vi } from "vitest"
import { ConvexError } from "convex/values"
import type { OauthStartResult } from "@convex-dev/auth/methods/github/react"
import { startSignInAttempt } from "./sign-in-attempt"
import type { SignInFeedback } from "./sign-in-attempt"

// Tests the frontend action boundary with fixture results, not GitHub OAuth.
describe("startSignInAttempt", () => {
  it("exposes pending feedback and prevents rapid starts, including after a redirect result", async () => {
    let finish!: (value: OauthStartResult) => void
    const signIn = vi.fn(() => new Promise<OauthStartResult>((resolve) => { finish = resolve }))
    const starting = { current: false }
    let feedback: SignInFeedback = { pending: false, error: null }
    const show = (value: SignInFeedback) => { feedback = value }
    const first = startSignInAttempt(starting, signIn, show)
    expect(feedback).toEqual({ pending: true, error: null })
    await startSignInAttempt(starting, signIn, show)
    expect(signIn).toHaveBeenCalledTimes(1)
    finish({ status: "redirect", redirect: new URL("https://github.com/login/oauth/authorize") })
    await first
    await startSignInAttempt(starting, signIn, show)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(feedback).toEqual({ pending: true, error: null })
  })

  it("recovers from a typed start failure and permits retry without stale errors", async () => {
    const signIn = vi.fn<() => Promise<OauthStartResult>>()
      .mockResolvedValueOnce({ status: "error", userError: { error: "OTHER_ERROR", cause: new Error("private detail") } })
      .mockResolvedValueOnce({ status: "redirect", redirect: new URL("https://github.com/login/oauth/authorize") })
    const starting = { current: false }
    let feedback: SignInFeedback = { pending: false, error: null }
    const show = (value: SignInFeedback) => { feedback = value }
    await startSignInAttempt(starting, signIn, show)
    expect(feedback).toEqual({ pending: false, error: "Could not start sign-in. Check your connection and try again." })
    await startSignInAttempt(starting, signIn, show)
    expect(signIn).toHaveBeenCalledTimes(2)
    expect(feedback).toEqual({ pending: true, error: null })
  })

  it("handles thrown failures safely and permits retry", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("private detail"))
    const show = vi.fn()
    const starting = { current: false }
    await startSignInAttempt(starting, signIn, show)
    expect(show).toHaveBeenLastCalledWith({ pending: false, error: "Could not start sign-in. Check your connection and try again." })
    await startSignInAttempt(starting, signIn, show)
    expect(signIn).toHaveBeenCalledTimes(2)
  })

  it("renders safe policy refusal from a typed start error without diagnostic contents", async () => {
    const signIn = vi.fn().mockResolvedValue({ status: "error", userError: {
      error: "OTHER_ERROR", cause: new ConvexError({ code: "OWNER_ACCESS_DENIED", diagnostic: "private detail" }),
    } })
    const show = vi.fn()
    await startSignInAttempt({ current: false }, signIn, show)
    expect(show).toHaveBeenLastCalledWith({ pending: false, error: "This account cannot access this app. Try again with the owner’s GitHub account." })
  })
})
