import { useEffect, useState } from "react"
import { FileText, ArrowUpRight } from "lucide-react"
import { useSecureFileUrl } from "@/lib/secure-file"
import type { Id } from "../../../convex/_generated/dataModel"

interface DocumentThumbnailProps {
  documentId: Id<"documents">
  filename: string
  mimeType: string
  onClick: () => void
}

/**
 * Clickable thumbnail for reviewing a receipt document.
 * Shows image preview for images, file icon for PDFs.
 * Follows blob URL cleanup pattern from DocumentViewer.
 */
export function DocumentThumbnail({
  documentId,
  filename,
  mimeType,
  onClick,
}: DocumentThumbnailProps) {
  const { getFileUrl } = useSecureFileUrl()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const isImage = mimeType.startsWith("image/")

  // Fetch thumbnail URL with proper cleanup
  useEffect(() => {
    // Only fetch for images - PDFs show icon placeholder
    if (!isImage) return

    let cancelled = false
    let url: string | null = null

    const fetchThumbnail = async () => {
      try {
        const fetchedUrl = await getFileUrl(documentId)
        // Track URL BEFORE checking cancelled to prevent leaks
        url = fetchedUrl
        if (cancelled) {
          URL.revokeObjectURL(fetchedUrl)
        } else {
          setBlobUrl(fetchedUrl)
        }
      } catch (err) {
        // Silently fail - show icon placeholder instead
        console.warn("Failed to load thumbnail:", err)
      }
    }

    fetchThumbnail()

    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [documentId, getFileUrl, isImage])

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 w-full p-3 rounded-lg
                 bg-muted/30 hover:bg-muted/50 transition-colors text-left
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View receipt: ${filename}`}
    >
      <div className="relative w-12 h-16 rounded border bg-background overflow-hidden flex-shrink-0">
        {isImage && blobUrl ? (
          <img
            src={blobUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">Review receipt</p>
        <p className="text-xs text-muted-foreground">Click to expand</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
    </button>
  )
}
