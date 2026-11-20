import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import App from "./App"

vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }) }))
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn() }) }))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))

// Static shell fixtures verify landmarks around all selected tabs, not browser
// focus, lazy content execution, or authenticated backend behavior.
describe("AuthenticatedApp", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each(["dashboard", "expenses", "optimizer"])("contains the %s shell in exactly one main landmark", (tab) => {
    vi.stubGlobal("__APP_VERSION__", "test")
    vi.stubGlobal("window", { location: { search: `?tab=${tab}` } })
    const html = renderToStaticMarkup(createElement(App))
    expect(html.match(/<main[ >]/g)).toHaveLength(1)
    const main = html.match(/<main[\s\S]*<\/main>/)?.[0]
    expect(main).toContain("HSA")
    expect(main).toContain("Sign out")
    expect(main).toContain('role="tablist"')
    expect(main).toContain('role="tabpanel"')
    expect(main).toContain(`aria-controls="`)
    expect(main).toContain('role="alert"')
    expect(main).toContain('role="status"')
  })
})
