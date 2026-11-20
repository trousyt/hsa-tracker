import { Children, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@convex/_generated/dataModel"
import { DocumentGallery } from "./document-gallery"
import { DocumentViewer } from "./document-viewer"

const fixtureDocuments = [
  { _id: "doc-one", originalFilename: "one.png", mimeType: "image/png", sizeBytes: 100 },
  { _id: "doc-two", originalFilename: "two.pdf", mimeType: "application/pdf", sizeBytes: 200 },
]
const hooks = vi.hoisted(() => ({ setState: vi.fn(), useQuery: vi.fn() }))
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, hooks.setState],
  useRef: (initial: unknown) => ({ current: initial }),
}))
vi.mock("convex/react", () => ({
  useQuery: hooks.useQuery,
  useMutation: () => vi.fn(),
}))

/** Collect the returned elements without mounting UI primitives or simulating a DOM. */
function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return []
    return [child, ...elements(child.props.children)]
  })
}

// Bounded production callback wiring test: hook stubs expose state requests only.
// This cannot establish browser focus, Radix nesting, or lifecycle execution order.
describe("DocumentGallery viewer origin", () => {
  beforeEach(() => {
    hooks.setState.mockClear()
    hooks.useQuery.mockReturnValue(fixtureDocuments)
  })

  it("retains the exact clicked document button through close and updates it for another document", () => {
    const tree = elements(DocumentGallery({
      expenseId: "expense-fixture" as Id<"expenses">,
      documentIds: ["doc-one", "doc-two"] as Id<"documents">[],
    }))
    const triggers = tree.filter((element) => element.type === "button") as ReactElement<ComponentProps<"button">>[]
    const viewer = tree.find((element) => element.type === DocumentViewer) as ReactElement<ComponentProps<typeof DocumentViewer>>
    expect(triggers).toHaveLength(2)
    expect(viewer.props.returnFocusRef.current).toBeNull()
    const region = tree[0] as ReactElement<ComponentProps<"div">>
    expect(region.props.role).toBe("region")
    expect(region.props["aria-label"]).toBe("Expense documents")
    expect(region.props.tabIndex).toBe(-1)
    expect(region.props.ref).toBe(viewer.props.fallbackFocusRef)

    const firstTrigger = { focus: vi.fn() } as unknown as HTMLButtonElement
    triggers[0].props.onClick?.({ currentTarget: firstTrigger } as MouseEvent<HTMLButtonElement>)
    expect(viewer.props.returnFocusRef.current).toBe(firstTrigger)
    expect(hooks.setState).toHaveBeenLastCalledWith({
      id: "doc-one", filename: "one.png", mimeType: "image/png",
    })

    viewer.props.onClose()
    expect(hooks.setState).toHaveBeenLastCalledWith(null)
    expect(viewer.props.returnFocusRef.current).toBe(firstTrigger)
    expect(firstTrigger.focus).not.toHaveBeenCalled()

    const secondTrigger = { focus: vi.fn() } as unknown as HTMLButtonElement
    triggers[1].props.onClick?.({ currentTarget: secondTrigger } as MouseEvent<HTMLButtonElement>)
    expect(viewer.props.returnFocusRef.current).toBe(secondTrigger)
    expect(hooks.setState).toHaveBeenLastCalledWith({
      id: "doc-two", filename: "two.pdf", mimeType: "application/pdf",
    })
  })

  it.each([
    ["loading", undefined],
    ["empty", []],
  ])("keeps a named focusable fallback region when documents are %s", (_state, documents) => {
    hooks.useQuery.mockReturnValue(documents)
    const tree = elements(DocumentGallery({
      expenseId: "expense-fixture" as Id<"expenses">,
      documentIds: [],
    }))
    const region = tree[0] as ReactElement<ComponentProps<"div">>
    expect(region.type).toBe("div")
    expect(region.props.role).toBe("region")
    expect(region.props["aria-label"]).toBe("Expense documents")
    expect(region.props.tabIndex).toBe(-1)
    expect(region.props.ref).toEqual({ current: null })
    expect(region.props.className).toContain("focus-visible:outline")
  })
})
