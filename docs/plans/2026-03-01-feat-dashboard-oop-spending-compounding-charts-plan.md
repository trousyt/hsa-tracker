---
title: "feat: Add OOP Spending & Compounding Savings Charts to Dashboard"
type: feat
status: completed
date: 2026-03-01
github_issue: "#14"
---

# feat: Add OOP Spending & Compounding Savings Charts to Dashboard

## Overview

Add two data visualizations to the dashboard to give users insight into their HSA strategy:

1. **Monthly Out-of-Pocket Spending Bar Chart** -- Shows total expenses per month as a bar chart with a time range toggle (Last 12 Months / All).
2. **HSA Compounding Savings Line Chart** -- Shows cumulative investment gains from keeping HSA funds invested (S&P 500 benchmark at 10% annual return), with a hero headline number and All-Time / YTD toggle.

Both charts render full-width below the existing summary cards, stacked vertically.

## Problem Statement / Motivation

The current dashboard shows only aggregate totals (total expenses, unreimbursed amount, reimbursed amount, counts). Users have no visibility into:
- **Spending trends** -- how OOP medical spending varies month to month
- **Strategy payoff** -- the tangible dollar value of keeping HSA funds invested instead of reimbursing immediately

This is the core value proposition of the HSA tracker: pay expenses out of pocket now so HSA funds compound in the market. Showing investment gains makes the strategy's benefit concrete and motivating.

## Proposed Solution

### Chart 1: Monthly OOP Spending (Bar Chart)

- **Chart type**: Vertical bar chart with rounded top corners (radius 4px), subtle gradient fill
- **Data**: All expenses grouped by `datePaid` month, summed by `amountCents`
- **X-axis**: Month labels formatted as `"Jan '24"`, `"Feb '24"`, etc.
- **Y-axis**: Dollar amounts, abbreviated for large values (`$1.2K`, `$15K`)
- **Time range**: Toggle between "Last 12 Months" (default) and "All"
- **Zero-fill**: Months with no expenses show as $0 (no gaps)
- **Tooltip**: On hover shows `"March 2026: $1,234.56"` with expense count
- **Styling**: Light horizontal grid lines, single theme color from `--chart-1`

### Chart 2: HSA Compounding Savings (Line/Area Chart)

- **Hero headline**: Large prominent number -- `"You've earned $X by keeping your HSA invested"` (using S&P 500 as a benchmark)
- **Chart type**: Single line showing cumulative investment gains over time
- **Data**: For each unreimbursed expense, compute compound growth from `datePaid` to today at 10% annual return (compounded monthly). When partial reimbursements occur, reduce the compounding principal from the reimbursement date forward (precise piecewise tracking).
- **X-axis**: Monthly time points, labeled as `"'23"`, `"'24"`, etc.
- **Y-axis**: Dollar amounts (gains only, not principal)
- **Time toggle**: "All-Time" (default) and "YTD"
  - **All-Time**: Cumulative gains from the earliest expense to today
  - **YTD**: Gains earned in the current calendar year from all unreimbursed expenses. Calculated as: `gain(datePaid → today) - gain(datePaid → Jan 1 of current year)` for each expense. Example: a $1,000 expense from 2023 that has gained $210 total but $65 of that is from Jan 1 2026 to today -- YTD shows $65.
- **Disclaimer footnote**: `"*Based on 10% average annual S&P 500 return, compounded monthly. Hypothetical illustration."`
- **Styling**: Smooth monotone line with subtle area fill beneath, theme color `--chart-2`

### Layout

```
┌────────┐┌────────┐┌────────┐┌────────┐
│ Total  ││Unreimb ││Reimbsd ││ Status │  (existing cards)
└────────┘└────────┘└────────┘└────────┘

┌──────────────────────────────────────┐
│ Monthly Out-of-Pocket Spending       │
│ [Last 12 Months ▼]  [All]           │
│  ▐█▌ ▐█▌    ▐█▌▐█▌▐█▌▐█▌ ▐█▌▐█▌    │
│  ▐█▌ ▐█▌ ▐█▌▐█▌▐█▌▐█▌▐█▌ ▐█▌▐█▌▐█▌ │
│  Mar  Apr May Jun Jul Aug ...    Feb │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ HSA Compounding Savings              │
│ You've earned $1,823.17              │
│ by keeping your HSA invested         │
│ [All-Time]  [YTD]                    │
│          ╱╱╱╱╱╱╱╱╱╱╱                │
│     ╱╱╱╱╱                            │
│  ╱╱╱                                 │
│  '23    '24    '25    '26            │
│ *Based on 10% avg S&P 500 return     │
└──────────────────────────────────────┘
```

## Technical Considerations

### New Dependencies

