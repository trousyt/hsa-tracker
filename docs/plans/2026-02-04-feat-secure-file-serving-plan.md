---
title: "feat: Secure HTTP Action-Based File Serving"
type: feat
date: 2026-02-04
status: implemented
---

# feat: Secure HTTP Action-Based File Serving

## Overview

Implement authenticated file access to protect PII and financial documents stored in the HSA Tracker application. Native Convex storage URLs (`ctx.storage.getUrl()`) do not expire and are publicly accessible, creating a significant security risk for sensitive health and financial data.

## Problem Statement

**Security Gap Identified:** Convex's native `storage.getUrl()` returns permanent, publicly-accessible URLs with no authentication. Anyone with a storage URL can access the file indefinitely.

**Risk:** HSA documents may contain:
- Personal health information (PHI) - HIPAA concerns
- Credit card statements and receipts - PCI-DSS concerns
- Social Security Numbers on EOBs
- Medical procedure details
- Insurance claim information

A leaked document URL would expose sensitive PII with no way to revoke access.

## Proposed Solution

Replace direct storage URL exposure with an HTTP action-based file serving endpoint that:
1. Authenticates every request via JWT
2. Verifies document ownership before serving
3. Logs all access attempts for compliance auditing
4. Returns files as blobs (not redirect URLs)
5. Applies security headers to prevent caching and embedding

## Technical Approach

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  HTTP Action     │────▶│  Convex Storage │
│  (React)    │     │  /api/files/:id  │     │  (Blob)         │
└─────────────┘     └──────────────────┘     └─────────────────┘
      │                     │
      │ Bearer Token        │ Audit Log
      ▼                     ▼
