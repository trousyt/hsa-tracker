import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Calculator } from "lucide-react"

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
import { dollarsToCents, formatCurrency } from "@/lib/currency"

const optimizerSchema = z.object({
  targetAmount: z.coerce
    .number({
      required_error: "Target amount is required",
      invalid_type_error: "Target amount must be a number",
    })
    .positive("Target amount must be positive")
    .multipleOf(0.01, "Amount cannot have more than 2 decimal places"),
})

type OptimizerFormData = z.infer<typeof optimizerSchema>

interface OptimizerInputProps {
  totalAvailableCents: number
  onOptimize: (targetCents: number) => void
  isOptimizing: boolean
}

export function OptimizerInput({
  totalAvailableCents,
  onOptimize,
  isOptimizing,
}: OptimizerInputProps) {
  const form = useForm<OptimizerFormData>({
    resolver: zodResolver(optimizerSchema),
    defaultValues: {
      targetAmount: 0,
    },
  })

  function onSubmit(data: OptimizerFormData) {
    const targetCents = dollarsToCents(data.targetAmount)

    if (targetCents > totalAvailableCents) {
      form.setError("targetAmount", {
        message: `Cannot exceed available amount of ${formatCurrency(totalAvailableCents)}`,
      })
      return
    }

    onOptimize(targetCents)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="targetAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Reimbursement Amount</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    {...field}
                  />
                </div>
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Available: {formatCurrency(totalAvailableCents)}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isOptimizing} className="w-full gap-2">
          <Calculator className="h-4 w-4" />
          {isOptimizing ? "Calculating..." : "Find Optimal Expenses"}
        </Button>
      </form>
    </Form>
  )
}
