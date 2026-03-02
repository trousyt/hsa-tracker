import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatCurrencyShort } from "@/lib/currency"
import { generateMonthRange } from "@/lib/compounding"

interface MonthlySpendingData {
  month: string // "YYYY-MM"
  totalCents: number
  expenseCount: number
}

interface MonthlySpendingChartProps {
  data: MonthlySpendingData[]
}

const chartConfig = {
  totalCents: {
    label: "Spending",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

/**
 * Format "YYYY-MM" as "Jan '24" for X-axis labels.
 */
function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split("-")
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const monthIndex = parseInt(monthStr, 10) - 1
  return `${monthNames[monthIndex]} '${yearStr.slice(2)}`
}

/**
 * Format "YYYY-MM" as "March 2024" for tooltip labels.
 */
function formatMonthFull(month: string): string {
  const [yearStr, monthStr] = month.split("-")
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  const monthIndex = parseInt(monthStr, 10) - 1
  return `${monthNames[monthIndex]} ${yearStr}`
}

export function MonthlySpendingChart({ data }: MonthlySpendingChartProps) {
  const [showAll, setShowAll] = useState(false)

  const chartData = useMemo(() => {
    if (data.length === 0) return []

    // Build a lookup from month -> data
    const dataMap = new Map(data.map((d) => [d.month, d]))

    // Determine the range
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    let startMonth: string
    if (showAll) {
      // Find earliest month in data
      const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month))
      startMonth = sorted[0].month
    } else {
      // Last 12 months
      const d = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    // Generate full range with zero-fill
    const months = generateMonthRange(startMonth, currentMonth)
    return months.map((month) => {
      const entry = dataMap.get(month)
      return {
        month,
        label: formatMonthLabel(month),
        fullLabel: formatMonthFull(month),
        totalCents: entry?.totalCents ?? 0,
        expenseCount: entry?.expenseCount ?? 0,
      }
    })
  }, [data, showAll])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Out-of-Pocket Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No expenses recorded yet. Add your first expense to see spending trends.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Monthly Out-of-Pocket Spending</CardTitle>
        <div className="flex gap-1" role="group" aria-label="Time range">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              !showAll
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            aria-pressed={!showAll}
          >
            Last 12 Months
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              showAll
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            aria-pressed={showAll}
          >
            All
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="min-h-[250px] w-full"
          aria-label="Monthly out-of-pocket medical spending bar chart"
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              fontSize={11}
              interval={chartData.length > 18 ? Math.floor(chartData.length / 12) : 0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatCurrencyShort(value)}
              fontSize={11}
              width={50}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as (typeof chartData)[0]
                return (
                  <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium">{item.fullLabel}</p>
                    <p className="text-foreground font-mono mt-1">
                      {formatCurrency(item.totalCents)}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {item.expenseCount} expense{item.expenseCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="totalCents"
              fill="var(--color-totalCents)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
