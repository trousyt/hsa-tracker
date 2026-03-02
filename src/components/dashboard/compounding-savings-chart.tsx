import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Maximize2, Minimize2 } from "lucide-react"
import { formatCurrency, formatCurrencyShort } from "@/lib/currency"
import {
  calculateCompounding,
  filterYTD,
  type CompoundingExpense,
} from "@/lib/compounding"

interface CompoundingSavingsChartProps {
  data: CompoundingExpense[]
  expanded?: boolean
  onToggleExpand?: () => void
}

const chartConfig = {
  cumulativeGainCents: {
    label: "Investment Gains",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

/**
 * Format "YYYY-MM" as "'24" for year labels, or "Jan" for month within a year.
 */
function formatAxisLabel(month: string, isYTD: boolean): string {
  const [yearStr, monthStr] = month.split("-")
  if (isYTD) {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    return monthNames[parseInt(monthStr, 10) - 1]
  }
  // For all-time, show year markers
  if (monthStr === "01") {
    return `'${yearStr.slice(2)}`
  }
  return ""
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
  return `${monthNames[parseInt(monthStr, 10) - 1]} ${yearStr}`
}

export function CompoundingSavingsChart({ data, expanded, onToggleExpand }: CompoundingSavingsChartProps) {
  const [view, setView] = useState<"all" | "ytd">("all")

  const fullResult = useMemo(() => calculateCompounding(data), [data])
  const ytdResult = useMemo(() => filterYTD(fullResult), [fullResult])

  const activeResult = view === "ytd" ? ytdResult : fullResult

  const chartData = useMemo(() => {
    return activeResult.dataPoints.map((dp) => ({
      month: dp.month,
      label: formatAxisLabel(dp.month, view === "ytd"),
      fullLabel: formatMonthFull(dp.month),
      cumulativeGainCents: dp.cumulativeGainCents,
    }))
  }, [activeResult, view])

  // Check if all expenses are fully reimbursed (no unreimbursed balance)
  const allReimbursed = data.length > 0 && data.every((expense) => {
    const totalReimbursed = expense.reimbursements.reduce(
      (sum, r) => sum + r.amountCents, 0
    )
    return totalReimbursed >= expense.amountCents
  })

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">HSA Compounding Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No expenses recorded yet. Add your first expense to see compounding savings.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartHeight = expanded ? "h-[350px]" : "h-[160px]"

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">HSA Compounding Savings</CardTitle>
            <div className="mt-2" aria-live="polite">
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(activeResult.totalGainCents)}
              </p>
              <p className="text-sm text-muted-foreground">
                {view === "ytd"
                  ? "earned this year by keeping your HSA invested"
                  : "earned by keeping your HSA invested"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-1" role="group" aria-label="Time view">
              <button
                onClick={() => setView("all")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  view === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                aria-pressed={view === "all"}
              >
                All
              </button>
              <button
                onClick={() => setView("ytd")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  view === "ytd"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                aria-pressed={view === "ytd"}
              >
                YTD
              </button>
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
        {allReimbursed && activeResult.totalGainCents === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            All expenses have been reimbursed. Unreimbursed expenses generate compounding savings.
          </p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No data for this time period.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className={`${chartHeight} w-full`}
            aria-label={`HSA compounding savings ${view === "ytd" ? "year to date" : "all time"} area chart`}
          >
            <AreaChart accessibilityLayer data={chartData}>
              <defs>
                <linearGradient id="gainsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-cumulativeGainCents)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-cumulativeGainCents)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                fontSize={11}
                interval={view === "ytd" ? 0 : "preserveStartEnd"}
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
                        {formatCurrency(item.cumulativeGainCents)}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        cumulative investment gains
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeGainCents"
                stroke="var(--color-cumulativeGainCents)"
                strokeWidth={2}
                fill="url(#gainsFill)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          *Based on 10% average annual S&P 500 return, compounded monthly. Hypothetical illustration.
        </p>
      </CardContent>
    </Card>
  )
}
