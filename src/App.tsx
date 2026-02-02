import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseTable } from "@/components/expenses/expense-table"
import { Optimizer } from "@/components/optimizer/optimizer"
import { Dashboard } from "@/components/dashboard/dashboard"
import { LayoutDashboard, Receipt, Calculator } from "lucide-react"

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-8">
        <h1 className="text-3xl font-bold mb-8">HSA Expense Tracker</h1>

        <Tabs defaultValue="dashboard" className="space-y-6">
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
      <Toaster />
    </div>
  )
}

export default App
