import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FileText, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DocumentViewerProps {
  document: {
    url: string
    filename: string
    mimeType: string
  } | null
  onClose: () => void
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  if (!document) return null

  const isImage = document.mimeType.startsWith("image/")
  const isPdf = document.mimeType === "application/pdf"

  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{document.filename}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium truncate max-w-[60%]">{document.filename}</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(document.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={document.url} download={document.filename}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30 min-h-[400px] max-h-[calc(90vh-80px)]">
          {isImage && (
            <img
              src={document.url}
              alt={document.filename}
              className="max-w-full h-auto mx-auto rounded"
            />
          )}
          {isPdf && (
            <iframe
              src={document.url}
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
                onClick={() => window.open(document.url, "_blank")}
              >
                Open file
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
