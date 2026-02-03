---
title: "React Hooks Missing Dependencies Warning"
category: logic-errors
tags: [react, hooks, useCallback, eslint, exhaustive-deps]
module: react-patterns
symptoms:
  - "React Hook useCallback has a missing dependency"
  - "react-hooks/exhaustive-deps warning"
  - "Stale closure in callback"
date: 2026-02-03
---

# React Hooks Missing Dependencies Warning

## Problem

ESLint `react-hooks/exhaustive-deps` warns about missing dependencies in `useCallback`:

```
React Hook useCallback has a missing dependency: 'uploadFile'.
Either include it or remove the dependency array.
```

## Root Cause

A function used inside `useCallback` was defined as a regular function (not wrapped in `useCallback`), causing it to be recreated on every render. When this function is called inside another `useCallback`, it becomes a missing dependency.

**Before (problematic):**
```typescript
// Regular function - recreated every render
const uploadFile = async (file: File) => {
  // ... uses mutations, state setters
}

// Missing uploadFile dependency
const onDrop = useCallback((acceptedFiles: File[]) => {
  uploadFile(acceptedFiles[0])  // uploadFile changes every render!
}, [])  // ESLint warns: missing 'uploadFile'
```

## Solution

Wrap the inner function in `useCallback` with its own dependencies, then include it in the outer callback's dependencies:

```typescript
// Wrap in useCallback with stable dependencies
const uploadFile = useCallback(async (file: File) => {
  // State setters (from useState) are always stable - no need in deps
  setUploadStatus("uploading")

  // Mutations (from useMutation) should be included
  const url = await generateUploadUrl()
  await saveDocument({ storageId })
}, [generateUploadUrl, saveDocument])  // Include mutations

// Now uploadFile is stable and can be a dependency
const onDrop = useCallback((acceptedFiles: File[]) => {
  uploadFile(acceptedFiles[0])
}, [uploadFile])  // uploadFile is now stable
```

**Key insight about dependencies:**
- **State setters** (`setFoo` from `useState`) are always stable - don't need to be in deps
- **Mutations** (`useMutation` from Convex/React Query) should be included
- **Props** (like `expenseId`, `onComplete`) must be included
- **Helper functions** must be wrapped in `useCallback` or included in deps

## Full Pattern Example

```typescript
// Helper for updating progress - only uses stable setter
const updateProgress = useCallback(
  (index: number, updates: Partial<UploadingFile>) => {
    setUploadingFiles((files) =>  // Callback form avoids state dep
      files.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  },
  []  // Empty: only uses stable setState
)

// Main upload function with all deps
const uploadFile = useCallback(async (file: File, index: number) => {
  updateProgress(index, { status: "uploading" })
  const url = await generateUploadUrl()
  // ... rest of upload logic
  onUploadComplete?.(documentId)
}, [updateProgress, generateUploadUrl, saveDocument, expenseId, onUploadComplete])

// Dropzone callback
const onDrop = useCallback(
  (acceptedFiles: File[]) => {
    acceptedFiles.forEach((file, i) => uploadFile(file, i))
  },
  [uploadFile]  // uploadFile is now stable
)
```

## Prevention

1. **State setters are always stable** - use callback form `setState(prev => ...)` to avoid state dependencies
2. **Wrap helper functions** in `useCallback` if they're used in other callbacks
3. **Include all external values** that could change between renders
4. **Test with React StrictMode** - it double-invokes effects to catch stale closures
5. **Don't ignore the warning** - missing deps cause subtle bugs

## TanStack Table Special Case

TanStack Table's `useReactTable` returns functions that can't be memoized safely. This is a known library design and should be suppressed:

```typescript
// eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is designed this way
const table = useReactTable({ ... })
```

## Related

- React docs: [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- ESLint plugin: [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)
