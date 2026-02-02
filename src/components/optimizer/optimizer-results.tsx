import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { CheckCircle, AlertCircle, Calendar, Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/currency"

type Expense = Doc<"expenses">

interface OptimizerResult {
  success: boolean
  message: string
  expenses: Expense[]
  totalCents: number
  exactMatch: boolean
}

interface OptimizerResultsProps {
  result: OptimizerResult
  onReset: () => void
}

export function OptimizerResults({ result, onReset }: OptimizerResultsProps) {
  const applyOptimization = useMutation(api.optimizer.applyOptimization)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleApplyAll = async () => {
    setIsApplying(true)
    try {
      await applyOptimization({
        expenseIds: result.expenses.map((e) => e._id),
      })
      toast.success("All expenses marked as reimbursed")
      onReset()
    } catch (error) {
      toast.error("Failed to apply reimbursements")
      console.error(error)
    } finally {
      setIsApplying(false)
      setShowConfirm(false)
    }
  }

  if (!result.success) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{result.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {result.exactMatch ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Exact Match Found
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Closest Match
                </>
              )}
            </CardTitle>
            <Badge variant={result.exactMatch ? "default" : "secondary"}>
              {formatCurrency(result.totalCents)}
            </Badge>
          </div>
          {!result.exactMatch && (
            <p className="text-sm text-muted-foreground">{result.message}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {result.expenses.length} expense
              {result.expenses.length !== 1 ? "s" : ""} selected:
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {result.expenses.map((expense) => {
                const remainingCents =
                  expense.amountCents - expense.totalReimbursedCents
                return (
                  <div
                    key={expense._id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{expense.provider}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(expense.datePaid).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(remainingCents)}
                      </p>
                      {expense.status === "partial" && (
                        <p className="text-xs text-muted-foreground">
                          of {formatCurrency(expense.amountCents)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setShowConfirm(true)}
              className="flex-1 gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Apply All
            </Button>
            <Button variant="outline" onClick={onReset}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Reimbursements</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {result.expenses.length} expense
              {result.expenses.length !== 1 ? "s" : ""} as fully reimbursed for
              a total of <strong>{formatCurrency(result.totalCents)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyAll} disabled={isApplying}>
              {isApplying ? "Applying..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
