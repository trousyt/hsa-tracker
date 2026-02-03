import { useState, useMemo, useEffect } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Download, Upload, Search } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getExpenseColumns } from "./expense-columns"
import { exportExpensesToCSV } from "@/lib/export"
import { formatCurrency } from "@/lib/currency"
import { ExpenseDialog } from "./expense-dialog"
import { DeleteExpenseDialog } from "./delete-expense-dialog"
import { ExpenseDetail } from "./expense-detail"
import { ImportWizard } from "../import/import-wizard"

type Expense = Doc<"expenses">
type StatusFilter = "all" | "unreimbursed" | "partial" | "reimbursed"

export function ExpenseTable() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const expenses = useQuery(
    api.expenses.listWithOcrStatus,
    statusFilter === "all" ? {} : { status: statusFilter }
  )
  const [sorting, setSorting] = useState<SortingState>([
    { id: "datePaid", desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState("")

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null)
  const [viewExpenseId, setViewExpenseId] = useState<Id<"expenses"> | null>(null)
  const [showImportWizard, setShowImportWizard] = useState(false)

  const columns = useMemo(
    () =>
      getExpenseColumns({
        onView: (expense) => setViewExpenseId(expense._id),
        onEdit: (expense) => setEditExpense(expense),
        onDelete: (expense) => setDeleteExpense(expense),
      }),
    []
  )

  // Keyboard shortcut: Cmd/Ctrl + N to create new expense
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "n") {
        event.preventDefault()
        setCreateDialogOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast.error("No expenses to export")
      return
    }
    exportExpensesToCSV(expenses)
    toast.success("Expenses exported to CSV")
  }

  const table = useReactTable({
    data: expenses ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true
      const search = filterValue.toLowerCase()
      const provider = (row.getValue("provider") as string).toLowerCase()
      const comment = ((row.getValue("comment") as string) || "").toLowerCase()
      const amount = formatCurrency(row.getValue("amountCents") as number)

      // Provider: contains (case-insensitive)
      if (provider.includes(search)) return true

      // Comment: contains (case-insensitive)
      if (comment.includes(search)) return true

      // Amount: exact match (e.g., "125.00" or "$125.00")
      if (amount === `$${filterValue}` || amount === filterValue) return true

      return false
    },
    state: {
      sorting,
      globalFilter,
    },
  })

  if (expenses === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-[200px]" />
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="rounded-md border">
          <div className="border-b">
            <div className="flex h-10 items-center px-4 gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex h-14 items-center border-b px-4 gap-4 last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Show import wizard if active
  if (showImportWizard) {
    return (
      <div className="space-y-4">
        <ImportWizard onClose={() => setShowImportWizard(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Expenses</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unreimbursed">Unreimbursed</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="reimbursed">Reimbursed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowImportWizard(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => setViewExpenseId(row.original._id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        // Prevent row click when clicking action menu
                        if (cell.column.id === "actions") {
                          e.stopPropagation()
                        }
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No expenses yet. Click "Add Expense" to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <ExpenseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Edit Dialog */}
      <ExpenseDialog
        open={!!editExpense}
        onOpenChange={(open) => !open && setEditExpense(null)}
        expense={editExpense ?? undefined}
      />

      {/* Delete Dialog */}
      <DeleteExpenseDialog
        open={!!deleteExpense}
        onOpenChange={(open) => !open && setDeleteExpense(null)}
        expense={deleteExpense}
      />

      {/* Detail Sheet */}
      <ExpenseDetail
        expenseId={viewExpenseId}
        open={!!viewExpenseId}
        onOpenChange={(open) => !open && setViewExpenseId(null)}
      />
    </div>
  )
}
