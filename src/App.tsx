import { useState, useEffect } from "react"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ExpenseTable } from "@/components/expenses/expense-table"
import { Optimizer } from "@/components/optimizer/optimizer"
import { Dashboard } from "@/components/dashboard/dashboard"
import { SignIn } from "@/components/auth/sign-in"
import { AuthLoading as AuthLoadingScreen } from "@/components/auth/auth-loading"
import { LayoutDashboard, Receipt, Calculator, LogOut } from "lucide-react"

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

function AuthenticatedApp() {
  const { signOut } = useAuthActions()
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
      <div className="mx-auto max-w-6xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold">HSA Expense Tracker</h1>
            <span className="text-sm text-muted-foreground">v{__APP_VERSION__}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

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
            <Dashboard />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpenseTable />
          </TabsContent>

          <TabsContent value="optimizer">
            <Optimizer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function App() {
  return (
    <>
      <AuthLoading>
        <AuthLoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
      <Toaster />
    </>
  )
}

export default App
