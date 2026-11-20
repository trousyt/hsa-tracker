# Auth v2 Development validation: checklist and evidence ledger

Scope: remaining [#33](https://github.com/trousyt/hsa-tracker/issues/33) validation
following accepted [#30](https://github.com/trousyt/hsa-tracker/issues/30), with
[#31](https://github.com/trousyt/hsa-tracker/issues/31) backend and
[#32](https://github.com/trousyt/hsa-tracker/issues/32) UX integration. Parent
[#28](https://github.com/trousyt/hsa-tracker/issues/28) defines the requirements;
[#34](https://github.com/trousyt/hsa-tracker/issues/34) still requires explicit
production approval. See [deployment gates and production planning](DEPLOYMENT.md).

**Status:** owner-approved Dev deployment/live checks ran on `24d02b1` on
2026-11-19. Five observed accessibility defects were fixed in independently reviewed
frontend-only lanes, integrated and retested on
`5c6b55eed954016d8dd596726f5643425115528f` on 2026-11-20. The new local suite passes
291 tests; the scoped live accessibility retest results and fixture limits are below.
The earlier documentation-only and 2026-11-17 local results remain historical evidence,
not current live results. Compound unchecked items below retain their unverified
parts. This does not establish overall completion of #31, #32 or #33, or authorize
Production. Recovery/concurrency limitations remain unchanged.

## Evidence ledger

Evidence classes: **historical accepted** means the owner's #30 acceptance report,
not a rerun; **source/fixture** means repository inspection, not live integration;
**remaining** means not established for the integrated candidate. Record actual
results against an exact revision and time before changing any remaining status.

| Boundary | Existing evidence and limits | Remaining acceptance |
| --- | --- | --- |
| Dev target and owner | **Historical accepted:** trusted numeric-ID comparison matched owner. **2026-11-19/20 live:** approved Dev/frontend alignment privately verified and real owner GitHub OAuth completed | Provider-console app binding and private pre/post owner/linkage reconciliation not independently repeated |
| Data preservation | **Historical accepted:** unchanged legacy app owner identity; owned financial/document records, blobs and historical audit references retained | Compare private baseline to candidate after validation, explain expected controlled-test deltas; no duplicates, reassignment or unowned-record claims |
| Secure-file live boundary | **2026-11-19 live at `24d02b1`:** existing image preview/download byte equality; owner response protections; absent/malformed/signed-out-session denial; HTTP CORS preflight. **2026-11-20:** same backend retained; existing image reads for focus retests | Upload/PDF coverage, natural expiry/other-user denial, independent audit reconciliation and broader browser-origin CORS proof remain unverified |
| Automated checks | **2026-11-20 local at `5c6b55e`:** frozen install; root/app/node/Convex typechecks; lint with one existing warning; 291 tests in 27 files; local build and diff checks passed | Local checks do not establish bearer expiry/other-user denial or overall live acceptance |
| Owner policy and sessions | **Source/fixture:** owner-resolution and callback tests, registered auth components and session-oriented HTTP tests exist | Confirm integrated test coverage and remaining real-provider/session gaps; bare identity injection is not bearer verification |
| OAuth callback concurrency and rollback | **Not E2E proven:** upstream transactional source reasoning and start/invalid-ticket fixtures only; public mounted-component HTTP harness limitation | Use supported public flow for retry/concurrency and safe denial evidence if feasible; explicitly record any remaining gap, no private-table seeding |
| Recovery | **Deferred to #33:** legacy state/config retained; backup including files reported, not reverified; no successful restore/recovery rehearsal | Keep unresolved, present owner-selected next step at planning gate. Owner does not want isolated restore; do not run one or reopen #30 |
| UX and browser | **2026-11-19 live:** OAuth/refresh/signout/returning login, current-session other-tab loss/recovery, brief network distinction. **2026-11-20 live:** scoped five-defect retest passes at three sizes/light and dark; zero axe violations, with incomplete contrast checks disclosed below | Natural expiry, other-owner/provider denial/cancellation, full screen-reader speech and preservation reconciliation remain unverified; synthetic callback/fallback cases are not provider/data-reactivity proof |
| Production | **Not authorized:** no production result is claimed | Concrete fact-checked runbook, resolved controls/recovery decisions and explicit owner approval under #34 |

Historical source:
[#30 owner acceptance](https://github.com/trousyt/hsa-tracker/issues/30#issuecomment-6952949464).
The acceptance comment predates the local checkpoint commit; do not treat its
then-uncommitted wording as a current branch status or claim a current rerun.

Source/fixture seams inspected in the original documentation pass (the current
integrated automated run below also executed these tests):

- [`authV2.test.ts`](../convex/authV2.test.ts): OAuth start and invalid-ticket path,
  not a successful mounted GitHub callback or callback rollback.
- [`githubOwner.test.ts`](../convex/githubOwner.test.ts) and
  [`ownerMigration.test.ts`](../convex/lib/ownerMigration.test.ts): callback/policy
  and ownership resolution, not provider E2E concurrency.
- [`http.test.ts`](../convex/http.test.ts) and
  [`fileAccess.test.ts`](../convex/fileAccess.test.ts): HTTP/session/ownership and
  audit fixtures; identity injection bypasses real bearer signature verification.

## 2026-11-19 live baseline and 2026-11-20 accessibility retest

Operator: serialized implementation/runtime worker, exclusive headed browser.
Environment: Windows, Node v24.21.0, Bun 1.4.2, agent-browser 0.38.1 and installed
Playwright connected over CDP to the same headed Chrome. No headless browser was used.

### Prior live baseline (2026-11-19, `24d02b14904f869abbe5efb450b6fe85a2fc0f77`)

Under explicit owner approval, the exact Dev-only command
`node node_modules/convex/bin/main.js dev --once --env-file .env.local --typecheck enable --codegen disable --tail-logs disable`
completed at 17:11:33 UTC with exit 0 and no data-loss/incompatibility warning.
Target/key presence checks were private. Secure-file preflight changed from the
older backend fingerprint to expected CORS/no-store/nosniff. No migration or recovery ran.

Live owner OAuth, authenticated reload with actual refresh HTTP 200, deliberate
signout, returning sign-in, duplicate-start suppression and current-session
other-tab signout/recovery passed. Other-tab loss and signed-out-token denial are
invalidation evidence, **not natural expiry**. A brief offline/online interruption
did not falsely show session loss. Existing image preview/download bytes matched
privately; owner HTTP 200 protections and absent/malformed/signed-out credential
401 denials were checked. HTTP preflight rejected a disallowed requested origin;
this was not an authenticated separate-browser-origin exploit test. Crafted
invalid/generic callback UI checks were client-input fixtures, not provider failures.
Five application accessibility findings prompted the reviewed follow-up below.

### Integrated frontend-only revision and local checks (2026-11-20)

Clean starting HEAD: `24d02b14904f869abbe5efb450b6fe85a2fc0f77`.
Cherry-picked in approved order without conflicts:

| Reviewed source commit | Integrated commit | Scope |
| --- | --- | --- |
| `e9455cd590f051614640f75f2f08955ac81a4cb7` | `6bf93bdec9dd21b310bb9aaa56e4c201ab9fb405` | Viewer origin focus, desktop filter names, Actions header and tests |
| `6543c97d5d1a28d4fa1775e9ccbdcfa936867a21` | `c7a797026b812f8c41f5a526dcc17609017ef244` | Explicit surviving-gallery fallback and tests |
| `61d0ef7e55d5bf6d51598dc2ce25d69851098fa3` | `5c6b55eed954016d8dd596726f5643425115528f` | Main landmark, real SVG chart names, scoped contrast and tests |

Frozen install, all four explicit root/app/node/Convex typechecks, lint,
`bun run test:run`, local `bun run build` and working/index/range diff checks passed
before browser testing. Result: **291 tests in 27 files**. Lint retained the existing
`expense-form.tsx:147` incompatible-library warning; Vitest retained the existing
native-config-loader/`__dirname` warning. The local build transformed 3607 modules.
Backend, dependency/lockfile and Vite configuration diffs against `24d02b1` were empty.
No backend deployment or codegen was needed or performed on 2026-11-20.

The previous Vite listener was gone. After separate approval, a new strict-port,
localhost-only server started from this worktree. All eight changed application
modules' served source-map `sourcesContent` exactly matched local files. The
candidate version, Dev frontend target and unchanged deployed secure-file header
fingerprint were verified before accepting browser evidence. Real GitHub OAuth
required owner interaction and completed successfully on this candidate.

### Live five-defect retest (2026-11-20, 17:33-17:38 UTC)

| Defect/boundary | Executed result and evidence class |
| --- | --- |
| Viewer close focus | **Live existing-document/native keyboard:** Escape and keyboard-activated Close restore the exact clicked View document button at 375x667, 768x1024 and 1280x800; subsequent Tab stays in expense detail. Existing image decoded. Distinct multiple-trigger live coverage was not established. |
| Disconnected origin | **Synthetic reversible DOM perturbation on live UI:** temporarily detached only the clicked button, closed viewer, confirmed explicit named gallery-region focus and Tab continuity, then restored the same DOM node. No document or record was removed. |
| Loading/empty gallery | **Synthetic client-only component fixture:** bundled the actual gallery/viewer/Radix components with mocked query/file inputs and no backend calls. Loaded-to-loading and loaded-to-empty transitions retained the identical connected gallery root and restored focus there when viewer unmounted. This is not live database reactivity proof. |
| Desktop filter names | **Live accessibility tree/native keyboard:** visible combobox names are Filter by status and Filter by category; keyboard opens each listbox and Escape restores focus. |
| Main landmark | **Live DOM/axe:** exactly one main on Dashboard, Expenses and Optimizer at every tested size/theme. |
| Chart ARIA/contrast | **Live DOM/native keyboard/axe:** names are on actual focusable `svg[role=application]`; arrow-key focus and both range controls' Enter behavior work at each size/theme; desktop maximize/close also passes. Inactive range minimum contrast is 18.16:1 light / 14.50:1 dark; warning value is 4.93:1 light / 11.39:1 dark, computed from actual CSS colors without reading financial text. |
| Actions header | **Live accessibility tree/axe:** columnheader accessible name is Actions. |

All three tabs at all three sizes in light and dark produced **zero axe violations**
(18 audits). Most audits retain one incomplete color-contrast item, so this is not
an assertion of completely automated accessibility clearance. Explicit computed-color
review covers the patched range/warning text; full screen-reader speech and all
remaining incomplete targets are not proven. Light/dark was a reversible frontend
root-class toggle, restored afterward; no backend or shared preference changed.

No horizontal page overflow or error boundary appeared. Screenshots were limited
to nonfinancial header/chart-control crops and clearly synthetic fixture views;
these were inspected for spacing, visibility, colors and focus. No financial view
or real document content was captured. Initial agent-browser click/Enter commands
were no-ops and are not passing input evidence; actual keyboard checks used installed
Playwright over the same headed CDP connection. A dynamic-selector range assertion
initially reselected another button; stable same-element retests passed both ranges.

Session-specific TEMP evidence, retained outside Git:
`auth-v2-acceptance-20261118-2357/accessibility-live-retest-20261120.json`,
`accessibility-keyboard-retest-20261120.json`,
`accessibility-fixture-chart-retest-20261120.json`, and
`accessibility-contrast-review-20261120.json`. Earlier dated evidence remains
unchanged. Private downloaded document evidence must not be published.

**Remaining:** natural expiry/other-owner/provider cancellation and failure; private
owner/linkage/data/blob/audit reconciliation; PDF/upload and financial-write smoke
coverage; full screen-reader speech and incomplete axe targets. Normal auth state
and permitted document-access audits occurred, but no financial mutations, uploads,
paid OCR, deletion, OAuth configuration changes, recovery, production action or
remote Git operation occurred. Existing recovery/concurrency limitations stand.
This ledger update is documentation-only after the tested application revision;
it does not establish overall #33 completion or #34 readiness.

## Historical 2026-11-17 integrated local automated evidence

Recorded 2026-11-17 at 17:43 UTC by the implementation agent, on Windows with
Bun 1.4.2 and Node v24.21.0. Evidence class: **local automated/source review** only.
Candidate branch: `feat/auth-v2-integration`; exact checked revision:
`300a6b00173c5943322d15bddbf7fa9e71e731c6`.

Local chain after #30 checkpoint `502df8aec40c29e126895363ad5619b914a7d03e`:

- #31: `04fc4052976ab3a68ce5d72dc8b9936d24fc3843` (exact reviewed 16-file scope).
- #32: `dbb880499838d121b94671d93db35d53de97c50a`, cherry-picked without conflicts
  from `66564e751d38c4dffca5983f4d18e9856220e69d`.
- #33 docs: `300a6b00173c5943322d15bddbf7fa9e71e731c6`, cherry-picked without
  conflicts from `1e8d35e22b6cf0a29a5a4af31ebc44f973125021`; verified changes only
  `docs/DEPLOYMENT.md` and this ledger. This evidence update is a later docs-only
  commit and does not change the tested application tree.

| Executed command/check | Observed sanitized result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed; lockfile unchanged; run before `bunx` |
| `bunx --no-install tsc --noEmit` | Passed (root references config; explicit project checks below also ran) |
| `bunx --no-install tsc -p tsconfig.app.json --noEmit` | Passed |
| `bunx --no-install tsc -p tsconfig.node.json --noEmit` | Passed |
| `bunx --no-install tsc -p convex/tsconfig.json --noEmit` | Passed; no Convex CLI or code generation |
| `bun run lint` | Passed, 0 errors; existing `react-hooks/incompatible-library` warning at `expense-form.tsx:147` |
| `bun run test:run` | Passed: 271 tests in 22 files; Vitest warned about future native config-loader support for `__dirname` |
| `bun run build` | Passed: local `tsc --noEmit && vite build`, 3607 modules transformed; scripts and Vite config inspected first; no Vercel/backend build |
| `git diff --check`; `git diff --cached --check`; `git diff 502df8aec40c29e126895363ad5619b914a7d03e..HEAD --check` | Passed; clean worktree/index at checked candidate |
| Bun inline documentation link-target check | Passed: 13 local Markdown link targets across the two docs; external URLs not requested |
| Source review and Bun inline exact owner-denial contract check | Backend emits `ConvexError({ code: "OWNER_ACCESS_DENIED" })` only for a confirmed different valid numeric GitHub ID; frontend requires `ConvexError` and that exact structured code |

The executed suite includes backend callback denial/configuration fixtures and
frontend safe-code/generic-error tests, including mocked public HTTP transport
reconstruction. Configuration/mapping failures are not presented as owner denial.
This is not evidence of real GitHub callback propagation, mounted-component
successful OAuth rollback/concurrency, deployed bearer signature/token-expiry
verification, deployment upload transport, visual/a11y/responsive acceptance or
live data preservation. Tests use isolated in-memory fixtures, not live records.

No push, PR, merge into master, deployment, backend/live-data/OAuth/browser action,
process-management operation or recovery was performed. Production remains an explicit approval gate;
recovery remains deferred. The separate configuration commit `f7cc37d` is excluded.

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

- [x] Integrate reviewed #31/#32 changes locally; record the exact candidate revision.
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

- [x] After inspecting scripts for remote effects, run frozen install, typecheck,
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
