import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { useMemo, useCallback } from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { expenseSchema, type ExpenseFormData } from "@/lib/validations/expense"
import { EXPENSE_CATEGORIES } from "@/lib/constants/expense-categories"
import { formatDollars } from "@/lib/currency"

/** Fields that support OCR comparison */
type OcrFieldKey = "amount" | "datePaid" | "provider"
type FieldSource = "ocr" | "original"
type OcrFieldSelections = Record<OcrFieldKey, FieldSource>

interface OcrFieldValues {
  datePaid?: Date
  provider?: string
  amount?: number
}

interface OriginalFieldValues {
  datePaid: Date
  provider: string
  amount: number
}

interface ExpenseFormProps {
  defaultValues?: Partial<ExpenseFormData>
  onSubmit: (data: ExpenseFormData) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** OCR-extracted values for comparison */
  ocrValues?: OcrFieldValues
  /** Original expense values for comparison */
  originalValues?: OriginalFieldValues
  /** Current field source selections */
  ocrSelections?: OcrFieldSelections
  /** Callback when user toggles field source */
  onOcrSelectionChange?: (field: OcrFieldKey, source: FieldSource) => void
}

export function ExpenseForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  ocrValues,
  originalValues,
  ocrSelections,
  onOcrSelectionChange,
}: ExpenseFormProps) {
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      datePaid: defaultValues?.datePaid ?? new Date(),
      provider: defaultValues?.provider ?? "",
      amount: defaultValues?.amount ?? undefined,
      comment: defaultValues?.comment ?? "",
      category: defaultValues?.category ?? undefined,
    },
  })

  // Compute which fields have differences between OCR and original
  const fieldDiffs = useMemo(() => {
    if (!ocrValues || !originalValues) {
      return { datePaid: false, provider: false, amount: false }
    }
    return {
      datePaid:
        ocrValues.datePaid !== undefined &&
        ocrValues.datePaid.getTime() !== originalValues.datePaid.getTime(),
      provider:
        ocrValues.provider !== undefined &&
        ocrValues.provider.toLowerCase().trim() !==
          originalValues.provider.toLowerCase().trim(),
      amount:
        ocrValues.amount !== undefined &&
        ocrValues.amount !== originalValues.amount,
    }
  }, [ocrValues, originalValues])

  // Idempotent handler for selecting a field source
  const selectSource = useCallback(
    (field: OcrFieldKey, source: FieldSource) => {
      if (!ocrSelections || !onOcrSelectionChange || !ocrValues || !originalValues) {
        return
      }
      if (ocrSelections[field] === source) return // Already selected

      // Calculate new value BEFORE any state updates
      let newValue: Date | string | number | undefined
      if (field === "datePaid") {
        newValue = source === "ocr" ? ocrValues.datePaid : originalValues.datePaid
      } else if (field === "provider") {
        newValue = source === "ocr" ? ocrValues.provider : originalValues.provider
      } else if (field === "amount") {
        newValue = source === "ocr" ? ocrValues.amount : originalValues.amount
      }

      // Update selection state and form value synchronously
      onOcrSelectionChange(field, source)
      if (newValue !== undefined) {
        form.setValue(field, newValue as never, {
          shouldValidate: true,
          shouldDirty: true,
        })
      }
    },
    [ocrSelections, onOcrSelectionChange, ocrValues, originalValues, form]
  )

  // Check if diff indicators should be shown
  const showDiffIndicators = ocrSelections && ocrValues && originalValues

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="datePaid"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date Paid</FormLabel>
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
                    defaultMonth={field.value}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
              {/* OCR Diff Indicator */}
              {showDiffIndicators && fieldDiffs.datePaid && (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <span className="truncate">
                    {ocrSelections.datePaid === "ocr" ? (
                      <>
                        Was:{" "}
                        <span className="font-medium">
                          {format(originalValues.datePaid, "PPP")}
                        </span>
                      </>
                    ) : (
                      <>
                        OCR found:{" "}
                        <span className="font-medium">
                          {ocrValues.datePaid && format(ocrValues.datePaid, "PPP")}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-border" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      selectSource(
                        "datePaid",
                        ocrSelections.datePaid === "ocr" ? "original" : "ocr"
                      )
                    }
                    className={cn(
                      "underline underline-offset-2 transition-colors",
                      "min-h-[44px] -my-4 py-4",
                      "hover:text-foreground focus:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                    )}
                    aria-label={`Use ${ocrSelections.datePaid === "ocr" ? "original" : "OCR"} value for Date`}
                  >
                    {ocrSelections.datePaid === "ocr" ? "Use original" : "Apply OCR"}
                  </button>
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Dr. Smith, CVS Pharmacy" {...field} />
              </FormControl>
              <FormMessage />
              {/* OCR Diff Indicator */}
              {showDiffIndicators && fieldDiffs.provider && (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <span className="truncate">
                    {ocrSelections.provider === "ocr" ? (
                      <>
                        Was:{" "}
                        <span className="font-medium">"{originalValues.provider}"</span>
                      </>
                    ) : (
                      <>
                        OCR found:{" "}
                        <span className="font-medium">"{ocrValues.provider}"</span>
                      </>
                    )}
                  </span>
                  <span className="text-border" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      selectSource(
                        "provider",
                        ocrSelections.provider === "ocr" ? "original" : "ocr"
                      )
                    }
                    className={cn(
                      "underline underline-offset-2 transition-colors",
                      "min-h-[44px] -my-4 py-4",
                      "hover:text-foreground focus:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                    )}
                    aria-label={`Use ${ocrSelections.provider === "ocr" ? "original" : "OCR"} value for Provider`}
                  >
                    {ocrSelections.provider === "ocr" ? "Use original" : "Apply OCR"}
                  </button>
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category (optional)</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(value === "__none__" ? null : value)
                }
                value={field.value ?? "__none__"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">No Category</SelectItem>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              {/* OCR Diff Indicator */}
              {showDiffIndicators && fieldDiffs.amount && (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <span className="truncate">
                    {ocrSelections.amount === "ocr" ? (
                      <>
                        Was:{" "}
                        <span className="font-medium">
                          {formatDollars(originalValues.amount)}
                        </span>
                      </>
                    ) : (
                      <>
                        OCR found:{" "}
                        <span className="font-medium">
                          {ocrValues.amount !== undefined &&
                            formatDollars(ocrValues.amount)}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-border" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      selectSource(
                        "amount",
                        ocrSelections.amount === "ocr" ? "original" : "ocr"
                      )
                    }
                    className={cn(
                      "underline underline-offset-2 transition-colors",
                      "min-h-[44px] -my-4 py-4",
                      "hover:text-foreground focus:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                    )}
                    aria-label={`Use ${ocrSelections.amount === "ocr" ? "original" : "OCR"} value for Amount`}
                  >
                    {ocrSelections.amount === "ocr" ? "Use original" : "Apply OCR"}
                  </button>
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Any notes about this expense"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Expense"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
