import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/currency"
import { FileUploader } from "@/components/documents/file-uploader"
import { DocumentGallery } from "@/components/documents/document-gallery"

interface ExpenseDetailProps {
  expenseId: Id<"expenses"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExpenseDetail({
  expenseId,
  open,
  onOpenChange,
}: ExpenseDetailProps) {
  const expense = useQuery(
    api.expenses.get,
    expenseId ? { id: expenseId } : "skip"
  )

  if (!expense) return null

  const remaining = expense.amountCents - expense.totalReimbursedCents

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Expense Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Expense Info */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Provider</p>
                <p className="font-medium">{expense.provider}</p>
              </div>
              <Badge
                variant={
                  expense.status === "reimbursed"
                    ? "default"
                    : expense.status === "partial"
                      ? "secondary"
                      : "outline"
                }
              >
                {expense.status === "reimbursed"
                  ? "Reimbursed"
                  : expense.status === "partial"
                    ? "Partial"
                    : "Unreimbursed"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date Paid</p>
                <p className="font-medium">
                  {new Date(expense.datePaid).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium text-lg">
                  {formatCurrency(expense.amountCents)}
                </p>
              </div>
            </div>

            {expense.status !== "unreimbursed" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Reimbursed</p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(expense.totalReimbursedCents)}
                  </p>
                </div>
                {expense.status === "partial" && (
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className="font-medium">{formatCurrency(remaining)}</p>
                  </div>
                )}
              </div>
            )}

            {expense.comment && (
              <div>
                <p className="text-sm text-muted-foreground">Comment</p>
                <p className="text-sm">{expense.comment}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Documents Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Documents</h3>

            <DocumentGallery
              expenseId={expense._id}
              documentIds={expense.documentIds}
            />

            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-2">
                Add receipts or statements
              </p>
              <FileUploader expenseId={expense._id} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