- **`bunx shadcn@latest add chart`** -- Installs the shadcn Chart component + Recharts as a dependency
- Creates `src/components/ui/chart.tsx` with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`
- May add CSS variables for chart colors to the theme (`--chart-1` through `--chart-5`)

### New Convex Query: `getChartData`

A single server-side query (`convex/charts.ts` or added to `convex/expenses.ts`) that returns aggregated data for both charts. This avoids N+1 queries and keeps computation server-side.

**Returns:**
```typescript
{
  // For monthly spending chart
  monthlySpending: Array<{
    month: string           // "2024-01"
    totalCents: number      // sum of amountCents for that month
    expenseCount: number    // number of expenses in that month
  }>

  // For compounding chart -- raw data for client-side calculation
  compoundingData: Array<{
    expenseId: Id<"expenses">
    datePaid: string        // "2024-01-15"
    amountCents: number
    reimbursements: Array<{
      date: string          // "2024-06-15"
      amountCents: number
    }>
  }>
}
```

The monthly spending aggregation is simple server-side grouping. The compounding raw data avoids the N+1 problem with reimbursements by joining expenses + reimbursements in a single query.

### Compounding Calculation Utility: `src/lib/compounding.ts`

A pure utility function that takes the raw compounding data and computes gains at monthly intervals.

**Algorithm (portfolio simulation with compound interest):**

Use a running portfolio balance that grows monthly. Expenses add to the balance; reimbursements withdraw from it. Gains earned in earlier months continue compounding.

```
monthlyRate = (1.10)^(1/12) - 1 ≈ 0.007974

Build a timeline of events sorted by date:
  - Each expense: (+amountCents on datePaid)
  - Each reimbursement: (-amountCents on reimbursement date)

Simulate month by month:
  balance = 0
  totalContributions = 0   // net: expenses added minus reimbursements withdrawn

  For each month M from earliest event to today:
    1. Apply contributions/withdrawals that fall within month M:
       balance += net contributions for month M
       totalContributions += net contributions for month M
    2. Grow the balance:
       balance = balance * (1 + monthlyRate)
    3. Record the data point:
       cumulativeGain[M] = balance - totalContributions

