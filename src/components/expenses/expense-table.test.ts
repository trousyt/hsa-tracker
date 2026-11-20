import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ExpenseTable } from "./expense-table"

vi.mock("convex/react", () => ({ useQuery: () => [] }))
vi.mock("react-dropzone", () => ({
  useDropzone: () => ({ getRootProps: () => ({}), isDragActive: false }),
}))

// Render production table/columns and Radix controls, without a backend or DOM.
// Live checks must still verify the accessibility tree and keyboard interaction.
describe("ExpenseTable accessibility", () => {
  it("names the desktop status and category filters independently of selected values", () => {
    const html = renderToStaticMarkup(createElement(ExpenseTable))
    const filters = html.match(/<button\b[^>]*role="combobox"[^>]*>/g) ?? []
    expect(filters).toHaveLength(2)
    expect(filters[0]).toContain('aria-label="Filter by status"')
    expect(filters[1]).toContain('aria-label="Filter by category"')
  })

  it("gives the actions column an accessible header without changing the compact layout", () => {
    const html = renderToStaticMarkup(createElement(ExpenseTable))
    const headers = html.match(/<th\b[^>]*>[\s\S]*?<\/th>/g) ?? []
    expect(headers).toHaveLength(7)
    expect(headers[6]).toContain('<span class="sr-only">Actions</span>')
  })
})
