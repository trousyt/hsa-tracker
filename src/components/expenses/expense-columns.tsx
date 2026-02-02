import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Doc } from "../../../convex/_generated/dataModel"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/currency"

type Expense = Doc<"expenses">

interface ColumnActionsProps {
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

export function getExpenseColumns({
  onEdit,
  onDelete,
}: ColumnActionsProps): ColumnDef<Expense>[] {
  return [
    {
      accessorKey: "datePaid",
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("datePaid"))
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      },
    },
    {
      accessorKey: "provider",
      header: "Provider",
    },
    {
      accessorKey: "amountCents",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => {
        const amountCents = row.getValue("amountCents") as number
        return (
          <div className="text-right font-medium">
            {formatCurrency(amountCents)}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const expense = row.original
        const remaining = expense.amountCents - expense.totalReimbursedCents

        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                status === "reimbursed"
                  ? "default"
                  : status === "partial"
                    ? "secondary"
                    : "outline"
              }
            >
              {status === "reimbursed"
                ? "Reimbursed"
                : status === "partial"
                  ? "Partial"
                  : "Unreimbursed"}
            </Badge>
            {status === "partial" && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(remaining)} remaining
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) => {
        const comment = row.getValue("comment") as string | undefined
        if (!comment) return <span className="text-muted-foreground">—</span>
        return (
          <span className="max-w-[200px] truncate block" title={comment}>
            {comment}
          </span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const expense = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(expense)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(expense)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
