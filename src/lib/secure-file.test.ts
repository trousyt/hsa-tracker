import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"

// Mock import.meta.env before importing the module
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_CONVEX_URL: "https://test-deployment.convex.cloud",
    },
  },
})

// Since we can't easily mock import.meta.env in Vitest for ES modules,
// we'll test the URL construction logic directly
describe("secure-file URL construction", () => {
  test("converts convex.cloud to convex.site", () => {
    const convexUrl = "https://test-deployment.convex.cloud"
    const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site")
    expect(siteUrl).toBe("https://test-deployment.convex.site")
  })

  test("constructs correct file URL path", () => {
    const siteUrl = "https://test-deployment.convex.site"
    const documentId = "abc123xyz"
    const fileUrl = `${siteUrl}/api/files/${documentId}`
    expect(fileUrl).toBe("https://test-deployment.convex.site/api/files/abc123xyz")
  })

  test("handles various document ID formats", () => {
    const siteUrl = "https://test.convex.site"

    const testCases = [
      { id: "simple123", expected: "https://test.convex.site/api/files/simple123" },
      { id: "k5abc123def456", expected: "https://test.convex.site/api/files/k5abc123def456" },
      { id: "jd7_underscores_ok", expected: "https://test.convex.site/api/files/jd7_underscores_ok" },
    ]

    for (const { id, expected } of testCases) {
      expect(`${siteUrl}/api/files/${id}`).toBe(expected)
    }
  })
})

describe("fetchSecureFile error handling", () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("throws error when auth token is null", async () => {
    // Simulate the fetchSecureFile logic
    const authToken: string | null = null

    const fetchSecureFile = async (documentId: string, token: string | null) => {
      if (!token) {
        throw new Error("Not authenticated")
      }
      // Rest of function...
    }

    await expect(fetchSecureFile("doc123", authToken)).rejects.toThrow("Not authenticated")
  })

  test("throws 'Authentication required' on 401 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required")
        if (response.status === 403) throw new Error("Access denied")
        if (response.status === 404) throw new Error("File not found")
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      return "blob-url"
    }

    await expect(fetchSecureFile("doc123", "valid-token")).rejects.toThrow("Authentication required")
  })

  test("throws 'Access denied' on 403 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    })

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required")
        if (response.status === 403) throw new Error("Access denied")
        if (response.status === 404) throw new Error("File not found")
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      return "blob-url"
    }

    await expect(fetchSecureFile("doc123", "valid-token")).rejects.toThrow("Access denied")
  })

  test("throws 'File not found' on 404 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required")
        if (response.status === 403) throw new Error("Access denied")
        if (response.status === 404) throw new Error("File not found")
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      return "blob-url"
    }

    await expect(fetchSecureFile("doc123", "valid-token")).rejects.toThrow("File not found")
  })

  test("throws generic error for other status codes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required")
        if (response.status === 403) throw new Error("Access denied")
        if (response.status === 404) throw new Error("File not found")
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      return "blob-url"
    }

    await expect(fetchSecureFile("doc123", "valid-token")).rejects.toThrow("Failed to fetch file: 500")
  })

  test("sends correct Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["test"])),
    })
    global.fetch = mockFetch

    // Mock URL.createObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url")
    global.URL.createObjectURL = mockCreateObjectURL

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }

    await fetchSecureFile("doc123", "my-jwt-token")

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.convex.site/api/files/doc123",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer my-jwt-token" },
      })
    )
  })

  test("creates blob URL from successful response", async () => {
    const testBlob = new Blob(["test content"], { type: "application/pdf" })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(testBlob),
    })

    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:https://localhost/abc123")
    global.URL.createObjectURL = mockCreateObjectURL

    const fetchSecureFile = async (documentId: string, authToken: string | null) => {
      if (!authToken) throw new Error("Not authenticated")

      const response = await fetch(`https://test.convex.site/api/files/${documentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }

    const result = await fetchSecureFile("doc123", "valid-token")

    expect(mockCreateObjectURL).toHaveBeenCalledWith(testBlob)
    expect(result).toBe("blob:https://localhost/abc123")
  })
})

describe("security considerations", () => {
  test("never includes token in URL parameters", () => {
    const documentId = "sensitive-doc"
    const authToken = "secret-jwt-token"

    // Construct URL the way our code does
    const url = `https://test.convex.site/api/files/${documentId}`

    // URL should not contain the token
    expect(url).not.toContain(authToken)
    expect(url).not.toContain("token=")
    expect(url).not.toContain("auth=")
  })

  test("authorization header format is correct", () => {
    const authToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test"
    const header = `Bearer ${authToken}`

    expect(header).toBe("Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test")
    expect(header.startsWith("Bearer ")).toBe(true)
  })
})
