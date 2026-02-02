import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  DollarSign,
  Receipt,
  CheckCircle,
  Clock,
  CircleDashed,
  ScanText,
} from "lucide-react"

import { SummaryCard } from "./summary-card"
import { formatCurrency } from "@/lib/currency"

export function Dashboard() {
  const summary = useQuery(api.expenses.getSummary)
  const ocrUsage = useQuery(api.ocr.getCurrentUsage)

  if (summary === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-lg border bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Expenses"
          value={formatCurrency(summary.totalAmountCents)}
          subtitle={`${summary.expenseCount} expense${summary.expenseCount !== 1 ? "s" : ""}`}
          icon={DollarSign}
          variant="default"
        />

        <SummaryCard
          title="Unreimbursed"
          value={formatCurrency(summary.totalUnreimbursedCents)}
          subtitle={`${summary.unreimbursedCount + summary.partialCount} expense${summary.unreimbursedCount + summary.partialCount !== 1 ? "s" : ""} pending`}
          icon={Clock}
          variant="warning"
        />

        <SummaryCard
          title="Reimbursed"
          value={formatCurrency(summary.totalReimbursedCents)}
          subtitle={`${summary.reimbursedCount} expense${summary.reimbursedCount !== 1 ? "s" : ""} claimed`}
          icon={CheckCircle}
          variant="success"
        />

        <SummaryCard
          title="Status Breakdown"
          value={`${summary.unreimbursedCount} / ${summary.partialCount} / ${summary.reimbursedCount}`}
          subtitle="Unreimbursed / Partial / Reimbursed"
          icon={Receipt}
          variant="muted"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          title="Unreimbursed"
          count={summary.unreimbursedCount}
          icon={CircleDashed}
          color="text-muted-foreground"
        />
        <StatusCard
          title="Partially Reimbursed"
          count={summary.partialCount}
          icon={Clock}
          color="text-yellow-500"
        />
        <StatusCard
          title="Fully Reimbursed"
          count={summary.reimbursedCount}
          icon={CheckCircle}
          color="text-green-500"
        />
      </div>

      {ocrUsage && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 text-sm">
          <ScanText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            OCR usage this month: {ocrUsage.pagesProcessed} page
            {ocrUsage.pagesProcessed !== 1 ? "s" : ""} (~
            {formatCurrency(ocrUsage.estimatedCostCents)})
          </span>
        </div>
      )}
    </div>
  )
}

interface StatusCardProps {
  title: string
  count: number
  icon: React.ElementType
  color: string
}

function StatusCard({ title, count, icon: Icon, color }: StatusCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Icon className={`h-8 w-8 ${color}`} />
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}
