import type { OauthFlowError } from "@convex-dev/auth/methods/github/react"
import { ConvexError } from "convex/values"

/** Map only documented OAuth codes and the application's safe owner-policy code to UI text. */
export function authErrorMessage(error: OauthFlowError, phase: "start" | "callback"): string {
  switch (error.error) {
    case "ACCESS_DENIED":
      return "Sign-in was cancelled. You can try again when you’re ready."
    case "EXPIRED":
      return "This sign-in attempt expired or was already used. Please start again."
    case "INVALID_FLOW":
      return "This sign-in attempt could not be verified in this browser. Please start again."
    case "OTHER_ERROR": {
      const cause = error.cause
      if (cause instanceof ConvexError && typeof cause.data === "object" &&
          cause.data !== null && "code" in cause.data && cause.data.code === "OWNER_ACCESS_DENIED") {
        return "This account cannot access this app. Try again with the owner’s GitHub account."
      }
      return phase === "start"
        ? "Could not start sign-in. Check your connection and try again."
        : "Sign-in could not be completed. Please try again."
    }
  }
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated"
export type SessionNotice = "session-lost" | "signed-out" | null
export type SessionFeedback = {
  status: AuthStatus
  established: boolean
  deliberateSignOut: boolean
  notice: SessionNotice
}
export const initialSessionFeedback: SessionFeedback = {
  status: "loading",
  established: false,
  deliberateSignOut: false,
  notice: null,
}

type SessionEvent =
  | { type: "auth"; isLoading: boolean; isAuthenticated: boolean }
  | { type: "sign-out-started" }
  | { type: "sign-out-failed" }

/** Track confirmed session transitions, not connection failures or intermediate loading states. */
export function sessionFeedback(state: SessionFeedback, event: SessionEvent): SessionFeedback {
  if (event.type === "sign-out-started") return { ...state, deliberateSignOut: true }
  if (event.type === "sign-out-failed") return { ...state, deliberateSignOut: false }
  const status: AuthStatus = event.isLoading ? "loading" : event.isAuthenticated ? "authenticated" : "unauthenticated"
  if (state.status === status) return state
  if (status === "loading") return { ...state, status }
  if (status === "authenticated") {
    return { status, established: true, deliberateSignOut: state.deliberateSignOut, notice: null }
  }
  return {
    status,
    established: false,
    deliberateSignOut: false,
    notice: state.established
      ? state.deliberateSignOut ? "signed-out" : "session-lost"
      : state.notice,
  }
}

/** Keep session-loss wording neutral: the client cannot tell expiry from revocation. */
export function sessionNoticeMessage(notice: SessionNotice): string | null {
  if (notice === "session-lost") return "Your session ended. Sign in again to continue."
  if (notice === "signed-out") return "You’re signed out. You can sign in again whenever you’re ready."
  return null
}
