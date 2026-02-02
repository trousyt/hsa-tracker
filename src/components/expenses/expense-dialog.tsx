import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExpenseForm } from "./expense-form"
import { dollarsToCents, centsToDollars } from "@/lib/currency"
import type { ExpenseFormData } from "@/lib/validations/expense"

interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: {
    _id: Id<"expenses">
    datePaid: string
    provider: string
    amountCents: number
    comment?: string
  }
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: ExpenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createExpense = useMutation(api.expenses.create)
  const updateExpense = useMutation(api.expenses.update)

  const isEditing = !!expense

  const handleSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true)
    try {
      if (isEditing && expense) {
        await updateExpense({
          id: expense._id,
          datePaid: data.datePaid.toISOString().split("T")[0],
          provider: data.provider,
          amountCents: dollarsToCents(data.amount),
          comment: data.comment || undefined,
        })
        toast.success("Expense updated successfully")
      } else {
        await createExpense({
          datePaid: data.datePaid.toISOString().split("T")[0],
          provider: data.provider,
          amountCents: dollarsToCents(data.amount),
          comment: data.comment || undefined,
        })
        toast.success("Expense created successfully")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEditing ? "Failed to update expense" : "Failed to create expense")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const defaultValues = expense
    ? {
        datePaid: new Date(expense.datePaid),
        provider: expense.provider,
        amount: centsToDollars(expense.amountCents),
        comment: expense.comment,
      }
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Expense" : "Add Expense"}
          </DialogTitle>
        </DialogHeader>
        <ExpenseForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  )
}
