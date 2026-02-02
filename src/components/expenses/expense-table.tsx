import { useState, useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

import { getExpenseColumns } from "./expense-columns"
import { ExpenseDialog } from "./expense-dialog"
import { DeleteExpenseDialog } from "./delete-expense-dialog"

type Expense = Doc<"expenses">

export function ExpenseTable() {
  const expenses = useQuery(api.expenses.list, {})
  const [sorting, setSorting] = useState<SortingState>([])

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null)

  const columns = useMemo(
    () =>
      getExpenseColumns({
        onEdit: (expense) => setEditExpense(expense),
        onDelete: (expense) => setDeleteExpense(expense),
      }),
    []
  )

  const table = useReactTable({
    data: expenses ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  if (expenses === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading expenses...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Expenses</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
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
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
    </div>
  )
}
