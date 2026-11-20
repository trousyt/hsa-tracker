import { createElement, type ComponentProps, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@convex/_generated/dataModel"
import type { Dialog, DialogContent } from "@/components/ui/dialog"
import { DocumentViewer } from "./document-viewer"

const dialog = vi.hoisted(() => ({
  root: null as ComponentProps<typeof Dialog> | null,
  content: null as ComponentProps<typeof DialogContent> | null,
}))
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (props: ComponentProps<typeof Dialog>) => {
    dialog.root = props
    return props.children
  },
  DialogContent: (props: ComponentProps<typeof DialogContent>) => {
    dialog.content = props
    return props.children
  },
  DialogTitle: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/lib/secure-file", () => ({
  useSecureFileUrl: () => ({ getFileUrl: vi.fn(), downloadFile: vi.fn() }),
}))

const document = {
  id: "document-fixture" as Id<"documents">,
  filename: "receipt.png",
  mimeType: "image/png",
}

// Exercise production lifecycle callbacks, not Radix's DOM focus implementation.
// The nested Sheet + viewer Escape/Tab loop must also be checked in a real browser.
describe("DocumentViewer close focus", () => {
  beforeEach(() => {
    dialog.root = null
    dialog.content = null
  })

  it("restores the originating trigger during close autofocus, not during the close request", () => {
    const focus = vi.fn()
    const trigger = { isConnected: true, focus } as unknown as HTMLButtonElement
    const returnFocusRef = { current: trigger as HTMLButtonElement | null }
    const onClose = vi.fn()
    renderToStaticMarkup(createElement(DocumentViewer, { document, onClose, returnFocusRef }))

    dialog.root?.onOpenChange?.(false)
    expect(onClose).toHaveBeenCalledOnce()
    expect(focus).not.toHaveBeenCalled()

    // The gallery clears the selected document before Radix runs close autofocus.
    renderToStaticMarkup(createElement(DocumentViewer, { document: null, onClose, returnFocusRef }))
    const event = new Event("closeAutoFocus", { cancelable: true })
    expect(dialog.content?.onCloseAutoFocus).toBeTypeOf("function")
    dialog.content?.onCloseAutoFocus?.(event)
    expect(event.defaultPrevented).toBe(true)
    expect(focus).toHaveBeenCalledOnce()
  })

  it.each(["disconnected", "missing"])("does not focus a %s trigger", (state) => {
    const focus = vi.fn()
    const returnFocusRef = {
      current: state === "missing" ? null : { isConnected: false, focus } as unknown as HTMLButtonElement,
    }
    renderToStaticMarkup(createElement(DocumentViewer, { document, onClose: vi.fn(), returnFocusRef }))
    const event = new Event("closeAutoFocus", { cancelable: true })
    expect(dialog.content?.onCloseAutoFocus).toBeTypeOf("function")
    dialog.content?.onCloseAutoFocus?.(event)
    expect(focus).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
