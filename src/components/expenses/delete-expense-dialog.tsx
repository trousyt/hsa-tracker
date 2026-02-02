import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"

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

interface DeleteExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: {
    _id: Id<"expenses">
    provider: string
    amountCents: number
  } | null
}

export function DeleteExpenseDialog({
  open,
  onOpenChange,
  expense,
}: DeleteExpenseDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const removeExpense = useMutation(api.expenses.remove)

  const handleDelete = async () => {
    if (!expense) return

    setIsDeleting(true)
    try {
      await removeExpense({ id: expense._id })
      toast.success("Expense deleted successfully")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to delete expense")
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!expense) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Expense</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this expense?
            <br />
            <br />
            <strong>{expense.provider}</strong> -{" "}
            {formatCurrency(expense.amountCents)}
            <br />
            <br />
            This action cannot be undone. Any associated reimbursements will
            also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
