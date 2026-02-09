import { useState, useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery } from "convex/react"
import { useDropzone } from "react-dropzone"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { Sparkles, Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ExpenseForm } from "./expense-form"
import { dollarsToCents, centsToDollars } from "@/lib/currency"
import { useSecureFile } from "@/lib/secure-file"
import type { ExpenseFormData } from "@/lib/validations/expense"
import { cn } from "@/lib/utils"
import { parseLocalDate, formatLocalDate } from "@/lib/dates"
import {
  compressImage,
  isValidFileType,
  isValidFileSize,
} from "@/lib/compression"

/** Fields that support OCR comparison */
type OcrFieldKey = "amount" | "datePaid" | "provider"
type FieldSource = "ocr" | "original"
type OcrFieldSelections = Record<OcrFieldKey, FieldSource>

interface OcrExtractedData {
  amount?: { valueCents: number; confidence: number }
  date?: { value: string; confidence: number }
  provider?: { value: string; confidence: number }
}

interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: {
    _id: Id<"expenses">
    datePaid: string
    provider: string
    amountCents: number
    comment?: string
    category?: string | null
  }
  ocrData?: OcrExtractedData
  /** Document that provided the OCR data (for thumbnail display) */
  ocrDocument?: {
    _id: Id<"documents">
    originalFilename: string
    mimeType: string
  }
}

