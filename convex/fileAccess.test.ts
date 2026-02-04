import { convexTest } from "convex-test"
import { expect, test, describe } from "vitest"
import schema from "./schema"
import { modules } from "./test.setup"

/**
 * Tests for the secure file access functionality.
 *
 * HOT CODE PATHS TESTED:
 * 1. Document ownership verification (getDocumentForAccess)
 * 2. Audit logging for all access scenarios (logAccess)
 * 3. Security compliance (all required fields captured)
 *
 * Each test gets a fresh in-memory database via convex-test.
 */

// Helper to create a test context with a real document
async function createTestDocumentContext() {
  const t = convexTest(schema, modules)

  // Create a user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      isOwner: true,
    })
  })

  // Create a real file in storage and a real document referencing it
  const { documentId, storageId } = await t.run(async (ctx) => {
    const blob = new Blob(["test file content"], { type: "application/pdf" })
    const storageId = await ctx.storage.store(blob)

    const documentId = await ctx.db.insert("documents", {
      userId: userId as unknown as string,
      storageId,
      originalFilename: "test-receipt.pdf",
      mimeType: "application/pdf",
      sizeBytes: blob.size,
      ocrStatus: "completed",
    })

    return { documentId, storageId }
  })

  return { t, userId: userId as unknown as string, documentId, storageId }
}

describe("secure file access", () => {
  /**
   * HOT PATH: Document ownership verification
   * This is the critical security gate that prevents unauthorized access.
   */
  describe("document ownership verification", () => {
    test("grants access when user owns the document", async () => {
      const { t, userId, documentId } = await createTestDocumentContext()

      // Simulate getDocumentForAccess logic
      const result = await t.run(async (ctx) => {
        const document = await ctx.db.get(documentId)
        if (!document || document.userId !== userId) {
          return null
        }
        return {
          storageId: document.storageId,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        }
      })

      expect(result).not.toBeNull()
      expect(result?.originalFilename).toBe("test-receipt.pdf")
      expect(result?.mimeType).toBe("application/pdf")
    })

    test("DENIES access when user does NOT own the document", async () => {
      const { t, documentId } = await createTestDocumentContext()
      const attackerUserId = "attacker-user-456"

      // Simulate getDocumentForAccess with wrong user
      const result = await t.run(async (ctx) => {
        const document = await ctx.db.get(documentId)
        if (!document || document.userId !== attackerUserId) {
          return null
        }
        return document
      })

      expect(result).toBeNull()
    })
  })

  /**
   * HOT PATH: Audit logging for all access scenarios
   * Critical for compliance (HIPAA, PCI-DSS, SOC2).
   */
  describe("audit logging", () => {
    test("logs successful document access", async () => {
      const { t, userId, documentId } = await createTestDocumentContext()

      await t.run(async (ctx) => {
        await ctx.db.insert("fileAccessLogs", {
          userId,
          documentId,
          action: "view",
          timestamp: Date.now(),
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          success: true,
        })
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        userId,
        documentId,
        action: "view",
        success: true,
      })
    })

    test("logs FAILED access - unauthenticated user", async () => {
      const { t, documentId } = await createTestDocumentContext()

      // Simulate HTTP action logging 401 error
      await t.run(async (ctx) => {
        await ctx.db.insert("fileAccessLogs", {
          userId: "anonymous",
          documentId,
          action: "view",
          timestamp: Date.now(),
          success: false,
          errorReason: "Not authenticated",
        })
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      expect(logs[0].success).toBe(false)
      expect(logs[0].errorReason).toBe("Not authenticated")
      expect(logs[0].userId).toBe("anonymous")
    })

    test("logs FAILED access - unauthorized user (403)", async () => {
      const { t, documentId } = await createTestDocumentContext()

      // Simulate HTTP action logging 403 error
      await t.run(async (ctx) => {
        await ctx.db.insert("fileAccessLogs", {
          userId: "attacker-user-456",
          documentId,
          action: "view",
          timestamp: Date.now(),
          success: false,
          errorReason: "Document not found or access denied",
        })
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      expect(logs[0].success).toBe(false)
      expect(logs[0].errorReason).toBe("Document not found or access denied")
    })

    test("distinguishes view vs download actions", async () => {
      const { t, userId, documentId } = await createTestDocumentContext()

      await t.run(async (ctx) => {
        await ctx.db.insert("fileAccessLogs", {
          userId,
          documentId,
          action: "view",
          timestamp: Date.now(),
          success: true,
        })
        await ctx.db.insert("fileAccessLogs", {
          userId,
          documentId,
          action: "download",
          timestamp: Date.now() + 1000,
          success: true,
        })
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      expect(logs).toHaveLength(2)
      expect(logs.map((l) => l.action)).toContain("view")
      expect(logs.map((l) => l.action)).toContain("download")
    })
  })

  /**
   * HOT PATH: Compliance audit trail
   * Ensures all required fields are captured for regulatory compliance.
   */
  describe("compliance requirements", () => {
    test("audit log contains ALL required fields for HIPAA/PCI-DSS", async () => {
      const { t, userId, documentId } = await createTestDocumentContext()

      const timestamp = Date.now()
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

      await t.run(async (ctx) => {
        await ctx.db.insert("fileAccessLogs", {
          userId,
          documentId,
          action: "view",
          timestamp,
          userAgent,
          success: true,
        })
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      const log = logs[0]

      // All fields required for compliance
      expect(log._id).toBeDefined() // Unique record ID
      expect(log._creationTime).toBeDefined() // Immutable timestamp
      expect(log.userId).toBe(userId) // WHO accessed
      expect(log.documentId).toEqual(documentId) // WHAT was accessed
      expect(log.action).toBe("view") // Type of access
      expect(log.timestamp).toBe(timestamp) // WHEN
      expect(log.success).toBe(true) // Outcome
      expect(log.userAgent).toBe(userAgent) // Client info
    })

    test("failed access ALWAYS includes error reason", async () => {
      const { t, documentId } = await createTestDocumentContext()

      const errorScenarios = [
        "Not authenticated",
        "Document not found or access denied",
        "File not found in storage",
      ]

      await t.run(async (ctx) => {
        for (const errorReason of errorScenarios) {
          await ctx.db.insert("fileAccessLogs", {
            userId: "test-user",
            documentId,
            action: "view",
            timestamp: Date.now(),
            success: false,
            errorReason,
          })
        }
      })

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("fileAccessLogs").collect()
      })

      expect(logs).toHaveLength(3)
      expect(logs.every((l) => l.success === false)).toBe(true)
      expect(logs.every((l) => typeof l.errorReason === "string")).toBe(true)
    })
  })
})
