---
title: "Convex Auth identity.subject Format vs Auth0"
category: integration-issues
tags: [convex-auth, identity, authentication, oauth, http-actions, jwt]
module: authentication
date: 2026-02-04
symptoms:
  - "Ownership checks fail for all authenticated users"
  - "userId comparison always returns false"
  - "HTTP action returns 403 Forbidden despite valid authentication"
  - "getDocumentForAccess returns null for owned documents"
root_cause: "Misunderstanding of identity.subject format in Convex Auth vs other auth providers"
---

# Convex Auth identity.subject Format

## Problem

HTTP action ownership checks fail for all authenticated users. Users get 403 Forbidden when accessing their own documents despite being properly authenticated.

## Investigation

**Symptom:** `getDocumentForAccess` returns null even for documents the user owns.

**Initial (wrong) assumption:** The code used `identity.subject.split("|")[0]` which was assumed to be incorrect because "Convex Auth returns the userId directly."

**Actual format discovery:** Research into Convex Auth source code revealed the true format.

## Root Cause

### Convex Auth Subject Format

Convex Auth uses a **composite subject format**:

```
userId|sessionId
```

Example: `"jh7av9y2t3k8x5nqm6p4w1b2c|kd93mv8x2y4t7nwp5q1z6b3a"`

- First part: User's Convex document ID (from `users` table)
- Second part: Session's Convex document ID (from `authSessions` table)
- Delimiter: `|` (internally called `TOKEN_SUB_CLAIM_DIVIDER`)

### How getAuthUserId Works

The `getAuthUserId()` function from `@convex-dev/auth/server` does exactly this:

```typescript
// From convex-auth source code
const [userId] = identity.subject.split(TOKEN_SUB_CLAIM_DIVIDER);
return userId as GenericId<"users">;
```

### Auth0 Subject Format (Different!)

Auth0 uses a completely different format:

```
identity_provider|user_id
```

Example: `"google-oauth2|123456789012345678901"` or `"github|12345678"`

| Aspect | Convex Auth | Auth0 |
|--------|-------------|-------|
| Format | `userId\|sessionId` | `provider\|externalId` |
| First part | Convex user document ID | Provider name |
| Second part | Session document ID | External user ID |

### Why Tests Pass With Wrong Code

The test helper uses `withIdentity({ subject: userId })` which sets subject to just the userId (no session ID). This means:

- `identity.subject` in tests = `"jh7av9y2t3k8x5nqm6p4w1b2c"` (no pipe)
- `identity.subject.split("|")[0]` = `"jh7av9y2t3k8x5nqm6p4w1b2c"` ✓
- `identity.subject` directly = `"jh7av9y2t3k8x5nqm6p4w1b2c"` ✓

Both approaches work in tests! But in production with real Convex Auth:

- `identity.subject` = `"jh7av9y2t3k8x5nqm6p4w1b2c|kd93mv8x2y4t7nwp5q1z6b3a"`
- `identity.subject.split("|")[0]` = `"jh7av9y2t3k8x5nqm6p4w1b2c"` ✓
- `identity.subject` directly = `"jh7av9y2t3k8x5nqm6p4w1b2c|kd93mv8x2y4t7nwp5q1z6b3a"` ✗ (includes session!)

## Solution

### Correct Pattern for HTTP Actions

```typescript
// convex/http.ts
const identity = await ctx.auth.getUserIdentity()

// ✅ CORRECT - Extract userId from composite subject
const userId = identity.subject.split("|")[0]

// ❌ WRONG - Subject includes sessionId in production
const userId = identity.subject
```

### Why HTTP Actions Need Manual Extraction

- `getAuthUserId(ctx)` requires `QueryCtx` or `MutationCtx`
- HTTP actions have `ActionCtx` which doesn't support `getAuthUserId`
- Must manually replicate the split logic in HTTP actions

### Alternative: Create Internal Query

```typescript
// convex/lib/auth.ts
export const getAuthUserIdFromAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserId(ctx)
  },
})

// convex/http.ts
const userId = await ctx.runQuery(internal.lib.auth.getAuthUserIdFromAction, {})
```

## Prevention

| Scenario | Correct Approach |
|----------|------------------|
| Queries/Mutations | Use `getAuthUserId(ctx)` from `@convex-dev/auth/server` |
| HTTP Actions | Use `identity.subject.split("\|")[0]` |
| Tests | Set subject to just userId (no session) for simplicity |

## Testing Checklist

- [ ] Test ownership checks with real Convex Auth login (not just test identity)
- [ ] Verify userId comparison logs both values when debugging
- [ ] Check that `identity.subject` contains `|` in production logs

## Key Insight

**The split was correct all along.** The issue report claiming it should use `identity.subject` directly was based on incomplete understanding of Convex Auth's subject format.

When debugging auth issues:
1. Log the actual `identity.subject` value
2. Log what's stored in the database as `userId`
3. Compare the two values

## Related

- [Convex Auth Source - getAuthUserId](https://github.com/get-convex/convex-auth/blob/main/src/server/implementation/index.ts)
- [Convex Auth Documentation](https://labs.convex.dev/auth)
- [Auth in Functions | Convex Docs](https://docs.convex.dev/auth/functions-auth)
- [Secure File Serving Plan](../../plans/2026-02-04-feat-secure-file-serving-plan.md)