type UploadStatus = "idle" | "compressing" | "uploading" | "saving" | "done" | "error"
type OcrStatus = "idle" | "pending" | "processing" | "completed" | "failed"

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  ocrData,
  ocrDocument,
}: ExpenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedDocumentId, setUploadedDocumentId] = useState<Id<"documents"> | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)
  const [uploadedMimeType, setUploadedMimeType] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [localOcrData, setLocalOcrData] = useState<OcrExtractedData | null>(null)

  // Field selection state - lives at dialog level to survive form remounts
  const [fieldSelections, setFieldSelections] = useState<OcrFieldSelections>(() => ({
    amount: "ocr",
    datePaid: "ocr",
    provider: "ocr",
  }))



  const createExpense = useMutation(api.expenses.create)
  const updateExpense = useMutation(api.expenses.update)
  const acknowledgeOcr = useMutation(api.expenses.acknowledgeOcr)
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const saveDocument = useMutation(api.documents.save)
  const addToExpense = useMutation(api.documents.addToExpense)
  const removeDocument = useMutation(api.documents.remove)

  // Track successful submission to avoid cleaning up documents that were attached
  const submittedSuccessfully = useRef(false)

  // Watch uploaded document for OCR completion
  const uploadedDocument = useQuery(
    api.documents.get,
    uploadedDocumentId ? { id: uploadedDocumentId } : "skip"
  )

  const isEditing = !!expense

  // Cleanup orphaned document when dialog closes without successful submission
  const cleanupOrphanedDocument = useCallback(async () => {
    if (!isEditing && uploadedDocumentId && !submittedSuccessfully.current) {
      try {
        await removeDocument({ id: uploadedDocumentId })
      } catch (error) {
        console.warn("Failed to cleanup orphaned document:", error)
      }
    }
  }, [isEditing, uploadedDocumentId, removeDocument])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      submittedSuccessfully.current = false
    } else {
      cleanupOrphanedDocument()
      setUploadedDocumentId(null)
      setUploadStatus("idle")
      setUploadProgress(0)
      setUploadError(null)
      setUploadedFilename(null)
      setUploadedMimeType(null)
      setLocalOcrData(null)
      setFormKey((k) => k + 1)
      // Reset field selections for next open
      setFieldSelections({ amount: "ocr", datePaid: "ocr", provider: "ocr" })
    }
  }, [open, cleanupOrphanedDocument])

  // Watch for OCR completion and update form
  useEffect(() => {
    if (uploadedDocument?.ocrStatus === "completed" && uploadedDocument.ocrExtractedData) {
      // Don't update form if submission is in progress (race condition prevention)
      if (isSubmitting) return
      setLocalOcrData(uploadedDocument.ocrExtractedData)
      setFormKey((k) => k + 1) // Force form re-render with new defaults
      toast.success("Receipt data extracted!")
    } else if (uploadedDocument?.ocrStatus === "failed") {
      toast.error("Couldn't extract data from receipt", {
        description: uploadedDocument.ocrError || "Please enter details manually",
      })
    }
  }, [uploadedDocument?.ocrStatus, uploadedDocument?.ocrExtractedData, uploadedDocument?.ocrError, isSubmitting])

  const ocrStatusFromDoc: OcrStatus = uploadedDocument?.ocrStatus ?? "idle"

  const uploadFile = useCallback(async (file: File) => {
    try {
      // Validate file
      if (!isValidFileType(file)) {
        throw new Error("Invalid file type. Please upload an image or PDF.")
      }
      if (!isValidFileSize(file)) {
        throw new Error("File too large. Maximum size is 10MB.")
      }

      setUploadedFilename(file.name)
      setUploadedMimeType(file.type)
      setUploadError(null)

      // Compress image
      setUploadStatus("compressing")
      setUploadProgress(10)
      const compressedFile = await compressImage(file)

      // Get upload URL
      setUploadStatus("uploading")
      setUploadProgress(30)
      const uploadUrl = await generateUploadUrl()

      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": compressedFile.type },
        body: compressedFile,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const { storageId } = await response.json()
      setUploadProgress(70)

      // Save document record (triggers OCR)
      setUploadStatus("saving")
      setUploadProgress(90)
      const documentId = await saveDocument({
        storageId,
        originalFilename: file.name,
        mimeType: compressedFile.type,
        sizeBytes: compressedFile.size,
      })

      setUploadedDocumentId(documentId)
      setUploadStatus("done")
      setUploadProgress(100)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed"
      setUploadStatus("error")
      setUploadError(message)
      toast.error(message)
    }
  }, [generateUploadUrl, saveDocument])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0])
    }
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: uploadStatus !== "idle" && uploadStatus !== "error",
  })

  const handleSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true)
    try {
      if (isEditing && expense) {
        await updateExpense({
          id: expense._id,
          datePaid: formatLocalDate(data.datePaid),
          provider: data.provider,
          amountCents: dollarsToCents(data.amount),
          comment: data.comment || undefined,
          category: data.category ?? null,
        })
        // Mark OCR as acknowledged when applying data via "Apply Data" button
        if (ocrData) {
          await acknowledgeOcr({ id: expense._id })
        }
        toast.success("Expense updated successfully")
      } else {
        const expenseId = await createExpense({
          datePaid: formatLocalDate(data.datePaid),
          provider: data.provider,
          amountCents: dollarsToCents(data.amount),
          comment: data.comment || undefined,
          category: data.category || undefined,
        })
        // Attach uploaded document to the new expense
        if (uploadedDocumentId) {
          await addToExpense({ expenseId, documentId: uploadedDocumentId })
        }
        submittedSuccessfully.current = true
        toast.success("Expense created successfully")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEditing ? "Failed to update expense" : "Failed to create expense")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine which OCR data to use: local (from upload) or prop (from "Apply Data")
  const effectiveOcrData = localOcrData ?? ocrData

  // OCR values for comparison (only when editing with OCR data)
  const ocrValues = effectiveOcrData && expense
    ? {
        datePaid: effectiveOcrData.date?.value ? parseLocalDate(effectiveOcrData.date.value) : undefined,
        provider: effectiveOcrData.provider?.value,
        amount: effectiveOcrData.amount?.valueCents
          ? centsToDollars(effectiveOcrData.amount.valueCents)
          : undefined,
      }
    : undefined

  // Original expense values for comparison
  const originalValues = expense
    ? {
        datePaid: parseLocalDate(expense.datePaid),
        provider: expense.provider,
        amount: centsToDollars(expense.amountCents),
      }
    : undefined

  // Build default values: OCR data overrides expense data when both present
  const defaultValues = expense
    ? {
        datePaid: effectiveOcrData?.date?.value
          ? parseLocalDate(effectiveOcrData.date.value)
          : parseLocalDate(expense.datePaid),
        provider: effectiveOcrData?.provider?.value ?? expense.provider,
        amount: effectiveOcrData?.amount?.valueCents
          ? centsToDollars(effectiveOcrData.amount.valueCents)
          : centsToDollars(expense.amountCents),
        comment: expense.comment,
        category: expense.category,
      }
    : effectiveOcrData
      ? {
          datePaid: effectiveOcrData.date?.value ? parseLocalDate(effectiveOcrData.date.value) : new Date(),
          provider: effectiveOcrData.provider?.value ?? "",
          amount: effectiveOcrData.amount?.valueCents ? centsToDollars(effectiveOcrData.amount.valueCents) : undefined,
          comment: "",
        }
      : undefined

  // Handler for field selection changes - idempotent pattern
  const handleFieldSelectionChange = useCallback(
    (field: OcrFieldKey, source: FieldSource) => {
      setFieldSelections((prev) => ({ ...prev, [field]: source }))
    },
    []
  )

  // Determine which document to show in preview (prop or uploaded)
  const previewDocument = ocrDocument
    ? {
        id: ocrDocument._id as string,
        filename: ocrDocument.originalFilename,
        mimeType: ocrDocument.mimeType,
      }
    : uploadedDocumentId && uploadedFilename && uploadedMimeType
      ? {
          id: uploadedDocumentId as string,
          filename: uploadedFilename,
          mimeType: uploadedMimeType,
        }
      : null

  // Show inline preview when we have a document (during editing with OCR data)
  const showPreview = isEditing && effectiveOcrData && previewDocument

  // Fetch secure blob URL for inline preview
  const { blobUrl: previewBlobUrl, loading: previewLoading } = useSecureFile(
    showPreview ? previewDocument?.id ?? null : null
  )

  const isImage = previewDocument?.mimeType.startsWith("image/") ?? false
  const isPdf = previewDocument?.mimeType === "application/pdf"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden max-h-[90vh]",
          showPreview ? "sm:max-w-5xl" : "sm:max-w-[425px]"
        )}
        onOpenAutoFocus={(e) => {
          if (showPreview) {
            // Focus the first form field instead of the preview panel
            e.preventDefault()
            setTimeout(() => {
              const firstInput = document.querySelector<HTMLElement>(
                "[data-slot='dialog-content'] form input, [data-slot='dialog-content'] form button"
              )
              firstInput?.focus()
            }, 0)
          }
        }}
      >
        {!showPreview && (
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>
              {isEditing ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>
        )}

        <div className={cn(
          "flex flex-col overflow-y-auto",
          showPreview && "md:flex-row md:min-h-[500px] md:overflow-y-hidden"
        )}>
          {/* Left Panel: Document Preview (60%) */}
          {showPreview && (
            <>
              {/* Skip link for keyboard users to bypass the PDF iframe */}
              <a
                href="#expense-form-panel"
                className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:border focus:rounded focus:m-2"
              >
                Skip to expense form
              </a>
              <div
                role="region"
                aria-label="Document preview"
                className="border-b md:border-b-0 md:border-r bg-muted/30 h-[40vh] md:h-auto md:w-3/5 overflow-auto"
              >
                {previewLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : previewBlobUrl ? (
                  isImage ? (
                    <img
                      src={previewBlobUrl}
                      alt={previewDocument?.filename ?? "Receipt"}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : isPdf ? (
                    <iframe
                      src={previewBlobUrl}
                      title={previewDocument?.filename ?? "Receipt"}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2" />
                      <p className="text-sm">No preview for this file type</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileText className="h-12 w-12 mb-2" />
                    <p className="text-sm">Preview unavailable</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Right Panel: Form (40% when preview, full-width otherwise) */}
          <div
            id="expense-form-panel"
            role="region"
            aria-label="Expense details form"
            className={cn(
              "p-6 overflow-y-auto",
              showPreview ? "md:w-2/5 md:max-h-[80vh]" : "w-full"
            )}
          >
            {/* Dialog title inside form panel for two-panel mode */}
            {showPreview && (
              <DialogHeader className="pb-4">
                <DialogTitle>Edit Expense</DialogTitle>
              </DialogHeader>
            )}

            {/* OCR Banner - when editing with OCR data from "Apply Data" */}
            {effectiveOcrData && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-sm">
                  Receipt data pre-filled. Review and edit as needed.
                </p>
              </div>
            )}

            {/* File Upload - only for new expenses */}
            {!isEditing && (
              <div className="mb-4">
                {uploadStatus === "idle" || uploadStatus === "error" ? (
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50",
                      uploadStatus === "error" && "border-destructive/50"
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                    {isDragActive ? (
                      <p className="text-sm text-primary">Drop receipt here...</p>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Drop receipt here, or click to select
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          We'll extract the details automatically
                        </p>
                      </div>
                    )}
                    {uploadStatus === "error" && uploadError && (
                      <p className="text-xs text-destructive mt-2">{uploadError}</p>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      {uploadedFilename?.match(/\.(jpe?g|png|webp|heic)$/i) ? (
                        <Image className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFilename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {uploadStatus === "compressing" && "Compressing..."}
                          {uploadStatus === "uploading" && "Uploading..."}
                          {uploadStatus === "saving" && "Saving..."}
                          {uploadStatus === "done" && ocrStatusFromDoc === "pending" && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Scanning receipt...
                            </>
                          )}
                          {uploadStatus === "done" && ocrStatusFromDoc === "processing" && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Extracting data...
                            </>
                          )}
                          {uploadStatus === "done" && ocrStatusFromDoc === "completed" && (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              <span className="text-green-600">Data extracted</span>
                            </>
                          )}
                          {uploadStatus === "done" && ocrStatusFromDoc === "failed" && (
                            <>
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              <span className="text-amber-600">Couldn't extract data</span>
                            </>
                          )}
                        </div>
                        {uploadStatus !== "done" && (
                          <Progress value={uploadProgress} className="h-1 mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <ExpenseForm
              key={formKey}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              isSubmitting={isSubmitting}
              ocrValues={ocrValues}
              originalValues={originalValues}
              ocrSelections={effectiveOcrData ? fieldSelections : undefined}
              onOcrSelectionChange={effectiveOcrData ? handleFieldSelectionChange : undefined}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
