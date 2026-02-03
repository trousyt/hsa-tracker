import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Pencil, Trash2, Eye, FileText, Sparkles, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { Doc } from "../../../convex/_generated/dataModel"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/currency"

type Expense = Doc<"expenses"> & { hasUnacknowledgedOcr?: boolean }

interface ColumnActionsProps {
  onView: (expense: Expense) => void
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

export function getExpenseColumns({
  onView,
  onEdit,
  onDelete,
}: ColumnActionsProps): ColumnDef<Expense>[] {
  return [
    {
      accessorKey: "datePaid",
      header: ({ column }) => {
        const sorted = column.getIsSorted()
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(sorted === "asc")}
            className="h-8"
          >
            Date
            {sorted === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : sorted === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
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
      cell: ({ row }) => {
        const expense = row.original
        const hasDocuments = expense.documentIds.length > 0
        return (
          <div className="flex items-center gap-2">
            <span>{row.getValue("provider")}</span>
            {expense.hasUnacknowledgedOcr && (
              <span title="OCR data available - click to review">
                <Sparkles className="h-4 w-4 text-primary" />
              </span>
            )}
            {hasDocuments && (
              <span title="Has documents">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "amountCents",
      header: ({ column }) => {
        const sorted = column.getIsSorted()
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(sorted === "asc")}
              className="-mr-4"
            >
              Amount
              {sorted === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : sorted === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          </div>
        )
      },
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
              <DropdownMenuItem onClick={() => onView(expense)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(expense)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
