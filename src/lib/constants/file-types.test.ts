import { describe, test, expect } from "vitest"
import { DROPZONE_ACCEPT_CONFIG, MAX_FILE_SIZE_BYTES } from "./file-types"
import { ALLOWED_MIME_TYPES } from "@convex/lib/constants"

describe("DROPZONE_ACCEPT_CONFIG", () => {
  test("covers all backend ALLOWED_MIME_TYPES", () => {
    const frontendMimePatterns = Object.keys(DROPZONE_ACCEPT_CONFIG)

    for (const mime of ALLOWED_MIME_TYPES) {
      const covered = frontendMimePatterns.some((pattern) => {
        if (pattern.endsWith("/*")) {
          const prefix = pattern.replace("/*", "/")
          return mime.startsWith(prefix)
        }
        return pattern === mime
      })
      expect(covered, `Backend MIME type "${mime}" not covered by DROPZONE_ACCEPT_CONFIG`).toBe(true)
    }
  })

  test("includes expected image extensions", () => {
    const imageExts = DROPZONE_ACCEPT_CONFIG["image/*"]
    expect(imageExts).toContain(".jpeg")
    expect(imageExts).toContain(".jpg")
    expect(imageExts).toContain(".png")
    expect(imageExts).toContain(".webp")
    expect(imageExts).toContain(".heic")
  })

  test("includes PDF extension", () => {
    const pdfExts = DROPZONE_ACCEPT_CONFIG["application/pdf"]
    expect(pdfExts).toContain(".pdf")
  })

  test("has exactly 2 MIME categories", () => {
    const keys = Object.keys(DROPZONE_ACCEPT_CONFIG)
    expect(keys).toHaveLength(2)
    expect(keys).toContain("image/*")
    expect(keys).toContain("application/pdf")
  })
})

describe("MAX_FILE_SIZE_BYTES", () => {
  test("equals 10MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })

  test("is a positive number", () => {
    expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0)
  })
})
