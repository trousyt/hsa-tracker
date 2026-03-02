import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Maximize2, Minimize2 } from "lucide-react"
import { formatCurrency, formatCurrencyShort } from "@/lib/currency"
import { generateMonthRange } from "@/lib/compounding"

interface MonthlySpendingData {
  month: string // "YYYY-MM"
  totalCents: number
  expenseCount: number
}

interface MonthlySpendingChartProps {
  data: MonthlySpendingData[]
  expanded?: boolean
  onToggleExpand?: () => void
}

type TimeRange = "6mo" | "ytd" | "1y" | "all"

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

export function MonthlySpendingChart({ data, expanded, onToggleExpand }: MonthlySpendingChartProps) {
  const [range, setRange] = useState<TimeRange>("6mo")

  const chartData = useMemo(() => {
    if (data.length === 0) return []

    // Build a lookup from month -> data
    const dataMap = new Map(data.map((d) => [d.month, d]))

    // Determine the range
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    let startMonth: string
    switch (range) {
      case "ytd":
        startMonth = `${now.getFullYear()}-01`
        break
      case "1y": {
        const d = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        break
      }
      case "all": {
        const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month))
        startMonth = sorted[0].month
        break
      }
      case "6mo":
      default: {
        const d = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        break
      }
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
  }, [data, range])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Out-of-pocket Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No expenses recorded yet. Add your first expense to see spending trends.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartHeight = expanded ? "!h-[350px] !aspect-auto" : "!h-[160px] !aspect-auto"
  const ranges: { key: TimeRange; label: string }[] = [
    { key: "all", label: "All" },
    { key: "1y", label: "1Y" },
    { key: "6mo", label: "6M" },
    { key: "ytd", label: "YTD" },
  ]

  const totalCents = chartData.reduce((sum, d) => sum + d.totalCents, 0)
  const subtitleByRange: Record<TimeRange, string> = {
    all: "spent all time",
    "1y": "spent last year",
    "6mo": "spent last 6 months",
    ytd: "spent year to date",
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Out-of-pocket Spending</CardTitle>
            <div className="mt-2" aria-live="polite">
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(totalCents)}
              </p>
              <p className="text-sm text-muted-foreground">
                {subtitleByRange[range]}
              </p>
            </div>
          </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1" role="group" aria-label="Time range">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                aria-pressed={range === r.key}
              >
                {r.label}
              </button>
            ))}
          </div>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label={expanded ? "Minimize chart" : "Maximize chart"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className={`${chartHeight} w-full`}
          aria-label="Out-of-pocket medical spending bar chart"
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              fontSize={11}
              interval="preserveStartEnd"
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
