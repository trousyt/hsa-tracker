import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { useConvexAuth } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { SignIn } from "@/components/auth/sign-in"
import { initialSessionFeedback, sessionFeedback } from "@/components/auth/auth-feedback"
import { AuthLoading as AuthLoadingScreen } from "@/components/auth/auth-loading"
import { LayoutDashboard, Receipt, Calculator, LogOut } from "lucide-react"

const Dashboard = lazy(() =>
  import("@/components/dashboard/dashboard").then((m) => ({ default: m.Dashboard }))
)
const ExpenseTable = lazy(() =>
  import("@/components/expenses/expense-table").then((m) => ({ default: m.ExpenseTable }))
)
const Optimizer = lazy(() =>
  import("@/components/optimizer/optimizer").then((m) => ({ default: m.Optimizer }))
)

/** Loading skeleton shown while lazy-loaded tab content is fetched */
function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

const VALID_TABS = ["dashboard", "expenses", "optimizer"] as const
type TabValue = (typeof VALID_TABS)[number]
const DEFAULT_TAB: TabValue = "dashboard"

function getTabFromUrl(): TabValue {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")
  if (tab && VALID_TABS.includes(tab as TabValue)) {
    return tab as TabValue
  }
  return DEFAULT_TAB
}

function AuthenticatedApp({ onSignOut, signingOut, signOutError }: {
  onSignOut: () => void
  signingOut: boolean
  signOutError: string | null
}) {
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromUrl)

  const handleTabChange = (value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)

    const url = new URL(window.location.href)
    if (tab === DEFAULT_TAB) {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", tab)
    }
    window.history.replaceState({}, "", url.toString())
  }

  useEffect(() => {
    const handlePopState = () => setActiveTab(getTabFromUrl())
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold">
              HSA<span className="hidden sm:inline"> Expense Tracker</span>
            </h1>
            <span className="text-sm text-muted-foreground">v{__APP_VERSION__}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            disabled={signingOut}
            aria-busy={signingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        <p role="alert" className={signOutError ? "mb-4 rounded-md border p-3 text-sm" : "sr-only"}>
          {signOutError}
        </p>
        <p role="status" className="sr-only">{signingOut ? "Signing out. Please wait." : ""}</p>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="h-4 w-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="optimizer" className="gap-2">
              <Calculator className="h-4 w-4" />
              Optimizer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ErrorBoundary>
              <Suspense fallback={<TabSkeleton />}>
                <Dashboard />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="expenses">
            <ErrorBoundary>
              <Suspense fallback={<TabSkeleton />}>
                <ExpenseTable />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="optimizer">
            <ErrorBoundary>
              <Suspense fallback={<TabSkeleton />}>
                <Optimizer />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function App() {
  const auth = useConvexAuth()
  const { signOut } = useAuthActions()
  const [session, setSession] = useState(initialSessionFeedback)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const signOutStarted = useRef(false)
  const observed = sessionFeedback(session, { type: "auth", ...auth })
  // Adjust before rendering children so recovery never flashes a normal sign-in screen.
  if (observed !== session) setSession(observed)

  async function handleSignOut() {
    if (signOutStarted.current) return
    signOutStarted.current = true
    setSigningOut(true)
    setSignOutError(null)
    setSession((current) => sessionFeedback(current, { type: "sign-out-started" }))
    try {
      await signOut()
    } catch {
      setSession((current) => sessionFeedback(current, { type: "sign-out-failed" }))
      setSignOutError("Could not finish signing out. Check your connection and try Sign out again.")
    } finally {
      signOutStarted.current = false
      setSigningOut(false)
    }
  }

  return (
    <>
      {auth.isLoading ? <AuthLoadingScreen /> : auth.isAuthenticated ? (
        <AuthenticatedApp
          onSignOut={() => void handleSignOut()}
          signingOut={signingOut}
          signOutError={signOutError}
        />
      ) : <SignIn notice={observed.notice} />}
      <Toaster />
    </>
  )
}

export default App
