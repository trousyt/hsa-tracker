import type { OauthStartResult } from "@convex-dev/auth/methods/github/react"
import { authErrorMessage } from "./auth-feedback"

export type SignInFeedback = { pending: boolean; error: string | null }

/** Start once, keeping the saved OAuth flow protected until redirect or a recoverable failure. */
export async function startSignInAttempt(
  starting: { current: boolean },
  signIn: () => Promise<OauthStartResult>,
  showFeedback: (feedback: SignInFeedback) => void,
): Promise<void> {
  if (starting.current) return
  starting.current = true
  showFeedback({ pending: true, error: null })
  let error: string
  try {
    const result = await signIn()
    // A second start could overwrite the saved flow before the browser leaves.
    if (result.status === "redirect") return
    error = authErrorMessage(result.userError, "start")
  } catch (cause) {
    error = authErrorMessage({ error: "OTHER_ERROR", cause }, "start")
  }
  starting.current = false
  showFeedback({ pending: false, error })
}
