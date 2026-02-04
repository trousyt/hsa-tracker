import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { FileText, Trash2, Image, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatFileSize } from "@/lib/compression"
import { DocumentViewer } from "./document-viewer"

interface DocumentGalleryProps {
  expenseId: Id<"expenses">
  documentIds: Id<"documents">[]
}

export function DocumentGallery({
  expenseId,
  documentIds,
}: DocumentGalleryProps) {
  const documents = useQuery(api.documents.getMany, { ids: documentIds })
  const removeFromExpense = useMutation(api.documents.removeFromExpense)

  // Store document ID for viewing (secure fetch happens in viewer)
  const [viewingDocument, setViewingDocument] = useState<{
    id: Id<"documents">
    filename: string
    mimeType: string
  } | null>(null)

  const [deletingDocumentId, setDeletingDocumentId] =
    useState<Id<"documents"> | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Loading state
  if (documents === undefined) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <Skeleton className="aspect-[4/3]" />
            <div className="p-2 border-t space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No documents attached
      </div>
    )
  }

  const handleDelete = async () => {
    if (!deletingDocumentId) return

    setIsDeleting(true)
    try {
      await removeFromExpense({
        expenseId,
        documentId: deletingDocumentId,
      })
      toast.success("Document deleted")
    } catch (error) {
      toast.error("Failed to delete document")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingDocumentId(null)
    }
  }

  // Get icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-12 w-12 text-muted-foreground" />
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-12 w-12 text-muted-foreground" />
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
      return <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
    }
    return <FileText className="h-12 w-12 text-muted-foreground" />
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {documents.map((doc) => {
          if (!doc) return null

          return (
            <div
              key={doc._id}
              className="group relative border rounded-lg overflow-hidden bg-muted/30"
            >
              {/* Thumbnail placeholder - click to view securely */}
              <button
                onClick={() =>
                  setViewingDocument({
                    id: doc._id,
                    filename: doc.originalFilename,
                    mimeType: doc.mimeType,
                  })
                }
                className="w-full aspect-[4/3] flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(doc.mimeType)}
              </button>

              {/* File info */}
              <div className="p-2 border-t">
                <p
                  className="text-xs font-medium truncate"
                  title={doc.originalFilename}
                >
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.sizeBytes)}
                </p>
              </div>

              {/* Hover actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7"
                  onClick={() => setDeletingDocumentId(doc._id)}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Document Viewer Dialog - fetches file securely */}
      <DocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingDocumentId}
        onOpenChange={(open) => !open && setDeletingDocumentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
