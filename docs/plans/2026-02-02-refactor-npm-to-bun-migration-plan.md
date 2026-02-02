---
title: "refactor: Migrate from npm to bun"
type: refactor
date: 2026-02-02
---

# Migrate from npm to bun

Replace npm with bun for faster installs and reduced disk usage.

## Tasks

- [x] Run `bun install` to generate `bun.lock`
- [x] Delete `package-lock.json`
- [x] Update `CLAUDE.md` - replace npm/npx with bun/bunx
- [x] Update `README.md` - update prerequisites and commands
- [x] Update `.claude/settings.local.json` - change bash permissions
- [x] Add `bun.lock` to git
- [x] Verify: `bun run build` works

## Files to Update

| File | Change |
|------|--------|
| `CLAUDE.md` | `npm install` → `bun install`, `npm run` → `bun run`, `npx` → `bunx` |
| `README.md` | Update prerequisites to "bun", update install commands |
| `.claude/settings.local.json` | Update permission patterns from npm to bun |
| `.gitignore` | N/A - `bun.lock` is text format, tracked normally |

## Delete

- `package-lock.json` (replaced by `bun.lockb`)

## Command Mapping

| npm | bun |
|-----|-----|
| `npm install` | `bun install` |
| `npm run dev` | `bun run dev` |
| `npm run build` | `bun run build` |
| `npx convex dev` | `bunx convex dev` |
| `npx shadcn@latest add` | `bunx shadcn@latest add` |
