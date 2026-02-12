const MAX_SIZE_MB = 0.5 // Target max file size (500KB)
const MAX_WIDTH_OR_HEIGHT = 1920 // Max dimension

/**
 * Compress an image file to reduce storage costs.
 * Dynamically imports browser-image-compression to avoid loading
 * the 57KB library until the user actually uploads an image.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip compression for non-image files
  if (!file.type.startsWith("image/")) {
    return file
  }

  // Skip if already small enough
  if (file.size <= MAX_SIZE_MB * 1024 * 1024) {
    return file
  }

  const options = {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
  }

  try {
    const { default: imageCompression } = await import("browser-image-compression")
    const compressedFile = await imageCompression(file, options)
    console.log(
      `Compressed ${file.name}: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`
    )
    return compressedFile
  } catch (error) {
    console.error("Image compression failed:", error)
    return file // Return original if compression fails
  }
}

/**
 * Validate file type
 */
export function isValidFileType(file: File): boolean {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ]
  return validTypes.includes(file.type)
}

/**
 * Validate file size (before compression)
 */
export function isValidFileSize(file: File, maxSizeMB = 10): boolean {
  return file.size <= maxSizeMB * 1024 * 1024
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
