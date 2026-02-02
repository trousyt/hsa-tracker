import { z } from "zod"

export const reimbursementSchema = z.object({
  amount: z.coerce
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount cannot have more than 2 decimal places"),
  date: z.date().optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
})

export type ReimbursementFormData = z.infer<typeof reimbursementSchema>
