---
title: "Convex HTTP Routes 404, CORS Errors, and Blob URL Memory Leaks"
category: integration-issues
tags: [convex, http-actions, cors, react-hooks, memory-leak, file-serving, useEffect]
module: documents
date: 2026-02-04
symptoms:
  - "404 errors in Convex logs when fetching files"
  - "No fileAccessLogs entries being created"
  - "Browser console: CORS policy blocked cross-origin response"
  - "Retry button shows blank screen, second click does nothing"
  - "Memory growth from unreleased blob URLs"
root_cause: "Convex router path syntax, missing CORS headers, React effect dependencies, async cleanup timing"
---

# Convex HTTP Routes 404, CORS Errors, and Blob URL Memory Leaks

## Problem

Four interconnected issues when implementing secure HTTP-based file serving:

1. **HTTP 404 errors** - Requests to `/api/files/{documentId}` return 404
2. **CORS blocking** - Browser blocks responses even after preflight succeeds
3. **Retry button broken** - Click shows blank screen, can't retry again
4. **Blob URL leak** - URLs created during unmount never revoked

## Investigation

**Clue 1:** 404 in Convex logs but NO `fileAccessLogs` entries
- If handler ran, it would log (success or failure)
- Handler never executes → route not matching

**Clue 2:** OPTIONS verb in Convex logs
- Browser sends preflight for cross-origin + Authorization header
- Same route matching issue

**Clue 3:** Retry clears error but shows nothing
- `loading=false`, `error=null`, `blobUrl=null`
- No render condition matches → blank

## Root Cause

### 1. Convex HTTP Router Syntax

Convex doesn't support path parameters like `{documentId}`. It only supports:
- **Exact paths:** `path: "/api/files/abc123"`
- **Prefix matching:** `pathPrefix: "/api/files/"`

```typescript
// ❌ WRONG - treated as literal path "/api/files/{documentId}"
http.route({
  path: "/api/files/{documentId}",
  method: "GET",
})

// ✅ CORRECT - matches any /api/files/* request
http.route({
  pathPrefix: "/api/files/",
  method: "GET",
})
```

### 2. CORS Headers Missing on GET Responses

OPTIONS preflight returns CORS headers, but actual GET responses don't. Browser blocks the response body even on 200 OK.

```typescript
// ❌ Only OPTIONS had CORS headers
// GET responses (401, 403, 404, 200) were missing them

// ✅ All responses need CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.SITE_URL ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
}
```

### 3. useEffect Dependencies

```typescript
// ❌ Retry clears state but effect doesn't re-run
onClick={() => {
  setBlobUrl(null)
  setError(null)
}}
// Dependencies [document, getFileUrl] unchanged!

// ✅ Add retryCount to trigger effect
const [retryCount, setRetryCount] = useState(0)
useEffect(() => { ... }, [document, getFileUrl, retryCount])
onClick={() => setRetryCount(c => c + 1)}
```

### 4. Blob URL Cleanup Timing

```typescript
// ❌ RACE CONDITION
let url = null
const fetchFile = async () => {
  url = await getFileUrl(...)  // url assigned AFTER await
  if (!cancelled) setBlobUrl(url)
}
return () => {
  cancelled = true
  if (url) URL.revokeObjectURL(url)  // url still null!
}
```

Timeline:
1. Effect starts, `url = null`
2. Cleanup runs (unmount), `cancelled = true`, `url` still null
3. `await` resolves, `url` assigned, but cancelled so not set to state
4. Blob URL exists but never revoked → **LEAK**

## Solution

### Fix 1: Use pathPrefix

```typescript
// convex/http.ts
http.route({
  pathPrefix: "/api/files/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const documentId = pathParts[pathParts.length - 1] as Id<"documents">
    // ...
  }),
})
```

### Fix 2: CORS Headers on All Responses

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.SITE_URL ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

// Apply to ALL responses
return new Response("Unauthorized", {
  status: 401,
  headers: { ...corsHeaders, "Content-Type": "text/plain" },
})

return new Response(blob, {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": mimeType },
})
```

### Fix 3: Retry Counter

```typescript
const [retryCount, setRetryCount] = useState(0)

useEffect(() => {
  // fetch logic
}, [document, getFileUrl, retryCount])

<Button onClick={() => setRetryCount(c => c + 1)}>Retry</Button>
```

### Fix 4: Immediate Blob Revocation

```typescript
const fetchFile = async () => {
  try {
    const fetchedUrl = await getFileUrl(document.id)
    url = fetchedUrl  // Track immediately
    if (cancelled) {
      URL.revokeObjectURL(fetchedUrl)  // Revoke if unmounted
    } else {
      setBlobUrl(fetchedUrl)
    }
  } catch (err) { /* ... */ }
}

return () => {
  cancelled = true
  if (url) URL.revokeObjectURL(url)  // Safety net
}
```

## Prevention

| Issue | Prevention |
|-------|------------|
| Convex routing | Use `pathPrefix` for dynamic segments, never `{param}` |
| CORS | Add headers to ALL response paths, not just preflight |
| Effect deps | Include any state that should trigger re-runs |
| Blob cleanup | Track URL immediately after creation, revoke in both cancelled branch AND cleanup |

## Testing Checklist

- [ ] File preview works on first load
- [ ] File preview works after retry (when first attempt fails)
- [ ] No CORS errors in browser console
- [ ] `fileAccessLogs` entries created for all access attempts
- [ ] Memory stable when rapidly opening/closing previews

## Related

- [Secure File Serving Plan](../../plans/2026-02-04-feat-secure-file-serving-plan.md)
- [React Hooks Missing Dependencies](../logic-errors/react-hooks-missing-dependencies.md)
- [Convex HTTP Actions Docs](https://docs.convex.dev/functions/http-actions)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
