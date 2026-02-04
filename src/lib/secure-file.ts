import { useAuthToken } from "@convex-dev/auth/react"
import { useCallback, useEffect, useState } from "react"

/**
 * Get the base URL for the Convex HTTP API (site URL).
 * This is where HTTP actions are served from.
 */
function getConvexSiteUrl(): string {
  // VITE_CONVEX_URL is like https://xxx.convex.cloud
  // Site URL is the same but with .site instead of .cloud
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string
  return convexUrl.replace(".convex.cloud", ".convex.site")
}

/**
 * Construct the secure file URL for a document.
 * Files are served via authenticated HTTP action, not direct storage URLs.
 */
export function getSecureFileUrl(documentId: string): string {
  const siteUrl = getConvexSiteUrl()
  return `${siteUrl}/api/files/${documentId}`
}

/**
 * Fetch a file securely with authentication.
 * Returns a blob URL that can be used in img src, iframe src, etc.
 */
export async function fetchSecureFile(
  documentId: string,
  authToken: string | null
): Promise<string> {
  if (!authToken) {
    throw new Error("Not authenticated")
  }

  const url = getSecureFileUrl(documentId)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required")
    }
    if (response.status === 403) {
      throw new Error("Access denied")
    }
    if (response.status === 404) {
      throw new Error("File not found")
    }
    throw new Error(`Failed to fetch file: ${response.status}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

/**
 * Hook to fetch a secure file and manage its blob URL lifecycle.
 * Automatically revokes the blob URL on cleanup.
 */
export function useSecureFile(documentId: string | null) {
  const authToken = useAuthToken()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!documentId || !authToken) {
      setBlobUrl(null)
      return
    }

    let cancelled = false
    let url: string | null = null

    const fetchFile = async () => {
      setLoading(true)
      setError(null)

      try {
        const fetchedUrl = await fetchSecureFile(documentId, authToken)
        // Always track the URL for cleanup, even if cancelled
        url = fetchedUrl
        if (cancelled) {
          // Component unmounted while fetching - revoke immediately
          URL.revokeObjectURL(fetchedUrl)
        } else {
          setBlobUrl(fetchedUrl)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchFile()

    // Cleanup: revoke blob URL when component unmounts or documentId changes
    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [documentId, authToken])

  return { blobUrl, loading, error }
}

/**
 * Hook to get the auth token for manual file fetching.
 * Use this when you need more control over the fetch process.
 */
export function useSecureFileUrl() {
  const authToken = useAuthToken()

  const getFileUrl = useCallback(
    async (documentId: string): Promise<string> => {
      return fetchSecureFile(documentId, authToken)
    },
    [authToken]
  )

  const downloadFile = useCallback(
    async (documentId: string, filename: string) => {
      const blobUrl = await fetchSecureFile(documentId, authToken)

      // Create a temporary link and click it to trigger download
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl)
    },
    [authToken]
  )

  return { getFileUrl, downloadFile, authToken }
}
