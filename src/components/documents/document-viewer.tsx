import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FileText, Download, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSecureFileUrl } from "@/lib/secure-file"
import { toast } from "sonner"
import type { Id } from "../../../convex/_generated/dataModel"

interface DocumentViewerProps {
  document: {
    id: Id<"documents">
    filename: string
    mimeType: string
  } | null
  onClose: () => void
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const { getFileUrl, downloadFile } = useSecureFileUrl()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Fetch file securely when document changes
  useEffect(() => {
    if (!document) {
      setBlobUrl(null)
      setError(null)
      return
    }

    let cancelled = false
    let url: string | null = null

    const fetchFile = async () => {
      setLoading(true)
      setError(null)

      try {
        const fetchedUrl = await getFileUrl(document.id)
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
          setError(err instanceof Error ? err.message : "Failed to load file")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchFile()

    // Cleanup: revoke blob URL when component unmounts or document changes
    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [document, getFileUrl, retryCount])

  if (!document) return null

  const isImage = document.mimeType.startsWith("image/")
  const isPdf = document.mimeType === "application/pdf"

  const handleDownload = async () => {
    try {
      await downloadFile(document.id, document.filename)
      toast.success("Download started")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed")
    }
  }

  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{document.filename}</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
          <h3 className="font-medium truncate flex-1">{document.filename}</h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30 min-h-[400px] max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Loading document...
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-medium">
                Failed to load document
              </p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <>
              {isImage && (
                <img
                  src={blobUrl}
                  alt={document.filename}
                  className="max-w-full h-auto mx-auto rounded"
                />
              )}
              {isPdf && (
                <iframe
                  src={blobUrl}
                  title={document.filename}
                  className="w-full h-[70vh] rounded border"
                />
              )}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Preview not available for this file type.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleDownload}
                  >
                    Download file
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
