---
title: "feat: Add clear all data function for development"
type: feat
date: 2026-02-03
---

# feat: Add Clear All Data Function for Development

## Overview

Add a mutation to clear all data from the Convex database during development/testing. This enables quick reset of the database without manually clearing each table through the dashboard.

## Problem Statement

When testing the import wizard or other features, the database accumulates test data. Currently, clearing data requires:
1. Opening the Convex dashboard
2. Manually clearing each table (expenses, documents, reimbursements)
3. Deleting orphaned files from storage

A single command to reset everything would speed up the development workflow.

## Proposed Solution

Create an internal mutation `clearAllData` that:
1. Deletes all documents from each table
2. Deletes all files from Convex storage
3. Only runs in development (guarded)

### Why Internal Mutation

- Can be run via `bunx convex run` from CLI
- Not exposed to frontend (safety)
- No UI needed - CLI is sufficient for dev workflow

## Technical Approach

### convex/dev.ts

```typescript
import { internalMutation } from "./_generated/server"

// Clear all data - DEVELOPMENT ONLY
export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete reimbursements first (references expenses)
    const reimbursements = await ctx.db.query("reimbursements").collect()
    for (const r of reimbursements) {
      await ctx.db.delete(r._id)
    }

    // Delete documents and their storage files
    const documents = await ctx.db.query("documents").collect()
    for (const doc of documents) {
      await ctx.storage.delete(doc.storageId)
      await ctx.db.delete(doc._id)
    }

    // Delete expenses
    const expenses = await ctx.db.query("expenses").collect()
    for (const e of expenses) {
      await ctx.db.delete(e._id)
    }

    // Note: ocrUsage is preserved (tracks monthly API usage)

    return {
      deleted: {
        reimbursements: reimbursements.length,
        documents: documents.length,
        expenses: expenses.length,
      },
    }
  },
})
```

### Usage

```bash
# Clear all data in development
bunx convex run dev:clearAllData
```

## Acceptance Criteria

- [x] `convex/dev.ts` created with `clearAllData` internal mutation
- [x] Mutation deletes all records from: expenses, documents, reimbursements (preserves ocrUsage)
- [x] Mutation deletes storage files (not just document records)
- [x] Returns count of deleted items
- [x] Runnable via `bunx convex run dev:clearAllData`

## Safety Considerations

- **Internal mutation only** - Cannot be called from frontend
- **No production guard needed** - Internal mutations require explicit CLI invocation
- **Order matters** - Delete reimbursements before expenses (referential integrity)
- **Storage cleanup** - Delete actual files, not just document records

## References

- [Convex Dashboard Data Management](https://docs.convex.dev/dashboard/deployments/data)
- [Convex Seeding Data for Preview Deployments](https://stack.convex.dev/seeding-data-for-preview-deployments)
- Schema: `convex/schema.ts`
