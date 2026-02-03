---
date: 2026-02-03
topic: deployment-readiness
---

# Deployment Readiness: CI/CD, Vercel, and Expense Categories

## What We're Building

Three features to make the HSA Tracker production-ready:

1. **HSA Qualified Medical Expense Categories** - Add optional category field to expenses based on IRS Publication 502, with ~15-20 predefined categories. Supports filtering to find uncategorized expenses.

2. **GitHub Actions CI/CD** - Automated quality gates on PRs: type checking, linting, unit tests, and build verification.

3. **Vercel Deployment** - Auto-deploy to production on merge to main, with preview deploys for PRs.

## Why This Approach

### Expense Categories
- **Optional field** chosen because existing data lacks categories; user wants to backfill incrementally
- **Predefined IRS-aligned list** ensures compliance without complexity of custom categories
- **~15-20 core categories** balances comprehensiveness with usability (not too granular)
- Existing expenses remain uncategorized; filter UI enables bulk assignment workflow

### CI/CD
- **Bun-based workflow** matches existing tooling for fast CI runs
- **Build + Type + Lint + Tests** covers quality without E2E overhead (can add later)
- Runs on PRs and pushes to main

### Vercel Deployment
- **Auto-deploy main** with PR previews is standard, low-friction approach
- Convex production already exists, so only frontend deployment needed
- Config files + setup guide balances automation with manual account creation

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Category required? | Optional | Existing data lacks categories; backfill later |
| Category scope | ~15-20 predefined | IRS Pub 502 aligned, manageable list |
| Custom categories? | No | Simplicity, IRS compliance |
| Existing expenses | Leave uncategorized | Filter UI enables incremental assignment |
| CI checks | Build + Type + Lint + Unit tests | Core quality gates without E2E overhead |
| Deploy trigger | Auto on main, previews on PRs | Standard Vercel pattern |
| Vercel setup | Config files + instructions | Auto-config where possible |

## Proposed Category List (IRS Pub 502 Based)

1. Medical Services (doctor visits, specialists, exams)
2. Dental Care (fillings, extractions, dentures, braces)
3. Vision Care (exams, glasses, contacts, surgery)
4. Prescriptions (Rx drugs, insulin)
5. Mental Health (therapy, psychiatry, counseling)
6. Hospital/Facility (inpatient, outpatient, ER)
7. Lab & Diagnostic (blood work, imaging, tests)
8. Physical Therapy
9. Chiropractic
10. Medical Equipment (monitors, CPAP, mobility aids)
11. Medical Supplies (bandages, first aid, OTC eligible items)
12. Hearing (exams, hearing aids, batteries)
13. Nursing/Home Care
14. Transportation (medical travel, mileage, parking)
15. Long-Term Care
16. Preventive Care (vaccines, screenings)
17. Other Qualified Expense

## Open Questions

- Should category selection support search/autocomplete, or is a simple dropdown sufficient for ~17 items?
- Any additional reporting views needed (spending by category over time)?

## Next Steps

1. Add `category` field to Convex schema (optional string, indexed)
2. Create category constants file with display names
3. Update expense form with category dropdown
4. Add category column and filter to expense table
5. Create `.github/workflows/ci.yml` for GitHub Actions
6. Create `vercel.json` and deployment guide
7. Document environment variables needed

→ `/workflows:plan` for implementation details
