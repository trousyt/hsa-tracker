import { useState, useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"
import { Calculator, Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { OptimizerInput } from "./optimizer-input"
import { OptimizerResults } from "./optimizer-results"

type Expense = Doc<"expenses">

interface OptimizerResult {
  success: boolean
  message: string
  expenses: Expense[]
  totalCents: number
  exactMatch: boolean
}

export function Optimizer() {
  const summary = useQuery(api.expenses.getSummary)
  const [targetCents, setTargetCents] = useState<number | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Query for optimization result (only when targetCents is set)
  const optimizationResult = useQuery(
    api.optimizer.findOptimal,
    targetCents !== null ? { targetCents } : "skip"
  ) as OptimizerResult | undefined

  const handleOptimize = useCallback((cents: number) => {
    setIsOptimizing(true)
    setTargetCents(cents)
  }, [])

  // Reset optimizing state when result arrives
  if (optimizationResult && isOptimizing) {
    setIsOptimizing(false)
  }

  const handleReset = useCallback(() => {
    setTargetCents(null)
  }, [])

  if (summary === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const totalAvailableCents = summary.totalUnreimbursedCents

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6" />
        <h2 className="text-xl font-semibold">Reimbursement Optimizer</h2>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          Enter your target reimbursement amount and the optimizer will find the
          fewest expenses that sum to that amount. Older expenses are prioritized
          (FIFO).
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Target Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <OptimizerInput
              totalAvailableCents={totalAvailableCents}
              onOptimize={handleOptimize}
              isOptimizing={isOptimizing}
            />
          </CardContent>
        </Card>

        <div>
          {optimizationResult ? (
            <OptimizerResults result={optimizationResult} onReset={handleReset} />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-12">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Enter a target amount to find optimal expenses</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
