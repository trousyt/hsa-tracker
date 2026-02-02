import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { Undo2, Calendar, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

interface ReimbursementHistoryProps {
  expenseId: Id<"expenses">
}

export function ReimbursementHistory({ expenseId }: ReimbursementHistoryProps) {
  const reimbursements = useQuery(api.reimbursements.getByExpense, { expenseId })
  const undoReimbursement = useMutation(api.reimbursements.undo)

  const [undoingId, setUndoingId] = useState<Id<"reimbursements"> | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)

  if (reimbursements === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-start justify-between p-3 border rounded-lg bg-muted/30"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    )
  }

  if (reimbursements.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No reimbursements recorded yet
      </div>
    )
  }

  const handleUndo = async () => {
    if (!undoingId) return

    setIsUndoing(true)
    try {
      await undoReimbursement({ reimbursementId: undoingId })
      toast.success("Reimbursement undone")
    } catch (error) {
      toast.error("Failed to undo reimbursement")
      console.error(error)
    } finally {
      setIsUndoing(false)
      setUndoingId(null)
    }
  }

  return (
    <>
      <div className="space-y-3">
        {reimbursements.map((reimbursement) => (
          <div
            key={reimbursement._id}
            className="flex items-start justify-between p-3 border rounded-lg bg-muted/30"
          >
            <div className="space-y-1">
              <p className="font-medium">
                {formatCurrency(reimbursement.amountCents)}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(reimbursement.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {reimbursement.notes && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {reimbursement.notes}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUndoingId(reimbursement._id)}
              title="Undo reimbursement"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!undoingId}
        onOpenChange={(open) => !open && setUndoingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Reimbursement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to undo this reimbursement? The expense
              status will be updated accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={isUndoing}>
              {isUndoing ? "Undoing..." : "Undo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
