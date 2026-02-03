---
title: "TypeScript Build Checking Convex Backend Files"
category: build-errors
tags: [typescript, convex, tsc, build, monorepo]
module: build-config
symptoms:
  - "Cannot find name 'process'"
  - "tsc -b checking convex/*.ts files"
  - "Build fails on convex server-side code"
date: 2026-02-03
---

# TypeScript Build Checking Convex Backend Files

## Problem

When running `tsc -b && vite build` (project references mode), TypeScript was following imports from frontend `src/` files into `convex/` files and type-checking them with the wrong tsconfig.

**Error message:**
```
convex/ocr.ts(148,27): error TS2591: Cannot find name 'process'.
Do you need to install type definitions for node?
```

## Root Cause

The frontend tsconfig (`tsconfig.app.json`) has `types: ["vite/client"]` which doesn't include Node.js types. When TypeScript follows imports from `src/` → `convex/_generated/api` → `convex/*.ts`, it checks those files with the browser-oriented config instead of the Convex backend config.

The `tsc -b` (build mode) uses project references and follows all import chains, causing convex backend files to be checked with frontend settings.

## Solution

**Change the build command from project references mode to simple type-check:**

```json
// package.json
{
  "scripts": {
    "build": "tsc --noEmit && vite build"  // Not tsc -b
  }
}
```

**Why this works:**
- `tsc --noEmit` (without `-b`) uses the root tsconfig.json which has project references
- It properly delegates to each sub-project's tsconfig
- Convex files use `convex/tsconfig.json` which has `"types": ["node"]`
- Frontend files use `tsconfig.app.json` which has `"types": ["vite/client"]`

**Also ensure convex/tsconfig.json has Node types:**

```json
// convex/tsconfig.json
{
  "compilerOptions": {
    "types": ["node"],
    // ... other options
  }
}
```

## Prevention

1. Use `tsc --noEmit` for CI and build scripts, not `tsc -b`
2. Keep frontend and backend tsconfigs separate with appropriate type definitions
3. Convex backend code that uses Node.js globals needs `"types": ["node"]`
4. Don't mix browser and Node.js type contexts

## Related

- Convex has its own build system - backend compilation happens during `convex deploy`
- Frontend only needs to import from `convex/_generated/*` which are type declarations
