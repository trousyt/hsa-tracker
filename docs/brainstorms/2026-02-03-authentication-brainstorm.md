# Authentication Brainstorm

**Date:** 2026-02-03
**Status:** Decision Made

## What We're Building

Add authentication to the HSA Tracker to restrict access when deployed publicly. This is a single-user application where the owner needs to be the only person who can access their HSA expense data.

### Requirements

- Single user (the owner) needs exclusive access
- Social login (GitHub) as the authentication method
- Deployed publicly on the internet
- **Critical:** Long-term reliability (10-15 year horizon for HSA tracking)
- Simple implementation with minimal dependencies

## Why Convex Auth

### Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Clerk** | Best docs, pre-built components, 10k free MAUs | Third-party dependency, longevity risk |
| **Convex Auth** | No external service, ties auth to data layer | Beta status, more setup code |
| **Better Auth** | Open source, flexible | Newest option, most complex setup |

### Decision: Convex Auth

**Primary reason:** Minimizes external dependencies for a 10-15 year horizon.

**Rationale:**
1. No additional service to worry about staying in business
2. Auth fate tied to Convex - if Convex dies, data is gone anyway
3. Reduces points of failure from 3 services to 2
4. Free - no pricing changes to worry about
5. Beta status acceptable for single-user app (not hitting edge cases at scale)

## Key Decisions

1. **Auth provider:** Convex Auth (native)
2. **Login method:** GitHub social login
3. **User model:** Single authorized user (owner only)
4. **Data isolation:** Add `userId` field to all tables, filter all queries

## Implementation Notes

### Schema Changes Needed
- Add `userId: v.string()` to `expenses`, `documents`, `reimbursements` tables
- Add `by_user` indexes for efficient queries

### Backend Changes Needed
- Add auth checks to all queries and mutations
- Filter all data access by `userId`

### Frontend Changes Needed
- Wrap app with Convex Auth provider
- Add sign-in/sign-out UI
- Handle authenticated/unauthenticated states

## Open Questions

1. **Backup strategy:** Set up regular data exports for long-term data portability (future enhancement)

## Resolved Questions

1. **Allowed users:** First user to sign in becomes the owner; all subsequent sign-in attempts are blocked
2. **Data migration:** Existing data will be assigned to the first user who signs in

## Next Steps

Run `/workflows:plan` to create detailed implementation plan.
