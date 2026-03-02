import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "convex/_generated/api"
import {
  DollarSign,
  Receipt,
  CheckCircle,
  Clock,
  CircleDashed,
  ScanText,
} from "lucide-react"

import { SummaryCard } from "./summary-card"
import { MonthlySpendingChart } from "./monthly-spending-chart"
import { CompoundingSavingsChart } from "./compounding-savings-chart"
import { formatCurrency } from "@/lib/currency"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { TimeRange } from "@/lib/chart-types"

export function Dashboard() {
  const summary = useQuery(api.expenses.getSummary)
  const ocrUsage = useQuery(api.ocr.getCurrentUsage)
  const chartData = useQuery(api.charts.getChartData)
  const [expandedChart, setExpandedChart] = useState<"spending" | "compounding" | null>(null)
  const [spendingRange, setSpendingRange] = useState<TimeRange>("6mo")
  const [compoundingRange, setCompoundingRange] = useState<TimeRange>("all")

  if (summary === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-lg border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[280px] rounded-lg border bg-muted/30 animate-pulse" />
          <div className="h-[280px] rounded-lg border bg-muted/30 animate-pulse" />
        </div>
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

      {chartData ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlySpendingChart
            data={chartData.monthlySpending}
            range={spendingRange}
            onRangeChange={setSpendingRange}
            onToggleExpand={() => setExpandedChart("spending")}
          />
          <CompoundingSavingsChart
            data={chartData.compoundingData}
            range={compoundingRange}
            onRangeChange={setCompoundingRange}
            onToggleExpand={() => setExpandedChart("compounding")}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[280px] rounded-lg border bg-muted/30 animate-pulse" />
          <div className="h-[280px] rounded-lg border bg-muted/30 animate-pulse" />
        </div>
      )}

      <Dialog open={expandedChart !== null} onOpenChange={(open) => { if (!open) setExpandedChart(null) }}>
        <DialogContent className="sm:max-w-[70vw] max-h-[70vh] p-0 data-[state=open]:duration-150 data-[state=closed]:animate-none data-[state=closed]:!zoom-100" showCloseButton={false}>
          <DialogTitle className="sr-only">
            {expandedChart === "spending" ? "Out-of-pocket Spending" : "Compounding Savings"}
          </DialogTitle>
          {expandedChart === "spending" && chartData && (
            <MonthlySpendingChart
              data={chartData.monthlySpending}
              expanded
              range={spendingRange}
              onRangeChange={setSpendingRange}
              onToggleExpand={() => setExpandedChart(null)}
            />
          )}
          {expandedChart === "compounding" && chartData && (
            <CompoundingSavingsChart
              data={chartData.compoundingData}
              expanded
              range={compoundingRange}
              onRangeChange={setCompoundingRange}
              onToggleExpand={() => setExpandedChart(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {ocrUsage && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 text-sm shadow-sm">
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
    <div className="flex items-center gap-4 p-4 border rounded-lg shadow-sm">
      <Icon className={`h-8 w-8 ${color}`} />
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}
