# Drag-and-Drop Expense Creation

**Date:** 2026-03-04
**Status:** Brainstorm
**Type:** Feature

## What We're Building

A page-level drag-and-drop overlay on the expenses list that lets users drop a receipt file to instantly open the "Add Expense" dialog with the file already uploading and OCR in progress. No visible drop zone at rest — only appears when dragging a file over the page.

**User flow:**
1. User drags a receipt file over the expenses page
2. A full-area overlay appears: "Drop receipt to add expense"
3. User drops the file
4. The "Add Expense" dialog opens immediately with the file auto-uploading
5. OCR processes in the background; form fields populate as results arrive
6. User reviews/adjusts the pre-filled data and clicks Save

## Why This Approach

- **Page-level overlay** keeps the UI clean at rest (no extra visual element taking space)
- **Open dialog immediately** matches existing behavior — users already see the upload spinner inside the dialog
- **Pass File as prop** to ExpenseDialog is the simplest wiring — reuses all existing upload, compression, and OCR watching logic without duplication
- **react-dropzone** is already a dependency with established patterns in the codebase

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OCR timing | Open dialog immediately | Matches existing in-dialog behavior; fields populate live as OCR completes |
| Drop zone visibility | Page-level drag overlay | Clean at rest, discoverable when dragging. No permanent visual footprint |
| File wiring | Pass `File` as prop to dialog | Reuses existing upload logic inside ExpenseDialog. Minimal code changes |
| Click behavior | No click on overlay | `noClick: true` on the page-level dropzone — clicking the page shouldn't trigger file picker. Users use the existing "Add Expense" button for that |

## Scope

**In scope:**
- Page-level `useDropzone` wrapper on `ExpenseTable` with `noClick: true`
- Drag-over overlay with clear visual feedback
- New `initialFile` prop on `ExpenseDialog`
- `useEffect` in `ExpenseDialog` to auto-trigger upload when `initialFile` is provided
- Single file only (consistent with current create-mode behavior)

**Constraints:**
- If the create or edit dialog is already open, ignore the drop (don't disrupt in-progress work)
- Invalid file types show a toast error, same as the existing dropzone validation

**Out of scope:**
- Multi-file drop
- Drag-and-drop onto existing expense rows
- Any changes to the existing "Add Expense" button flow

## Open Questions

None — all key decisions resolved during brainstorming.
