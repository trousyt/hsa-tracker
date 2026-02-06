/**
 * Utilities for aggregating OCR data across multiple documents.
 *
 * When an expense has multiple documents with OCR results, we pick the
 * highest-confidence value per field (amount, date, provider) independently.
 */

/** Shape of OCR extracted data stored on each document. */
export interface OcrExtractedData {
  amount?: { valueCents: number; confidence: number }
  date?: { value: string; confidence: number }
  provider?: { value: string; confidence: number }
}

/** Minimal document shape needed for OCR aggregation. */
export interface DocumentWithOcr {
  _id: string
  ocrStatus: string
  ocrExtractedData?: OcrExtractedData
  originalFilename: string
  mimeType: string
}

interface BestOcrResult {
  /** Aggregated OCR data with highest-confidence value per field. */
  data: OcrExtractedData
  /** The document that contributed the most fields (for preview selection). */
  primaryDocument: DocumentWithOcr
}

/**
 * Aggregate OCR data across all documents, picking the highest-confidence
 * value for each field independently.
 *
 * @returns null if no documents have usable OCR data, otherwise the
 *          aggregated data and the primary document for preview.
 */
export function getBestOcrData(
  documents: (DocumentWithOcr | null)[]
): BestOcrResult | null {
  let bestAmount: OcrExtractedData["amount"]
  let bestDate: OcrExtractedData["date"]
  let bestProvider: OcrExtractedData["provider"]

  // Track which document contributed each field (for primary doc selection)
  let amountDocId: string | undefined
  let dateDocId: string | undefined
  let providerDocId: string | undefined

  for (const doc of documents) {
    if (!doc || doc.ocrStatus !== "completed" || !doc.ocrExtractedData) continue
    const { amount, date, provider } = doc.ocrExtractedData

    if (amount && (!bestAmount || amount.confidence > bestAmount.confidence)) {
      bestAmount = amount
      amountDocId = doc._id
    }
    if (date && (!bestDate || date.confidence > bestDate.confidence)) {
      bestDate = date
      dateDocId = doc._id
    }
    if (provider && (!bestProvider || provider.confidence > bestProvider.confidence)) {
      bestProvider = provider
      providerDocId = doc._id
    }
  }

  if (!bestAmount && !bestDate && !bestProvider) return null

  const data: OcrExtractedData = {
    amount: bestAmount,
    date: bestDate,
    provider: bestProvider,
  }

  // Pick the document that contributed the most fields as primary
  const docIdCounts = new Map<string, number>()
  for (const id of [amountDocId, dateDocId, providerDocId]) {
    if (id) docIdCounts.set(id, (docIdCounts.get(id) ?? 0) + 1)
  }

  let primaryDocId: string | undefined
  let maxCount = 0
  for (const [id, count] of docIdCounts) {
    if (count > maxCount) {
      maxCount = count
      primaryDocId = id
    }
  }

  const primaryDocument = documents.find((d) => d?._id === primaryDocId) as DocumentWithOcr

  return { data, primaryDocument }
}
