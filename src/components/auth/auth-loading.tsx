import { Loader2 } from "lucide-react"

/** Announce authentication checks without implying the session has ended. */
export function AuthLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    </div>
  )
}
