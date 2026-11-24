/// <reference types="node" />
// @vitest-environment node
import { cloneElement, createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Clock } from "lucide-react"
import { MonthlySpendingChart } from "./monthly-spending-chart"
import { CompoundingSavingsChart } from "./compounding-savings-chart"
import { SummaryCard } from "./summary-card"

// Only supply layout dimensions unavailable during SSR. Keep the actual charts,
// accessibility layer, SVG, ChartContainer and controls in the regression path.
vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 640, height: 200 }),
}))

const appCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8")
const paletteCss = readFileSync(new URL("../../../node_modules/tailwindcss/theme.css", import.meta.url), "utf8")

/** Resolve the actual neutral theme tokens or Tailwind palette used by rendered text. */
function color(name: string, dark: boolean): number[] {
  const theme = appCss.split(dark ? ".dark {" : ":root {")[1].split("}")[0]
  const value = (theme + paletteCss).match(new RegExp(`--${name}: oklch\\(([^)]+)\\)`))?.[1]
  if (!value) throw new Error(`Missing color ${name}`)
  const [l, c, h] = value.split(/\s+/).map((part) => part.endsWith("%") ? parseFloat(part) / 100 : Number(part))
  const a = c * Math.cos(h * Math.PI / 180)
  const b = c * Math.sin(h * Math.PI / 180)
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((channel) => Math.max(0, Math.min(1, channel)))
}

function contrast(foreground: string, background: string, dark: boolean) {
  const luminance = (name: string) => color(name, dark).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0)
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function textColor(classes: string, dark: boolean): string {
  const tokens = classes.split(" ")
  const token = (dark && tokens.find((token) => token.startsWith("dark:text-"))) ||
    tokens.find((token) => /^text-(foreground|muted-foreground|primary-foreground|yellow-\d+)$/.test(token))
  if (!token) throw new Error(`Missing text color in ${classes}`)
  const name = token.replace(/^(dark:)?text-/, "")
  return /^yellow-/.test(name) ? `color-${name}` : name
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-19T12:00:00Z"))
})
afterAll(() => vi.useRealTimers())

const datePaid = "2026-11-01"
const fixtures = [
  ["MonthlySpendingChart", "Out-of-pocket medical spending bar chart", () => renderToStaticMarkup(createElement(MonthlySpendingChart, {
    data: [{ month: datePaid.slice(0, 7), totalCents: 12000, expenseCount: 1 }],
    range: "6mo", onRangeChange: vi.fn(), onToggleExpand: vi.fn(),
  }))],
  ["CompoundingSavingsChart", "Compounding savings all area chart", () => renderToStaticMarkup(createElement(CompoundingSavingsChart, {
    data: [{ datePaid, amountCents: 12000, reimbursements: [] }],
    range: "all", onRangeChange: vi.fn(), onToggleExpand: vi.fn(),
  }))],
] as const

for (const [name, label, render] of fixtures) {
  describe(name, () => {
    it("names the keyboard-accessible chart SVG rather than a generic wrapper", () => {
      const html = render()
      const svg = html.match(/<svg[^>]*role="application"[^>]*>/)?.[0]
      expect(svg).toBeDefined()
      expect(svg).toContain(`aria-label="${label}"`)
      expect(svg).toContain('tabindex="0"')
      expect(html.match(new RegExp(`aria-label="${label}"`, "g"))).toHaveLength(1)
      expect(html.match(/<div[^>]*data-slot="chart"[^>]*>/)?.[0]).not.toContain("aria-label")
      expect(html).not.toContain('role="img"')
    })

    it.each([false, true])("keeps all desktop and phone range labels above 4.5:1 contrast (dark=%s)", (dark) => {
      const buttons = [...render().matchAll(/<button[^>]*class="([^"]+)"[^>]*aria-pressed="(true|false)"/g)]
      expect(buttons).toHaveLength(10)
      for (const [, classes, pressed] of buttons) {
        const background = pressed === "true" ? "primary" : "muted"
        expect(contrast(textColor(classes, dark), background, dark)).toBeGreaterThanOrEqual(4.5)
        // The inactive hover background is muted/80 over the card.
        if (pressed === "false") expect(contrast(textColor(classes, dark), "card", dark)).toBeGreaterThanOrEqual(4.5)
      }
    })
  })
}

describe("SummaryCard", () => {
  it.each([false, true])("keeps the warning value above 4.5:1 contrast (dark=%s)", (dark) => {
    const html = renderToStaticMarkup(createElement(SummaryCard, { title: "Unreimbursed", value: "$120.00", icon: Clock, variant: "warning" }))
    const classes = html.match(/<div class="([^"]+)">\$120\.00<\/div>/)?.[1]
    expect(classes).toBeDefined()
    expect(contrast(textColor(classes!, dark), "card", dark)).toBeGreaterThanOrEqual(4.5)
  })
})
