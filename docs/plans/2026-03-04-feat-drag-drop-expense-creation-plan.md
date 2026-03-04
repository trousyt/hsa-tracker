---
title: "feat: Drag-and-drop receipt to create expense"
type: feat
status: active
date: 2026-03-04
deepened: 2026-03-04
origin: docs/brainstorms/2026-03-04-drag-drop-expense-creation-brainstorm.md
---

# Drag-and-Drop Receipt to Create Expense

## Enhancement Summary

**Deepened on:** 2026-03-04
**Sections enhanced:** All
**Review agents used:** architecture-strategist, julik-frontend-races-reviewer, kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist, performance-oracle, best-practices-researcher, Context7 (react-dropzone docs)

### Key Improvements from Research
1. **`pointer-events-none` on overlay** — prevents drag event flicker (the #1 pitfall in page-level DnD)
2. **Abort in-progress uploads on dialog close** — prevents orphaned documents when user cancels mid-upload
3. **Extract shared `DROPZONE_ACCEPT_CONFIG` constant** — eliminates 3-way duplication of accept config
4. **Simplified disabled guard** — only `createDialogOpen || !!editExpense` needed (other overlays are already covered)
5. **Preload dialog chunk on `isDragActive`** — eliminates Suspense delay on first drop

### New Considerations Discovered
- Ghost toast: OCR watcher fires after dialog closes — guard with `!open` check
- The `uploadFile` ref pattern avoids unstable dependency in auto-upload useEffect
- `isDragAccept`/`isDragReject` available from react-dropzone for type-specific visual feedback

---

## Overview

Add a page-level drag-and-drop overlay to the expenses list. When a user drags a receipt file over the page, an overlay appears. On drop, the "Add Expense" dialog opens with the file auto-uploading and OCR processing. No visible UI at rest — progressive enhancement only.

(See brainstorm: `docs/brainstorms/2026-03-04-drag-drop-expense-creation-brainstorm.md`)

## User Flow

1. User drags a receipt (image or PDF) over the expenses page
2. A full-area overlay fades in: "Drop receipt to add expense"
3. User drops the file
4. File is validated at the page level (type + size). Invalid → toast error, no dialog
5. Dialog opens immediately with the file auto-uploading inside
6. OCR processes in background; form fields populate live as results arrive
7. User reviews/adjusts pre-filled data and clicks Save

## Acceptance Criteria

- [ ] Dragging a file over the expenses page shows a full-area overlay with visual feedback
- [ ] Dropping a valid file opens the create dialog and auto-starts upload+OCR
- [ ] Dropping an invalid file type or oversized file shows a toast error without opening the dialog
- [ ] Dropping multiple files shows a toast via `onDropRejected` (react-dropzone `too-many-files` code)
- [ ] Drops are ignored when create or edit dialog is open (`disabled` on useDropzone)
- [ ] The `droppedFile` state is cleared when the dialog closes — reopening via "Add Expense" button has no stale file
- [ ] Closing the dialog mid-upload aborts the in-progress upload and cleans up orphans
- [ ] Ctrl+N keyboard shortcut still works without triggering auto-upload
- [ ] Overlay has `aria-hidden="true"` and `pointer-events-none` (progressive enhancement; existing button flow is the accessible path)
- [ ] No visible UI changes at rest — overlay only appears during drag

## Prerequisite: Extract Shared Dropzone Config

Create `src/lib/constants/file-types.ts`:

```typescript
/** react-dropzone accept config — kept in sync with ALLOWED_MIME_TYPES from convex/lib/constants */
export const DROPZONE_ACCEPT_CONFIG = {
  "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
  "application/pdf": [".pdf"],
} as const satisfies Record<string, string[]>

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
```

Update the existing dropzones in `expense-dialog.tsx` and `file-uploader.tsx` to import from this shared constant instead of hardcoding the config. This prevents drift across the three usages.

## Files to Modify

### `src/components/expenses/expense-table.tsx`

1. **Add page-level `useDropzone`** wrapping the outer `<div className="space-y-4">` (line ~199):
   ```typescript
   import { useDropzone } from "react-dropzone"
   import type { FileRejection } from "react-dropzone"
   import { DROPZONE_ACCEPT_CONFIG, MAX_FILE_SIZE_BYTES } from "@/lib/constants/file-types"

   const isDropDisabled = createDialogOpen || !!editExpense

   const onDrop = useCallback((acceptedFiles: File[]) => {
     if (acceptedFiles.length > 0) {
       setDroppedFile(acceptedFiles[0])
       setCreateDialogOpen(true)
     }
   }, [])

   const onDropRejected = useCallback((rejections: FileRejection[]) => {
     const firstError = rejections[0]?.errors[0]
     if (firstError?.code === "too-many-files") {
       toast.error("Please drop one receipt at a time")
     } else if (firstError?.code === "file-invalid-type") {
       toast.error("Invalid file type. Please drop an image or PDF.")
     } else if (firstError?.code === "file-too-large") {
       toast.error("File too large. Maximum size is 10MB.")
     } else {
       toast.error("Invalid file")
     }
   }, [])

   const { getRootProps, isDragActive } = useDropzone({
     noClick: true,
     noKeyboard: true,
     multiple: false,
     disabled: isDropDisabled,
     accept: DROPZONE_ACCEPT_CONFIG,
     maxSize: MAX_FILE_SIZE_BYTES,
     onDrop,
     onDropRejected,
   })
   ```

   ### Research Insights: Disabled Guard Simplification

   The simplicity review found that only `createDialogOpen || !!editExpense` is needed:
   - `deleteExpense` / `viewExpenseId` open Radix dialogs/sheets whose backdrops block drag interaction
   - `showImportWizard` causes an early return that unmounts the dropzone entirely

2. **Add state:**
   ```typescript
   const [droppedFile, setDroppedFile] = useState<File | null>(null)
   ```

3. **Wire `droppedFile` to create dialog:**
   ```tsx
   <ExpenseDialog
     open={createDialogOpen}
     onOpenChange={(open) => {
       setCreateDialogOpen(open)
       if (!open) setDroppedFile(null)  // clear stale file
     }}
     initialFile={droppedFile ?? undefined}
   />
   ```

   Note: only the create dialog receives `initialFile`. The edit dialog does NOT.

4. **Add overlay inline** (NOT a separate component — it's ~8 lines of JSX used once):

   ```tsx
   <div {...getRootProps()} className="relative space-y-4">
     {/* existing content */}

     {isDragActive && !isDropDisabled && (
       <div
         className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center
                    bg-background/80 border-2 border-dashed border-primary rounded-lg
                    animate-in fade-in-0 duration-200"
         aria-hidden="true"
       >
         <div className="text-center">
           <Upload className="mx-auto h-10 w-10 text-primary mb-2" />
           <p className="text-lg font-medium text-primary">Drop receipt to add expense</p>
         </div>
       </div>
     )}
   </div>
   ```

   ### Research Insights: Overlay Design

   - **`pointer-events-none` is critical** — without it, the overlay intercepts drag events and corrupts react-dropzone's internal enter counter, causing flicker ([react-dropzone #370](https://github.com/react-dropzone/react-dropzone/issues/370))
   - **`position: absolute` not `fixed`** — scopes overlay to the content area, avoids z-index conflicts with navigation
   - **`z-40`** — below dialog layer (`z-50`) but above table content
   - **`animate-in fade-in-0`** — CSS compositor-thread animation, no jank. No exit animation needed (overlay disappears on drop)
   - **`aria-hidden="true"`** — drag-and-drop is mouse-only; screen readers should not announce it

5. **Optional: Preload dialog chunk on drag enter** (eliminates ~100-300ms Suspense delay on first drop):
   ```typescript
   useEffect(() => {
     if (isDragActive) {
       import("./expense-dialog") // preload the chunk; cached after first call
     }
   }, [isDragActive])
   ```

### `src/components/expenses/expense-dialog.tsx`

1. **Add `initialFile` to props interface:**
   ```typescript
   interface ExpenseDialogProps {
     // ... existing props ...
     /** File to immediately begin uploading when dialog opens (from drag-and-drop on table) */
     initialFile?: File
   }
   ```

2. **Add `useEffect` to auto-trigger upload using a ref for stability:**

   ```typescript
   // Use ref to avoid uploadFile in the dependency array (it may change identity)
   const uploadFileRef = useRef(uploadFile)
   uploadFileRef.current = uploadFile

   useEffect(() => {
     if (initialFile && uploadStatus === "idle") {
       uploadFileRef.current(initialFile)
     }
   }, [initialFile]) // eslint-disable-line react-hooks/exhaustive-deps
   ```

   ### Research Insights: Auto-Upload Effect

   - **Ref pattern eliminates `uploadFile` from deps** — `uploadFile` is a `useCallback` that depends on Convex mutations; its identity could change. Using a ref always calls the latest version without re-triggering the effect.
   - **No separate `initialFileProcessed` ref needed** — `uploadFile` transitions `uploadStatus` away from `"idle"` synchronously, naturally preventing re-entry. The `initialFile` reference only changes on new drops (cleared to `undefined` on dialog close).
   - **React StrictMode**: In dev, the effect fires twice. The first call starts the upload and moves status to `"compressing"`. The second call sees `uploadStatus !== "idle"` and bails. Safe.

3. **Guard OCR watcher with `!open` check** (prevent ghost toast on dialog close):

   In the existing `useEffect` at ~line 141 that watches `uploadedDocument?.ocrStatus`:
   ```typescript
   useEffect(() => {
     if (!open) return  // <-- add this guard
     if (uploadedDocument?.ocrStatus === "completed" && uploadedDocument.ocrExtractedData) {
       // ... existing logic ...
     }
   }, [open, uploadedDocument?.ocrStatus, /* ... existing deps */])
   ```

   Without this, closing the dialog at the exact moment OCR completes produces a ghost success toast.

4. **Abort in-progress uploads on dialog close** (prevent orphaned documents):

   ```typescript
   const abortControllerRef = useRef<AbortController | null>(null)
   ```

   In `uploadFile`, create and use the abort controller:
   ```typescript
   const uploadFile = useCallback(async (file: File) => {
     abortControllerRef.current = new AbortController()
     const signal = abortControllerRef.current.signal
     try {
       // ... existing validation + compression ...
       if (signal.aborted) return

       const uploadUrl = await generateUploadUrl()
       if (signal.aborted) return

       const response = await fetch(uploadUrl, {
         method: "POST",
         headers: { "Content-Type": compressedFile.type },
         body: compressedFile,
         signal,  // native fetch supports AbortSignal
       })
       if (signal.aborted) return

       // ... saveDocument ...
     } catch (error) {
       if (error instanceof DOMException && error.name === "AbortError") return
       // ... existing error handling ...
     }
   }, [generateUploadUrl, saveDocument])
   ```

   In the existing cleanup effect when `!open`:
   ```typescript
   useEffect(() => {
     if (open) {
       submittedSuccessfully.current = false
     } else {
       abortControllerRef.current?.abort()  // <-- cancel any in-progress upload
       cleanupOrphanedDocument()
       // ... existing resets ...
     }
   }, [open, cleanupOrphanedDocument])
   ```

   ### Research Insight: Why This Is Critical

   Without the abort signal, closing the dialog mid-upload creates a race: the cleanup effect runs `cleanupOrphanedDocument()` which sees `uploadedDocumentId` as `null` (upload hasn't finished yet), does nothing, and resets all state. Meanwhile, the upload completes in the background, calls `setUploadedDocumentId(docId)` on a component that already reset — producing an orphaned document that no cleanup ever catches.

5. **Hide in-dialog dropzone when `initialFile` triggered the upload** — add to the dropzone render condition:
   ```typescript
   // Only show dropzone when idle and no initialFile was provided
   {(uploadStatus === "idle" || uploadStatus === "error") && !initialFile && (
     <div {...getRootProps()}>...</div>
   )}
   ```
   This prevents a single-frame flash of the idle dropzone before the auto-upload effect fires.

### `src/lib/constants/file-types.ts` (NEW)

Shared constants for react-dropzone configuration. See Prerequisite section above.

## Edge Cases Addressed

| Edge Case | Behavior |
|-----------|----------|
| Invalid file type dropped | Toast error via `onDropRejected`, dialog does NOT open |
| Oversized file dropped | Toast error via `onDropRejected`, dialog does NOT open |
| Multiple files dropped | Toast via `onDropRejected` (`too-many-files` code), dialog does NOT open |
| Drop while create/edit dialog open | Drop ignored (`useDropzone` disabled) |
| Cancel dialog after drop | Upload aborted via AbortController + orphan cleanup |
| Close dialog mid-upload | AbortController cancels fetch, orphan cleanup runs |
| "Add Expense" after cancelled drop | `droppedFile` cleared on close, no stale re-upload |
| Ctrl+N opens dialog | `initialFile` is undefined, no auto-upload |
| Drag non-file content (text/URL) | react-dropzone `accept` config filters — overlay does not appear |
| Touch devices | Drag events don't fire on mobile — feature simply doesn't activate |
| Lazy-loaded dialog (first drop) | Preloaded on `isDragActive` — no visible Suspense delay |
| User saves before OCR completes | Expense saved without OCR data, document attached. Existing behavior |
| OCR completes as dialog closes | `!open` guard prevents ghost toast |
| Overlay flicker from child elements | `pointer-events-none` prevents overlay from intercepting drag events |

## Technical Debt Note

`ExpenseDialog` is currently ~630 lines with 16 state variables. After this feature, future work should consider extracting:
- Upload logic into a `useFileUpload` hook
- OCR watching logic into a `useOcrWatch` hook

This is not a blocker for the current plan.

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-04-drag-drop-expense-creation-brainstorm.md](docs/brainstorms/2026-03-04-drag-drop-expense-creation-brainstorm.md) — key decisions: page-level overlay, immediate dialog open, File-as-prop wiring, noClick
- **Institutional learnings:**
  - [docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md](docs/solutions/logic-errors/form-edit-dialog-field-synchronization.md) — checklist for dialog prop wiring
  - [docs/solutions/logic-errors/react-hooks-missing-dependencies.md](docs/solutions/logic-errors/react-hooks-missing-dependencies.md) — uploadFile useCallback dependency patterns
- **react-dropzone docs** (Context7): `noClick`/`noKeyboard` for page-level zones, `isDragAccept`/`isDragReject` states, `FileRejection` type
- **Best practices sources:**
  - [react-dropzone #370](https://github.com/react-dropzone/react-dropzone/issues/370) — overlay flicker root cause + pointer-events fix
  - [react-dropzone #1035](https://github.com/react-dropzone/react-dropzone/issues/1035) — memoize callbacks to prevent re-renders
  - [Adobe React Spectrum: Accessible Drag and Drop](https://react-spectrum.adobe.com/blog/drag-and-drop.html) — progressive enhancement, keyboard alternatives
- Existing dropzone pattern: `src/components/expenses/expense-dialog.tsx:230-239`
- Orphan cleanup: `src/components/expenses/expense-dialog.tsx:110-137`
- OCR watching: `src/components/expenses/expense-dialog.tsx:102-155`
- File validation: `src/lib/compression.ts` (`isValidFileType`, `isValidFileSize`)
