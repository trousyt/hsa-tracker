import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchSecureFile, getSecureFileUrl } from "./secure-file"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_URL", "https://test-deployment.convex.cloud")
})

describe("getSecureFileUrl", () => {
  it("uses the site endpoint without credentials in the URL", () => {
    expect(getSecureFileUrl("document123")).toBe(
      "https://test-deployment.convex.site/api/files/document123",
    )
  })
})

describe("fetchSecureFile", () => {
  it("rejects an absent token before fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(fetchSecureFile("document123", null)).rejects.toThrow("Not authenticated")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [401, "Authentication required"],
    [403, "Access denied"],
    [404, "File not found"],
    [500, "Failed to fetch file: 500"],
  ])("reports HTTP %i without creating a blob URL", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })))
    const createObjectURL = vi.spyOn(URL, "createObjectURL")
    await expect(fetchSecureFile("document123", "test-token")).rejects.toThrow(message)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("fetches bytes with the bearer header and returns a blob URL for preview or download", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("receipt", {
      headers: { "Content-Type": "application/pdf" },
    }))
    vi.stubGlobal("fetch", fetchMock)
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-receipt")
    expect(await fetchSecureFile("document123", "test-token")).toBe("blob:test-receipt")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test-deployment.convex.site/api/files/document123",
      { method: "GET", headers: { Authorization: "Bearer test-token" } },
    )
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("application/pdf")
    expect(await blob.text()).toBe("receipt")
  })

  it("preserves network failures rather than misclassifying them as session expiry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")))
    await expect(fetchSecureFile("document123", "test-token")).rejects.toThrow("Network unavailable")
  })
})
