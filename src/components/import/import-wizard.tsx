import { useState, useCallback, useMemo, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  Upload,
  FileText,
  Check,
  AlertTriangle,
  ArrowRight,
  X,
  Search,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import {
  parseCsvFile,
  matchPdfToExpense,
  type ParseResult,
  type MatchResult,
  type ImportExpense,
} from "@/lib/import-utils"
import { compressImage, isValidFileType, isValidFileSize } from "@/lib/compression"

interface ImportWizardProps {
  onClose: () => void
}

type WizardStep = "upload" | "match" | "complete"

interface ImportedExpense {
  rowIndex: number
  expenseId: Id<"expenses">
  date: string
  provider: string
  amountCents: number
}

interface PdfFile {
  file: File
  matchResult: MatchResult
  manualExpenseId?: Id<"expenses">
}

export function ImportWizard({ onClose }: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("upload")

  // Step 1: CSV Upload State
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // Step 2: PDF Matching State
  const [importedExpenses, setImportedExpenses] = useState<ImportedExpense[]>([])
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([])
  const [attachingPdfs, setAttachingPdfs] = useState(false)
  const [attachProgress, setAttachProgress] = useState(0)

  // Step 3: Complete State
  const [attachedCount, setAttachedCount] = useState(0)

  // Search state for dropdown filtering
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({})

  // Preview state for PDF/image viewing
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Create/revoke blob URL when preview file changes
  useEffect(() => {
    if (previewFile) {
      const url = URL.createObjectURL(previewFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [previewFile])

  // Helper to check if file is PDF (MIME type or extension fallback)
  const isPdf = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

  // Mutations
  const createBatchExpenses = useMutation(api.expenses.createBatch)
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const saveDocument = useMutation(api.documents.save)
  const addToExpense = useMutation(api.documents.addToExpense)

  // ============ Memoized Helpers ============

  // Track which expenses are already matched to prevent double-matching
  const usedExpenseIds = useMemo(() => {
    return new Set<Id<"expenses">>(
      pdfFiles
        .filter((pf) => pf.matchResult.matched)
        .map((pf) => pf.manualExpenseId || pf.matchResult.expenseId)
        .filter((id): id is Id<"expenses"> => id !== null)
    )
  }, [pdfFiles])

  // Get available expenses for manual selection (excludes already-matched ones)
  const getAvailableExpenses = useCallback(
    (currentExpenseId?: Id<"expenses">) => {
      return importedExpenses.filter(
        (exp) => exp.expenseId === currentExpenseId || !usedExpenseIds.has(exp.expenseId)
      )
    },
    [importedExpenses, usedExpenseIds]
  )

  // ============ Step 1: CSV Upload ============

  const onCsvDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file")
      return
    }

    try {
      const result = await parseCsvFile(file)
      setParseResult(result)

      if (result.rows.length === 0) {
        toast.error("No data found in CSV file")
      } else if (result.errorCount > 0) {
        toast.warning(`Found ${result.errorCount} rows with errors`)
      } else {
        toast.success(`Parsed ${result.validCount} valid rows`)
      }
    } catch (error) {
      toast.error("Failed to parse CSV file")
      console.error(error)
    }
  }, [])

  const {
    getRootProps: getCsvRootProps,
    getInputProps: getCsvInputProps,
    isDragActive: isCsvDragActive,
  } = useDropzone({
    onDrop: onCsvDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  })

  const handleImportAll = async () => {
    if (!parseResult) return

    const validRows = parseResult.rows.filter((r) => r.errors.length === 0)
    if (validRows.length === 0) {
      toast.error("No valid rows to import")
      return
    }

    setImporting(true)
    setImportProgress(0)

    try {
      // Batch insert all expenses in a single transaction
      const expenseIds = await createBatchExpenses({
        expenses: validRows.map((row) => ({
          datePaid: row.date!,
          provider: row.provider!,
          amountCents: row.amountCents!,
          comment: row.comment || undefined,
        })),
      })

      // Map results back to row data for PDF matching
      const imported: ImportedExpense[] = validRows.map((row, i) => ({
        rowIndex: row.rowIndex,
        expenseId: expenseIds[i],
        date: row.date!,
        provider: row.provider!,
        amountCents: row.amountCents!,
      }))

      setImportProgress(100)
      setImportedExpenses(imported)
      toast.success(`Imported ${imported.length} expenses`)
      setStep("match")
    } catch (error) {
      toast.error("Failed to import expenses")
      console.error("Batch import failed:", error)
    } finally {
      setImporting(false)
    }
  }

  // ============ Step 2: PDF Matching ============

  const onPdfDrop = useCallback(
    (acceptedFiles: File[]) => {
      const expenses: ImportExpense[] = importedExpenses.map((e) => ({
        _id: e.expenseId,
        datePaid: e.date,
        provider: e.provider,
        amountCents: e.amountCents,
      }))

      // Track which expenses are already used (existing matches + new auto-matches in this batch)
      const usedInBatch = new Set<Id<"expenses">>(
        pdfFiles
          .filter((pf) => pf.matchResult.matched)
          .map((pf) => pf.manualExpenseId || pf.matchResult.expenseId)
          .filter((id): id is Id<"expenses"> => id !== null)
      )

      const newPdfFiles: PdfFile[] = acceptedFiles.map((file) => {
        const matchResult = matchPdfToExpense(file.name, expenses)

        // Skip auto-match if expense already used
        if (matchResult.matched && matchResult.expenseId && usedInBatch.has(matchResult.expenseId)) {
          return { file, matchResult: { ...matchResult, matched: false, expenseId: null } }
        }

        // Mark this expense as used for subsequent files in this batch
        if (matchResult.matched && matchResult.expenseId) {
          usedInBatch.add(matchResult.expenseId)
        }

        return { file, matchResult }
      })

      setPdfFiles((prev) => [...prev, ...newPdfFiles])

      const matchedCount = newPdfFiles.filter((f) => f.matchResult.matched).length
      if (matchedCount > 0) {
        toast.success(`Auto-matched ${matchedCount} of ${newPdfFiles.length} files`)
      }
    },
    [importedExpenses, pdfFiles]
  )

  const {
    getRootProps: getPdfRootProps,
    getInputProps: getPdfInputProps,
    isDragActive: isPdfDragActive,
  } = useDropzone({
    onDrop: onPdfDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
    },
  })

  const updatePdfMatch = (index: number, expenseId: Id<"expenses"> | null) => {
    setPdfFiles((prev) =>
      prev.map((pf, i) =>
        i === index
          ? {
              ...pf,
              manualExpenseId: expenseId || undefined,
              matchResult: expenseId
                ? { ...pf.matchResult, matched: true, expenseId }
                : { ...pf.matchResult, matched: false, expenseId: null },
            }
          : pf
      )
    )
  }

  const removePdf = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAttachPdfs = async () => {
    const toAttach = pdfFiles.filter(
      (pf) => pf.matchResult.matched && (pf.matchResult.expenseId || pf.manualExpenseId)
    )

    if (toAttach.length === 0) {
      toast.error("No matched PDFs to attach")
      return
    }

    setAttachingPdfs(true)
    setAttachProgress(0)

    let attached = 0

    for (let i = 0; i < toAttach.length; i++) {
      const pf = toAttach[i]
      const expenseId = pf.manualExpenseId || pf.matchResult.expenseId!
      setAttachProgress(Math.round(((i + 1) / toAttach.length) * 100))

      try {
        // Validate and compress
        if (!isValidFileType(pf.file)) {
          console.error(`Invalid file type: ${pf.file.name}`)
          continue
        }
        if (!isValidFileSize(pf.file)) {
          console.error(`File too large: ${pf.file.name}`)
          continue
        }

        const compressedFile = await compressImage(pf.file)

        // Upload
        const uploadUrl = await generateUploadUrl()
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        })

        if (!response.ok) throw new Error("Upload failed")

        const { storageId } = await response.json()

        // Save document
        const documentId = await saveDocument({
          storageId,
          originalFilename: pf.file.name,
          mimeType: compressedFile.type,
          sizeBytes: compressedFile.size,
        })

        // Link to expense
        await addToExpense({ expenseId, documentId })
        attached++
      } catch (error) {
        console.error(`Failed to attach ${pf.file.name}:`, error)
      }
    }

    setAttachingPdfs(false)
    setAttachedCount(attached)
    toast.success(`Attached ${attached} documents`)
    setStep("complete")
  }

  const handleSkipPdfs = () => {
    setStep("complete")
  }

  // ============ Render ============

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* CSV Dropzone */}
      {!parseResult && (
        <div
          {...getCsvRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
            isCsvDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getCsvInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            {isCsvDragActive ? "Drop CSV file here..." : "Drop your CSV file here"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            or click to select a file
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Expected columns: Date (YYYY-MM-DD), Paid To, Amount, Comment (optional)
          </p>
        </div>
      )}

      {/* Parse Results */}
      {parseResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {parseResult.rows.length} rows
            </Badge>
            <Badge variant="default" className="bg-green-600">
              {parseResult.validCount} valid
            </Badge>
            {parseResult.errorCount > 0 && (
              <Badge variant="destructive">{parseResult.errorCount} errors</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setParseResult(null)}
              className="ml-auto"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Error Alert */}
          {parseResult.errorCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {parseResult.errorCount} rows have errors. Fix them in your CSV
                file and re-upload, or import only the valid rows.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          <div className="rounded-md border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parseResult.rows.map((row) => (
                  <TableRow
                    key={row.rowIndex}
                    className={row.errors.length > 0 ? "bg-destructive/10" : ""}
                  >
                    <TableCell className="text-muted-foreground">
                      {row.rowIndex}
                    </TableCell>
                    <TableCell>{row.date || "—"}</TableCell>
                    <TableCell>{row.provider || "—"}</TableCell>
                    <TableCell className="text-right">
                      {row.amountCents ? formatCurrency(row.amountCents) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {row.comment || "—"}
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <span
                          className="text-destructive text-xs"
                          title={row.errors.join(", ")}
                        >
                          {row.errors[0]}
                        </span>
                      ) : (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing expenses...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}

          {/* Import Button */}
          {!importing && (
            <Button
              onClick={handleImportAll}
              disabled={parseResult.validCount === 0}
              className="w-full"
            >
              Import {parseResult.validCount} Valid Expenses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )

  const renderMatchStep = () => (
    <div className="space-y-6">
      {/* Summary */}
      <Alert>
        <Check className="h-4 w-4" />
        <AlertDescription>
          Successfully imported {importedExpenses.length} expenses. Now you can
          optionally attach PDF receipts.
        </AlertDescription>
      </Alert>

      {/* PDF Dropzone */}
      <div
        {...getPdfRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isPdfDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getPdfInputProps()} />
        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm">
          {isPdfDragActive
            ? "Drop PDF files here..."
            : "Drop PDF receipts here to auto-match"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Files named with date (e.g., 2024-01-15-DrSmith.pdf) will auto-match
        </p>
      </div>

      {/* PDF List */}
      {pdfFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {pdfFiles.filter((f) => f.matchResult.matched).length} matched,{" "}
              {pdfFiles.filter((f) => !f.matchResult.matched).length} unmatched
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-auto">
            {pdfFiles.map((pf, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  pf.matchResult.matched ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                )}
              >
                {pf.matchResult.matched ? (
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pf.file.name}</p>
                  {pf.matchResult.matched && pf.matchResult.matchedExpense && (
                    <p className="text-xs text-muted-foreground">
                      → {pf.matchResult.matchedExpense.date} •{" "}
                      {pf.matchResult.matchedExpense.provider} •{" "}
                      {formatCurrency(pf.matchResult.matchedExpense.amountCents)}
                    </p>
                  )}
                </div>

                {!pf.matchResult.matched && (
                  <Select
                    value={pf.manualExpenseId || ""}
                    onValueChange={(value) =>
                      updatePdfMatch(index, value as Id<"expenses"> || null)
                    }
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select expense..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="flex items-center border-b px-2 pb-2">
                        <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                        <Input
                          placeholder="Search by date or provider..."
                          value={searchTerms[index] || ""}
                          onChange={(e) =>
                            setSearchTerms((prev) => ({ ...prev, [index]: e.target.value }))
                          }
                          className="h-8 border-0 p-0 focus-visible:ring-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {(() => {
                        const search = (searchTerms[index] || "").toLowerCase()
                        const filtered = getAvailableExpenses(pf.manualExpenseId)
                          .filter((exp) => {
                            if (!search) return true
                            return (
                              exp.date.includes(search) ||
                              exp.provider.toLowerCase().includes(search)
                            )
                          })
                          .slice(0, 50) // Limit to 50 visible at once for performance

                        if (filtered.length === 0) {
                          return (
                            <div className="py-2 px-2 text-sm text-muted-foreground">
                              No matching expenses
                            </div>
                          )
                        }

                        return filtered.map((exp) => (
                          <SelectItem key={exp.expenseId} value={exp.expenseId}>
                            {exp.date} • {exp.provider} • {formatCurrency(exp.amountCents)}
                          </SelectItem>
                        ))
                      })()}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewFile(pf.file)}
                  title="Preview file"
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePdf(index)}
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-80px)]">
            {previewFile && isPdf(previewFile) ? (
              <iframe
                src={previewUrl || ""}
                className="w-full h-[70vh] rounded border"
                title={previewFile.name}
              />
            ) : (
              <img
                src={previewUrl || ""}
                alt={previewFile?.name}
                className="max-w-full h-auto mx-auto"
                onError={(e) => {
                  e.currentTarget.src = ""
                  e.currentTarget.alt = "Failed to load image"
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Attach Progress */}
      {attachingPdfs && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Attaching documents...</span>
            <span>{attachProgress}%</span>
          </div>
          <Progress value={attachProgress} />
        </div>
      )}

      {/* Action Buttons */}
      {!attachingPdfs && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkipPdfs} className="flex-1">
            Skip
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            onClick={handleAttachPdfs}
            disabled={pdfFiles.filter((f) => f.matchResult.matched).length === 0}
            className="flex-1"
          >
            Attach {pdfFiles.filter((f) => f.matchResult.matched).length} Matched
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center py-8">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      <div>
        <h3 className="text-xl font-semibold">Import Complete!</h3>
        <p className="text-muted-foreground mt-2">
          {importedExpenses.length} expenses imported
          {attachedCount > 0 && `, ${attachedCount} documents attached`}
        </p>
      </div>

      <Button onClick={onClose} className="w-full">
        View Expenses
      </Button>
    </div>
  )

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {step === "upload" && (
              <>
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  1
                </span>
                Upload & Review CSV
              </>
            )}
            {step === "match" && (
              <>
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  2
                </span>
                Match PDF Receipts
              </>
            )}
            {step === "complete" && (
              <>
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">
                  ✓
                </span>
                Complete
              </>
            )}
          </CardTitle>
          {step !== "complete" && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          <div
            className={cn(
              "h-1 flex-1 rounded",
              step === "upload" ? "bg-primary" : "bg-primary"
            )}
          />
          <div
            className={cn(
              "h-1 flex-1 rounded",
              step === "match" || step === "complete"
                ? "bg-primary"
                : "bg-muted"
            )}
          />
          <div
            className={cn(
              "h-1 flex-1 rounded",
              step === "complete" ? "bg-primary" : "bg-muted"
            )}
          />
        </div>
      </CardHeader>

      <CardContent>
        {step === "upload" && renderUploadStep()}
        {step === "match" && renderMatchStep()}
        {step === "complete" && renderCompleteStep()}
      </CardContent>
    </Card>
  )
}
