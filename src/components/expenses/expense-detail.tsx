import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/currency"
import { FileUploader } from "@/components/documents/file-uploader"
import { DocumentGallery } from "@/components/documents/document-gallery"
import { ReimbursementForm } from "@/components/reimbursements/reimbursement-form"
import { ReimbursementHistory } from "@/components/reimbursements/reimbursement-history"
import { QuickReimburseButton } from "@/components/reimbursements/quick-reimburse-button"

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

  // Show skeleton while loading
  if (expenseId && expense === undefined) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Expense Details</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    )
  }

  if (!expense) return null

  const remaining = expense.amountCents - expense.totalReimbursedCents

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Expense Details</SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-4">
          {/* Expense Summary */}
          <div className="space-y-3">
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
                {remaining > 0 && (
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

          {/* Tabs for Documents and Reimbursements */}
          <Tabs defaultValue="documents" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4 mt-4">
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
            </TabsContent>

            <TabsContent value="reimbursements" className="space-y-4 mt-4">
              {remaining > 0 && (
                <>
                  <div className="flex justify-end">
                    <QuickReimburseButton
                      expenseId={expense._id}
                      remainingCents={remaining}
                    />
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Record Reimbursement</h4>
                    <ReimbursementForm
                      expenseId={expense._id}
                      remainingCents={remaining}
                    />
                  </div>

                  <Separator />
                </>
              )}

              <div>
                <h4 className="font-medium mb-3">Reimbursement History</h4>
                <ReimbursementHistory expenseId={expense._id} />
              </div>
            </TabsContent>
          </Tabs>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
