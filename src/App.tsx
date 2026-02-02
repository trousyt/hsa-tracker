import { Toaster } from "@/components/ui/sonner"
import { ExpenseTable } from "@/components/expenses/expense-table"

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-8">
        <h1 className="text-3xl font-bold mb-8">HSA Expense Tracker</h1>
        <ExpenseTable />
      </div>
      <Toaster />
    </div>
  )
}

export default App