┌─────────────┐     ┌──────────────────┐
│ Convex Auth │     │ fileAccessLogs   │
│   (JWT)     │     │   Table          │
└─────────────┘     └──────────────────┘
```

### Implementation Phases

#### Phase 1: Backend - Audit Logging Schema

Add `fileAccessLogs` table to `convex/schema.ts`:

```typescript
fileAccessLogs: defineTable({
  userId: v.string(),
  documentId: v.id("documents"),
  action: v.union(v.literal("view"), v.literal("download")),
  timestamp: v.number(),
  userAgent: v.optional(v.string()),
  success: v.boolean(),
  errorReason: v.optional(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_document", ["documentId"])
  .index("by_timestamp", ["timestamp"])
```

**Files:** `convex/schema.ts`

#### Phase 2: Backend - Internal Access Functions

Create `convex/fileAccess.ts` with internal functions:

- `getDocumentForAccess` - Query document and verify ownership
- `logAccess` - Record access attempts for audit trail

**Files:** `convex/fileAccess.ts` (new)

#### Phase 3: Backend - Secure HTTP Endpoint

Add HTTP action to `convex/http.ts`:

- Route: `GET /api/files/{documentId}`
- Authentication: JWT via `ctx.auth.getUserIdentity()`
- Authorization: Verify `document.userId === identity.subject`
- Response: Blob with security headers

Security headers applied:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Cache-Control: private, no-store, max-age=0`

CORS preflight handler for `OPTIONS` requests.

**Files:** `convex/http.ts`

#### Phase 4: Frontend - Secure File Hooks

Create `src/lib/secure-file.ts`:

- `getSecureFileUrl()` - Build URL to secure endpoint
- `fetchSecureFile()` - Fetch with auth token, return blob URL
- `useSecureFileUrl()` - React hook with `getFileUrl` and `downloadFile`

Key patterns:
- Use `useAuthToken()` from `@convex-dev/auth/react`
- Convert Convex URL to site URL (`.convex.cloud` → `.convex.site`)
- Manage blob URLs with `URL.createObjectURL()` / `URL.revokeObjectURL()`

**Files:** `src/lib/secure-file.ts` (new)

#### Phase 5: Frontend - Update Components

Update document viewing components:

- `DocumentViewer` - Fetch files securely with loading/error states
- `DocumentGallery` - Pass document ID instead of URL to viewer

Remove URL exposure from `convex/documents.ts` queries.

**Files:**
- `src/components/documents/document-viewer.tsx`
- `src/components/documents/document-gallery.tsx`
- `convex/documents.ts`

## Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Native Convex URLs** | Simple, fast | No auth, URLs don't expire, public | ❌ Rejected |
| **HTTP Actions (chosen)** | Full auth, audit logging, ownership check | Slightly more latency | ✅ Chosen |
| **Convex Files Control** | Enterprise feature, built-in | Requires paid tier, less control | ❌ Not available |
| **External storage (R2/S3)** | Industry standard | Added complexity, separate service | ❌ Over-engineered |
| **Signed URLs** | Time-limited access | Convex doesn't support natively | ❌ Not available |

## Acceptance Criteria

### Functional Requirements

- [x] HTTP endpoint authenticates every file request via JWT
- [x] Endpoint verifies document ownership before serving
- [x] Files returned as blobs with correct MIME type
- [x] Unauthenticated requests return 401
- [x] Unauthorized requests (wrong owner) return 403
- [x] Missing files return 404

### Non-Functional Requirements

- [x] All access attempts logged (success and failure)
- [x] Audit logs include: userId, documentId, action, timestamp, userAgent, success, errorReason
- [x] Security headers prevent caching and embedding
- [x] No storage URLs exposed in API responses
- [x] Blob URLs cleaned up on component unmount

### Quality Gates

- [x] Lint passes
- [x] All tests pass (67 tests)
- [x] Build succeeds
- [x] Manual testing of view/download flows

## Success Metrics

- **Zero public URL exposure** - No `ctx.storage.getUrl()` calls in user-facing code
- **100% access logging** - Every file access attempt recorded
- **Auth coverage** - All file requests require valid JWT

## Dependencies & Prerequisites

- Convex Auth configured with JWT support
- `@convex-dev/auth` package installed
- HTTP routes configured in `convex/http.ts`

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token expiration during long sessions | Medium | Medium | Frontend handles 401 gracefully |
| Blob URL memory leaks | Medium | Low | Cleanup in useEffect return |
| Audit log volume | Low | Low | Indexed by timestamp for pruning |
| CORS issues | Medium | Medium | Explicit CORS preflight handler |

## Future Considerations

1. **Download tracking** - Separate "download" action from "view" in audit logs
2. **Rate limiting** - Prevent abuse of file endpoint
3. **Thumbnail generation** - Cached thumbnails for gallery view
4. **Audit log retention** - Policy for pruning old logs
5. **Admin audit dashboard** - UI for reviewing access logs

## References & Research

### Internal References

- HTTP router setup: `convex/http.ts:1-10`
- Auth integration: `convex/auth.ts`
- Document schema: `convex/schema.ts:documents`
- File upload pattern: `convex/documents.ts:generateUploadUrl`

### External References

- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Convex Auth getUserIdentity](https://docs.convex.dev/auth/functions-auth)
- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)

### Related Work

- PR #1: Convex Auth with GitHub OAuth
- Branch: `feat/secure-file-serving`

## Implementation Status

**Status: IMPLEMENTED** - All phases complete and verified.

### Files Changed

| File | Change |
|------|--------|
| `convex/schema.ts` | Added `fileAccessLogs` table |
| `convex/http.ts` | Added secure file endpoint |
| `convex/fileAccess.ts` | New - internal access functions |
| `convex/documents.ts` | Removed URL exposure |
| `src/lib/secure-file.ts` | New - frontend hooks |
| `src/components/documents/document-viewer.tsx` | Updated for secure fetch |
| `src/components/documents/document-gallery.tsx` | Updated to pass ID not URL |

### Verification

```bash
bun run lint    # ✅ Passed
bun run test    # ✅ 67 tests passed
bun run build   # ✅ Built successfully
```
