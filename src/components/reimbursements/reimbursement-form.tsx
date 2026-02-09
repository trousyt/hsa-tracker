import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { dollarsToCents, centsToDollars, formatCurrency } from "@/lib/currency"
import { formatLocalDate } from "@/lib/dates"
import {
  reimbursementSchema,
  type ReimbursementFormData,
} from "@/lib/validations/reimbursement"

interface ReimbursementFormProps {
  expenseId: Id<"expenses">
  remainingCents: number
  onSuccess?: () => void
}

export function ReimbursementForm({
  expenseId,
  remainingCents,
  onSuccess,
}: ReimbursementFormProps) {
  const recordReimbursement = useMutation(api.reimbursements.record)

  const form = useForm<ReimbursementFormData>({
    resolver: zodResolver(reimbursementSchema),
    defaultValues: {
      amount: centsToDollars(remainingCents),
      date: new Date(),
      notes: "",
    },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(data: ReimbursementFormData) {
    try {
      const amountCents = dollarsToCents(data.amount)

      if (amountCents > remainingCents) {
        form.setError("amount", {
          message: `Cannot exceed remaining amount of ${formatCurrency(remainingCents)}`,
        })
        return
      }

      await recordReimbursement({
        expenseId,
        amountCents,
        date: data.date ? formatLocalDate(data.date) : undefined,
        notes: data.notes || undefined,
      })

      toast.success("Reimbursement recorded")
      form.reset()
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to record reimbursement")
      console.error(error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={centsToDollars(remainingCents)}
                    placeholder="0.00"
                    className="pl-7"
                    {...field}
                  />
                </div>
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Remaining: {formatCurrency(remainingCents)}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., HSA distribution #123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Recording..." : "Record Reimbursement"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
