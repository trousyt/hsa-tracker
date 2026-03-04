/** react-dropzone accept config — kept in sync with ALLOWED_MIME_TYPES from convex/lib/constants */
export const DROPZONE_ACCEPT_CONFIG = {
  "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
  "application/pdf": [".pdf"],
} as const satisfies Record<string, string[]>

/** Maximum upload file size in bytes (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
