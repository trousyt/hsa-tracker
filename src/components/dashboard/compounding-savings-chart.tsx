import { useMemo } from "react"
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
  filterRecentMonths,
  type CompoundingExpense,
} from "@/lib/compounding"
import { type TimeRange, formatMonthLabel, formatMonthFull } from "@/lib/chart-types"

interface CompoundingSavingsChartProps {
  data: CompoundingExpense[]
  expanded?: boolean
  onToggleExpand?: () => void
  range: TimeRange
  onRangeChange: (r: TimeRange) => void
}

const chartConfig = {
  cumulativeGainCents: {
    label: "Investment Gains",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig


export function CompoundingSavingsChart({ data, expanded, onToggleExpand, range, onRangeChange }: CompoundingSavingsChartProps) {

  const fullResult = useMemo(() => calculateCompounding(data), [data])

  const activeResult = useMemo(() => {
    switch (range) {
      case "ytd":
        return filterYTD(fullResult)
      case "1y":
        return filterRecentMonths(fullResult, 12)
      case "5y":
        return filterRecentMonths(fullResult, 60)
      case "6mo":
        return filterRecentMonths(fullResult, 6)
      case "all":
      default:
        return fullResult
    }
  }, [fullResult, range])

  const chartData = useMemo(() => {
    return activeResult.dataPoints.map((dp) => ({
      month: dp.month,
      label: formatMonthLabel(dp.month),
      fullLabel: formatMonthFull(dp.month),
      cumulativeGainCents: dp.cumulativeGainCents,
    }))
  }, [activeResult])

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
          <CardTitle className="text-xl">Compounding Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No expenses recorded yet. Add your first expense to see compounding savings.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartHeight = expanded ? "!h-[50vh] !aspect-auto" : "!h-[160px] !aspect-auto"
  const ranges: { key: TimeRange; label: string }[] = [
    { key: "all", label: "All" },
    { key: "5y", label: "5Y" },
    { key: "1y", label: "1Y" },
    { key: "6mo", label: "6M" },
    { key: "ytd", label: "YTD" },
  ]

  const subtitleByRange: Record<TimeRange, string> = {
    all: "estimated savings all time",
    "5y": "estimated savings last 5 years",
    "1y": "estimated savings last year",
    "6mo": "estimated savings last 6 mo",
    ytd: "estimated savings year to date",
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Compounding Savings</CardTitle>
            <div className="mt-2" aria-live="polite">
              <p className="text-lg font-bold tracking-tight">
                {formatCurrency(activeResult.totalGainCents)}
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
                  onClick={() => onRangeChange(r.key)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            aria-label={`Compounding savings ${range === "ytd" ? "year to date" : range} area chart`}
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
                interval="preserveStartEnd"
                minTickGap={expanded ? 50 : 60}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatCurrencyShort(value)}
                fontSize={11}
                width={50}
              />
              <ChartTooltip
                animationDuration={150}
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
                isAnimationActive={false}
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
