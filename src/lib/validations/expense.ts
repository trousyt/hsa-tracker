import { z } from "zod"
import { EXPENSE_CATEGORY_VALUES } from "@/lib/constants/expense-categories"

export const expenseSchema = z.object({
  datePaid: z.date({ required_error: "Date is required" }),
  provider: z.string().min(1, "Provider is required").max(200),
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be positive"),
  comment: z.string().max(1000).optional(),
  // Use const tuple directly with z.enum() for type safety
  // .nullish() = optional | null (cleaner than .optional().nullable())
  category: z.enum(EXPENSE_CATEGORY_VALUES).nullish(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