Output: array of { month, cumulativeGainCents } for chart rendering.
```

**Why portfolio simulation over piecewise segments:** When gains accumulate in segment 1 and a partial reimbursement occurs, those gains remain invested. A piecewise approach that resets principal to `expense - reimbursement` misses this. Example: $1,000 invested for 6 months (~$48.81 gain), then $300 reimbursed -- remaining balance is $748.81, not $700. The portfolio approach handles this naturally.

**Key formula:**
- Annual rate: 10% (0.10)
- Monthly rate: `(1.10)^(1/12) - 1 ≈ 0.007974`
- Balance grows: `balance = balance * (1 + monthlyRate)` each month
- Gain = `balance - totalContributions` at any point

**Unit tests required** (`src/lib/compounding.test.ts`):
- No expenses -> $0 gains
- Single expense, no reimbursement, 12 months -> verify against manual calculation: $1000 * ((1.007974)^12 - 1) = ~$100.00
- Single expense, fully reimbursed immediately -> $0 gains (balance goes to 0 before any growth)
- Partial reimbursement mid-period -> verify gains from first period carry forward (balance after reimbursement > expense - reimbursement)
- Multiple expenses with overlapping periods at different start dates
- YTD filter: verify `gain(today) - gain(Jan 1)` isolation
- Edge case: expense dated today (0 months compounding -> $0)
- Edge case: reimbursement exceeds remaining principal (should not go negative)

### Performance

- Monthly spending: Server-side aggregation is O(N) where N = number of expenses. Fast for typical personal use (<1000 expenses).
- Compounding: Client-side calculation from raw data. O(N * M * T) worst case where N = expenses, M = avg reimbursements per expense, T = months span. For 100 expenses over 5 years: ~6000 iterations. Negligible.
- Both queries use Convex's reactive system -- charts update in real-time when expenses/reimbursements change.

### Currency Formatting in Charts

- **Y-axis labels**: Use abbreviated format for large values ($1.2K, $15K). Create a `formatCurrencyShort(cents)` helper.
- **Tooltip values**: Use full `formatCurrency(cents)` from `src/lib/currency.ts` (e.g., "$1,234.56").
- **Hero number**: Use full `formatCurrency(cents)`.
- **Critical**: All chart data stays in cents until display. Never convert to dollars for calculation.

### Date Handling

- Month bucketing: Extract `YYYY-MM` from `datePaid` string via `datePaid.slice(0, 7)` -- safe since dates are ISO strings, no timezone conversion needed.
- Month labels: Use `date-fns` `format()` for display (e.g., `"Jan '24"`).
- Zero-fill months: Generate a complete sequence from the earliest expense month to today, fill missing months with `{ totalCents: 0, expenseCount: 0 }`.

### Accessibility

Per project requirements in CLAUDE.md:
- `accessibilityLayer` prop on all Recharts chart components (enables keyboard navigation)
- `aria-label` on chart container regions describing purpose (e.g., "Monthly out of pocket medical spending bar chart")
- Visually hidden summary text for screen readers: "You spent $X total across Y months. Your highest spending month was Z."
- Hero savings number uses `aria-live="polite"` so changes are announced
- All interactive elements (time range toggles) have accessible names
- Chart colors meet WCAG contrast ratios in both light and dark mode

### Loading States

Match the existing dashboard skeleton pattern (`dashboard.tsx:19-30`): show pulsing placeholder rectangles matching the chart dimensions while the `getChartData` query loads. Each chart card shows a shimmer effect at its `min-h` height.

### Empty States

- **No expenses**: Show a friendly message in place of each chart: "No expenses recorded yet. Add your first expense to see spending trends."
- **All expenses reimbursed** (compounding chart): Show chart at $0 with note: "All expenses have been reimbursed. Unreimbursed expenses generate compounding savings."

## Acceptance Criteria

### Functional

- [x] Bar chart shows monthly OOP spending for all expenses grouped by `datePaid` month
- [x] Bar chart defaults to last 12 months; "All" toggle shows full history
- [x] Months with no expenses appear as $0 bars (zero-filled)
- [x] Hovering a bar shows tooltip with month name, dollar amount, and expense count
- [x] Compounding chart shows a hero headline: `"You've earned $X by keeping your HSA invested"`
- [x] Compounding line shows cumulative investment gains over monthly intervals
- [x] Compounding uses 10% annual return compounded monthly (S&P 500 benchmark)
- [x] Partial reimbursements reduce the compounding principal from the exact reimbursement date
- [x] Compounding chart has All-Time / YTD toggle; YTD shows gains earned in current calendar year
- [x] Disclaimer footnote below compounding chart about hypothetical returns
- [x] Both charts update reactively when expenses or reimbursements are added/modified/deleted
- [x] Empty states shown when no data available

### Non-Functional

- [x] Charts render correctly at phone (375px), tablet (768px), and desktop (1280px) breakpoints
- [x] Charts support light and dark mode via shadcn theme CSS variables
- [x] `accessibilityLayer` enabled on all charts; chart regions have `aria-label`
- [x] Y-axis uses abbreviated currency for large values ($1.2K)
- [x] Compounding calculation covered by unit tests (`src/lib/compounding.test.ts`)
- [x] `bunx tsc --noEmit && bun run lint && bun run test` passes
- [x] `bun run build` succeeds

## New Files

| File | Purpose |
|------|---------|
| `convex/charts.ts` | New Convex query `getChartData` returning monthly spending + compounding raw data |
| `src/lib/compounding.ts` | Pure utility: compounding gains calculation with piecewise reimbursement tracking |
| `src/lib/compounding.test.ts` | Unit tests for compounding calculation |
| `src/components/dashboard/monthly-spending-chart.tsx` | Bar chart component for monthly OOP spending |
| `src/components/dashboard/compounding-savings-chart.tsx` | Line chart + hero number for compounding gains |

## Modified Files

| File | Change |
|------|--------|
| `src/components/dashboard/dashboard.tsx` | Add chart components below existing summary cards |
| `src/lib/currency.ts` | Add `formatCurrencyShort(cents)` helper for Y-axis labels |
| `src/lib/currency.test.ts` | Tests for new `formatCurrencyShort` function |

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Recharts bundle size (~100KB gzipped) increases initial load | Already using lazy loading for tab content; charts are on the default dashboard tab so they load eagerly, but the impact is acceptable for a personal app |
| Compounding calculation accuracy | Extensive unit tests with manual verification against known compound interest formulas |
| Reimbursement date timezone bug (existing: `new Date().toISOString()` in `convex/reimbursements.ts:20` uses UTC) | Minor impact on compounding (1 day off is negligible); can fix separately as a follow-up |

## Success Metrics

- User can see monthly spending trends at a glance
- User sees a concrete dollar amount showing the value of their HSA investment strategy
- Charts are responsive and accessible
- Real-time updates when data changes

## Sources & References

- GitHub Issue: [#14](https://github.com/trousyt/hsa-tracker/issues/14)
- shadcn/ui Chart docs: [ui.shadcn.com/docs/components/chart](https://ui.shadcn.com/docs/components/chart)
- Existing dashboard: `src/components/dashboard/dashboard.tsx`
- Existing summary query: `convex/expenses.ts:266` (`getSummary`)
- Currency utilities: `src/lib/currency.ts`
- Date utilities: `src/lib/dates.ts`
- Expense schema: `convex/schema.ts:18-39`
- Reimbursement schema: `convex/schema.ts:79-87`
- Learned pattern (currency formatting): `docs/solutions/logic-errors/currency-format-mismatch.md`
