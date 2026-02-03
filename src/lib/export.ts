import type { Doc } from "../../convex/_generated/dataModel"
import { centsToDollars } from "./currency"
import { getCategoryLabel } from "./constants/expense-categories"
import type { ExpenseCategory } from "./constants/expense-categories"

type Expense = Doc<"expenses">

export function exportExpensesToCSV(expenses: Expense[]): void {
  const headers = [
    "Date Paid",
    "Provider",
    "Amount",
    "Reimbursed",
    "Remaining",
    "Status",
    "Category",
    "Comment",
  ]

  const rows = expenses.map((expense) => {
    const remaining = expense.amountCents - expense.totalReimbursedCents
    return [
      expense.datePaid,
      `"${expense.provider.replace(/"/g, '""')}"`, // Escape quotes
      centsToDollars(expense.amountCents).toFixed(2),
      centsToDollars(expense.totalReimbursedCents).toFixed(2),
      centsToDollars(remaining).toFixed(2),
      expense.status,
      getCategoryLabel(expense.category as ExpenseCategory | undefined),
      expense.comment ? `"${expense.comment.replace(/"/g, '""')}"` : "",
    ]
  })

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n"
  )

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute(
    "download",
    `hsa-expenses-${new Date().toISOString().split("T")[0]}.csv`
  )
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
