import { useSignInWithGithub, useOauth } from "@convex-dev/auth/methods/github/react"
import { useEffect, useRef, useState } from "react"
import { authErrorMessage, sessionNoticeMessage } from "./auth-feedback"
import type { SessionNotice } from "./auth-feedback"
import { startSignInAttempt } from "./sign-in-attempt"
import type { SignInFeedback } from "./sign-in-attempt"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** GitHub sign-in with safe, actionable recovery feedback. */
export function SignIn({ notice = null }: { notice?: SessionNotice }) {
  const { signIn } = useSignInWithGithub(api.authV2)
  const { flowError } = useOauth()
  const [{ pending, error }, setFeedback] = useState<SignInFeedback>({ pending: false, error: null })
  const starting = useRef(false)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const failure = error ?? (flowError ? authErrorMessage(flowError, "callback") : null)
  const message = pending ? null : failure ?? sessionNoticeMessage(notice)

  useEffect(() => {
    if (message) feedbackRef.current?.focus()
  }, [message])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // Returning with Back may restore a page that was waiting to redirect.
      if (event.persisted) {
        starting.current = false
        setFeedback({ pending: false, error: null })
      }
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle><h1 className="text-2xl">HSA Expense Tracker</h1></CardTitle>
          <CardDescription>
            Sign in to access your HSA expense tracking dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            ref={feedbackRef}
            id="auth-feedback"
            role={failure && !pending ? "alert" : "status"}
            aria-atomic="true"
            tabIndex={message ? -1 : undefined}
            className={message ? "mb-4 rounded-md border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : "sr-only"}
          >
            {message}
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {pending ? "Opening GitHub sign-in. Please wait." : ""}
          </p>
          <Button
            onClick={() => void startSignInAttempt(starting, signIn, setFeedback)}
            disabled={pending}
            aria-busy={pending}
            aria-describedby={message ? "auth-feedback" : undefined}
            className="w-full"
            size="lg"
          >
            <GitHubIcon className="mr-2 h-5 w-5" />
            {pending ? "Opening GitHub…" : failure ? "Try GitHub sign-in again" : "Sign in with GitHub"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
