import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
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

interface QuickReimburseButtonProps {
  expenseId: Id<"expenses">
  remainingCents: number
  onSuccess?: () => void
}

export function QuickReimburseButton({
  expenseId,
  remainingCents,
  onSuccess,
}: QuickReimburseButtonProps) {
  const recordFull = useMutation(api.reimbursements.recordFull)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await recordFull({ expenseId })
      toast.success("Marked as fully reimbursed")
      setShowConfirm(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to record reimbursement")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (remainingCents <= 0) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="gap-2"
      >
        <CheckCircle className="h-4 w-4" />
        Mark Fully Reimbursed
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Fully Reimbursed</AlertDialogTitle>
            <AlertDialogDescription>
              This will record a reimbursement of{" "}
              <strong>{formatCurrency(remainingCents)}</strong> (the remaining
              balance) and mark this expense as fully reimbursed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
