import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Upload, X, FileText, Image } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  compressImage,
  isValidFileType,
  isValidFileSize,
  formatFileSize,
} from "@/lib/compression"

interface FileUploaderProps {
  expenseId: Id<"expenses">
  onUploadComplete?: (documentId: Id<"documents">) => void
}

interface UploadingFile {
  file: File
  progress: number
  status: "compressing" | "uploading" | "saving" | "done" | "error"
  error?: string
}

export function FileUploader({ expenseId, onUploadComplete }: FileUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const saveDocument = useMutation(api.documents.save)
  const addToExpense = useMutation(api.documents.addToExpense)

  const updateFileProgress = (
    index: number,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles((files) =>
      files.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  }

  const uploadFile = async (file: File, index: number) => {
    try {
      // Validate file
      if (!isValidFileType(file)) {
        throw new Error("Invalid file type. Please upload an image or PDF.")
      }
      if (!isValidFileSize(file)) {
        throw new Error("File too large. Maximum size is 10MB.")
      }

      // Compress image
      updateFileProgress(index, { status: "compressing", progress: 10 })
      const compressedFile = await compressImage(file)

      // Get upload URL
      updateFileProgress(index, { status: "uploading", progress: 30 })
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
      updateFileProgress(index, { progress: 70 })

      // Save document record
      updateFileProgress(index, { status: "saving", progress: 80 })
      const documentId = await saveDocument({
        storageId,
        originalFilename: file.name,
        mimeType: compressedFile.type,
        sizeBytes: compressedFile.size,
      })

      // Add to expense
      await addToExpense({ expenseId, documentId })

      updateFileProgress(index, { status: "done", progress: 100 })
      onUploadComplete?.(documentId)
      toast.success(`Uploaded ${file.name}`)

      // Remove from list after a delay
      setTimeout(() => {
        setUploadingFiles((files) => files.filter((_, i) => i !== index))
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed"
      updateFileProgress(index, { status: "error", error: message })
      toast.error(message)
    }
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "compressing" as const,
      }))

      setUploadingFiles((files) => [...files, ...newFiles])

      // Start uploads
      newFiles.forEach((_, index) => {
        const actualIndex = uploadingFiles.length + index
        uploadFile(acceptedFiles[index], actualIndex)
      })
    },
    [uploadingFiles.length]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const removeFile = (index: number) => {
    setUploadingFiles((files) => files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        {isDragActive ? (
          <p className="text-sm text-primary">Drop files here...</p>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPEG, PNG, PDF (max 10MB)
            </p>
          </div>
        )}
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              {item.file.type.startsWith("image/") ? (
                <Image className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                  {item.status === "compressing" && " • Compressing..."}
                  {item.status === "uploading" && " • Uploading..."}
                  {item.status === "saving" && " • Saving..."}
                  {item.status === "done" && " • Done!"}
                  {item.status === "error" && ` • ${item.error}`}
                </p>
                {item.status !== "done" && item.status !== "error" && (
                  <Progress value={item.progress} className="h-1 mt-1" />
                )}
              </div>

              {item.status === "error" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
