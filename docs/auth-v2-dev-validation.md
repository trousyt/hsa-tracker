# Auth v2 Development validation: checklist and evidence ledger

Scope: remaining [#33](https://github.com/trousyt/hsa-tracker/issues/33) validation
following accepted [#30](https://github.com/trousyt/hsa-tracker/issues/30), with
[#31](https://github.com/trousyt/hsa-tracker/issues/31) backend and
[#32](https://github.com/trousyt/hsa-tracker/issues/32) UX integration. Parent
[#28](https://github.com/trousyt/hsa-tracker/issues/28) defines the requirements;
[#34](https://github.com/trousyt/hsa-tracker/issues/34) still requires explicit
production approval. See [deployment gates and production planning](DEPLOYMENT.md).

**Status:** documentation preparation only, based on checkpoint `502df8a`.
No application checks, real OAuth, backend commands, data writes or recovery were
performed in this documentation pass. Unchecked items below are planned checks,
not failures and not passing evidence. Do not close #33 from this document alone.

## Evidence ledger

Evidence classes: **historical accepted** means the owner's #30 acceptance report,
not a rerun; **source/fixture** means repository inspection, not live integration;
**remaining** means not established for the integrated candidate. Record actual
results against an exact revision and time before changing any remaining status.

| Boundary | Existing evidence and limits | Remaining acceptance |
| --- | --- | --- |
| Dev target and owner | **Historical accepted:** direct migration to the recorded Dev deployment, real GitHub login, returning sign-in and reload; trusted numeric-ID comparison matched owner | Reconfirm target/callback/origins privately and repeat on integrated #31/#32 candidate |
| Data preservation | **Historical accepted:** unchanged legacy app owner identity; owned financial/document records, blobs and historical audit references retained | Compare private baseline to candidate after validation, explain expected controlled-test deltas; no duplicates, reassignment or unowned-record claims |
| Secure-file live boundary | **Historical accepted:** owner success; absent/invalid/revoked credentials denied with no-store reported; audit increments reported only for valid access | Broader upload/preview/download, expired/other-user denial, CORS, content protections and audit behavior on current candidate |
| Automated checks | **Historical accepted:** typecheck, frontend/backend lint, non-watch tests, build and frozen install passed at #30; React Hook Form warning remained | New revision needs new results. Historical passes do not cover #31/#32 changes |
| Owner policy and sessions | **Source/fixture:** owner-resolution and callback tests, registered auth components and session-oriented HTTP tests exist | Confirm integrated test coverage and remaining real-provider/session gaps; bare identity injection is not bearer verification |
| OAuth callback concurrency and rollback | **Not E2E proven:** upstream transactional source reasoning and start/invalid-ticket fixtures only; public mounted-component HTTP harness limitation | Use supported public flow for retry/concurrency and safe denial evidence if feasible; explicitly record any remaining gap, no private-table seeding |
| Recovery | **Deferred to #33:** legacy state/config retained; backup including files reported, not reverified; no successful restore/recovery rehearsal | Keep unresolved, present owner-selected next step at planning gate. Owner does not want isolated restore; do not run one or reopen #30 |
| UX and browser | **Historical limited:** basic live login/reload, not full a11y/responsive/application acceptance | Full headed-browser sequence, session/error distinctions and representative application/document flows on integrated candidate |
| Production | **Not authorized:** no production result is claimed | Concrete fact-checked runbook, resolved controls/recovery decisions and explicit owner approval under #34 |

Historical source:
[#30 owner acceptance](https://github.com/trousyt/hsa-tracker/issues/30#issuecomment-6952949464).
The acceptance comment predates the local checkpoint commit; do not treat its
then-uncommitted wording as a current branch status or claim a current rerun.

Inspected source/fixture seams at this checkpoint (not executed here):

- [`authV2.test.ts`](../convex/authV2.test.ts): OAuth start and invalid-ticket path,
  not a successful mounted GitHub callback or callback rollback.
- [`githubOwner.test.ts`](../convex/githubOwner.test.ts) and
  [`ownerMigration.test.ts`](../convex/lib/ownerMigration.test.ts): callback/policy
  and ownership resolution, not provider E2E concurrency.
- [`http.test.ts`](../convex/http.test.ts) and
  [`fileAccess.test.ts`](../convex/fileAccess.test.ts): HTTP/session/ownership and
  audit fixtures; identity injection bypasses real bearer signature verification.

## Safe evidence handling

Keep raw baselines, backups and any necessary identity comparison private with the
owner-approved custodian. Public issues, commits and this ledger must contain only
sanitized outcomes such as `owner unchanged`, `relationships consistent`, HTTP
status/header expectations and approved evidence references. Do not publish user,
account, document or storage IDs; financial counts/amounts; file names/contents;
credentials; tokens; callback codes/state; environment dumps; or sensitive URLs.

For each future check record the candidate revision, timestamp, operator, evidence
class (live OAuth/browser, component fixture, source review or local check), action,
expected invariant, observed sanitized result and limitations. A skipped check stays
unverified with its reason; it is never inferred from a nearby passing test. Keep
screenshots in session-specific TEMP outside the repository, sanitized before
sharing. Do not capture private financial views or browser network credentials.

## Remaining validation sequence

### 1. Integrate locally and establish safety before remote work

- [ ] Integrate reviewed #31/#32 changes locally; record the exact candidate revision.
  Review test coverage and scripts at that revision. Keep docs changes separate
  from backend/UX implementation; do not infer deployed state from local commits.
- [ ] Confirm the owner-approved Dev target is still the recorded `bold-bee-347`,
  local frontend is `http://localhost:5173`, and the separate Dev OAuth app still
  uses `https://bold-bee-347.convex.site/oauth/github/callback`. These are historical
  facts until checked; do not change the shared v1 Production/Dev OAuth app.
- [ ] Verify running frontend/backend alignment, explicit redirect origins and
  independent secure-file CORS configuration without printing values or secrets.
- [ ] Confirm actual deployment/build triggers and credential scope before any
  remote step. Resolve preview safety before push/PR/merge; no such action is
  authorized by this checklist. Use an explicitly approved Dev validation/deploy
  procedure if one is needed for the new candidate; do not rerun the migration.
- [ ] Privately inventory the existing unique owner and legacy/v2 account linkage,
  numeric-ID consistency, record ownership/unowned state, document-to-storage
  relationships, blob availability and historical audit references. Stop on
  ambiguity, missing files, duplicate owners or unexpected claims/reassignment.
- [ ] Verify backup availability, coverage of app/auth/file bytes and private
  custody without assuming that a database export includes blobs. Record the
  unproven recovery limitation. No new migration/recovery writes follow from this
  step; recovery remains deferred, with no isolated restore requested.
- [ ] Agree any live test writes and their expected deltas with the owner. Do not
  delete existing test data, revoke all sessions, replace Dev data or mutate live
  owner-policy configuration to manufacture failure cases. Use isolated automated
  fixtures for malformed configuration and ambiguous mappings.

### 2. Collect integrated automated evidence

- [ ] After inspecting scripts for remote effects, run frozen install, typecheck,
  frontend/backend lint, non-watch tests and the approved local production build
  on the candidate. Record exact commands, outcomes and warnings. Vercel's build
  command is a backend deployment and must not be substituted for the local build.
- [ ] Run backend validation/code generation only with a separately approved exact
  Dev target and procedure; record whether it deploys/writes. Do not use a default
  target or claim this from typecheck. No backend command is supplied or authorized
  by this documentation-only preparation.
- [ ] Review realistic v2 session tests for missing/malformed allowlist, other
  account, returning-user mismatch, ambiguous/duplicate mappings, explicit empty
  initialization, no silent claims and rejected-link partial-state safety.
- [ ] Review secure-file HTTP tests for owner success, absent/invalid/expired/revoked
  sessions, wrong owner, invalid/missing documents and storage, allowed/disallowed
  origins, content protections and safe audit/logging behavior. Verify no-store on
  denial responses in the candidate; historical reporting is not a current pass.
- [ ] Review UX tests for observable sign-in start failure/retry, cancellation,
  callback failure/expiry, safe policy denial and duplicate-start pending state.
  Check established-session loss versus initial/loading, explicit sign-out and
  transient network trouble; do not add draft persistence.
- [ ] Label fixture limitations explicitly. Do not call private component APIs or
  seed private component tables to disguise the mounted-callback harness gap.

### 3. Headed-browser and live HTTP acceptance on approved Dev

A coordinator must arrange an exclusive browser session; this docs lane must not
use or stop a shared browser. All future automation must be headed. Start only
after target, allowed live writes and browser access are confirmed.

- [ ] From signed-out state, complete real owner GitHub OAuth. Check only the
  allowlisted owner can enter and the existing application user identity is
  unchanged. Confirm denied attempts cannot leave usable account/session state.
  If a safe other-account session is unavailable, record that live denial as
  unverified; fixture denial is not a substitute.
- [ ] Reload and exercise session refresh, deliberate sign-out and sign-in again.
  Initial arrival and deliberate sign-out must not show an expiry warning.
- [ ] Cancel OAuth where feasible; check callback failure/expiry and safe policy
  denial with retry. Use focused UI tests for hard-to-reproduce states, labeled as
  fixtures, not live OAuth. Generic OAuth failure must not be labeled owner denial.
- [ ] Safely verify actual established-session loss/expiry or revocation using an
  approved test session, not a broad credential reset. Verify protected access is
  denied afterward. Distinguish a temporary network interruption from session loss.
- [ ] Exercise supported public sign-in retry/concurrency paths without private
  component writes; compare linkage afterward for duplicate owner/account/usable
  partial sessions. Successful parallel logins alone do not prove failure rollback.
  Record exact coverage and any unexercised transactional rollback case.
- [ ] View dashboard, expense, reimbursement and optimizer flows. Use existing data
  read-only where possible; any agreed create/edit/reimbursement smoke writes need
  an expected-delta record. No financial-data cleanup is implied.
- [ ] With an owner-approved non-sensitive document, verify upload, preview and
  download through authenticated requests; compare content privately. Confirm
  storage/metadata linkage and audit behavior. Agree retention; do not delete
  existing documents or assume uploads are read-only.
- [ ] Check real secure-file HTTP owner success and absent/invalid/expired/revoked
  and other-user denial. Inspect status, no-store, CORS and content protections
  without copying tokens/IDs into reports. Confirm disallowed origins cannot read
  responses and anonymous failures do not create attacker-controlled audit writes.
- [ ] Verify keyboard Tab/Enter operation, accessible names, pending/disabled
  behavior, duplicate-start prevention, visible focus and alert/live announcements
  in sign-in/error/session-loss flows; inspect the accessibility tree.
- [ ] At 375x667, 768x1024 and 1280x800, check layout/overflow and control usability.
  Take sanitized screenshots in session TEMP, inspect key elements at useful zoom,
  and record accessibility/responsive findings separately from functionality.

### 4. Reconcile evidence and request the next decision

- [ ] Compare the private pre/post baseline: identical application owner, consistent
  trusted linkage, no duplicate owner/unintended claims, retained ownership and
  blobs, intact historical audits. Explain only agreed test-write/access-audit
  deltas; stop and investigate any unexplained change rather than hiding it.
- [ ] Fill the ledger with revision-specific results and explicit gaps. Retain
  callback concurrency/rollback, other-user/expired-session and recovery limitations
  unless the corresponding boundary was actually exercised.
- [ ] Present the integrated Dev evidence and unresolved recovery decision to the
  owner. Direct Dev migration acceptance stands; do not reopen #30 or silently
  waive the remaining #33 requirements. No isolated restore is requested.
- [ ] Resolve production questions and complete the executable runbook from
  [DEPLOYMENT.md](DEPLOYMENT.md) before seeking explicit #34 approval. Do not assert
  #33 complete, #34 ready, or production authorized from documentation preparation.
