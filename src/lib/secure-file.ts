import { useAuthToken } from "@convex-dev/auth/react"
import { useCallback, useEffect, useState } from "react"

/**
 * Derives the Convex site URL from the VITE_CONVEX_URL environment variable.
 *
 * Replaces the ".convex.cloud" domain suffix with ".convex.site".
 *
 * @returns The Convex site URL (VITE_CONVEX_URL with ".convex.cloud" replaced by ".convex.site")
 */
function getConvexSiteUrl(): string {
  // VITE_CONVEX_URL is like https://xxx.convex.cloud
  // Site URL is the same but with .site instead of .cloud
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string
  return convexUrl.replace(".convex.cloud", ".convex.site")
}

/**
 * Build the site-scoped API endpoint URL used to fetch a secure file for a document.
 *
 * @param documentId - The Convex document identifier for the file
 * @returns The full URL to the secure file endpoint for `documentId`
 */
export function getSecureFileUrl(documentId: string): string {
  const siteUrl = getConvexSiteUrl()
  return `${siteUrl}/api/files/${documentId}`
}

/**
 * Fetches a protected file using a Bearer token and exposes it as a blob URL.
 *
 * @param documentId - The identifier of the remote document to fetch.
 * @param authToken - The Bearer authentication token; must be non-null.
 * @returns A blob URL referencing the fetched file, suitable for use as an element `src` or for downloading.
 * @throws `Not authenticated` if `authToken` is null or undefined.
 * @throws `Authentication required` if the server responds with HTTP 401.
 * @throws `Access denied` if the server responds with HTTP 403.
 * @throws `File not found` if the server responds with HTTP 404.
 * @throws `Failed to fetch file: {status}` for other non-OK HTTP responses.
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
 * Fetches a secure file for a given document ID and manages its Blob URL lifecycle.
 *
 * @param documentId - The document ID to fetch; pass `null` to clear any loaded URL.
 * @returns An object with:
 *  - `blobUrl`: the Blob URL for the fetched file, or `null` if none is loaded.
 *  - `loading`: `true` while the file is being fetched, `false` otherwise.
 *  - `error`: an `Error` if the fetch failed, or `null` on success.
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
 * Provides helpers for obtaining and downloading secure file blob URLs using the current auth token.
 *
 * @returns An object with:
 * - `getFileUrl(documentId)`: asynchronously returns a blob URL string for the specified document.
 * - `downloadFile(documentId, filename)`: asynchronously fetches the document and triggers a download using `filename`.
 * - `authToken`: the current authentication token (or `null` if not authenticated).
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