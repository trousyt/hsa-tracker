# Deployment and Auth v2 cutover guide

## Current gate: Development validation, not production authorization

This is the runbook for [#33](https://github.com/trousyt/hsa-tracker/issues/33),
under [#28](https://github.com/trousyt/hsa-tracker/issues/28). Use the
[Development validation checklist and evidence ledger](auth-v2-dev-validation.md)
before proposing the production cutover in
[#34](https://github.com/trousyt/hsa-tracker/issues/34).

The owner accepted the direct Development migration in
[#30's acceptance comment](https://github.com/trousyt/hsa-tracker/issues/30#issuecomment-6952949464),
with incomplete evidence explicitly recorded. Do not reopen that decision or
repeat the migration. Recovery rehearsal was deferred to #33; **no restore has
been proven**, and the owner does not want an isolated restore. This document
neither authorizes recovery execution nor changes that decision. Keep the recovery
gap visible for the owner at the production planning gate.

No production deployment, migration, push, merge, OAuth change, destructive
operation or legacy cleanup is authorized by this guide. Local documentation
commits are not release approval. #31 backend and #32 UX changes require integrated
Development validation; historical #30 results are not results for those changes.

## Deployment paths and controls

Inspect these files again at the exact candidate revision before running any
build or deployment command:

- [`vercel.json`](../vercel.json) currently runs
  `bunx convex deploy --yes && bun run build`. A hosting build can deploy the
  backend **before** building the frontend. A failed frontend build is not a
  backend rollback.
- [`package.json`](../package.json) currently defines the local `build` script as
  `tsc --noEmit && vite build`. It is not the Vercel build command. Do not assume
  future scripts are equally local.
- [CI](../.github/workflows/ci.yml) runs checks on master pushes and pull requests;
  [Release](../.github/workflows/release.yml) runs on master pushes. Neither file
  establishes that Vercel waits for CI or targets an isolated preview backend.

Before any remote action, an authorized operator must confirm the actual Vercel
project, Git triggers, build/deploy credentials' environment scope, backend target
and controls preventing automatic deployments. Record control verification without
credential values. Branch protection alone does not prove hosting builds are
blocked. **Preview isolation and CI-before-deploy ordering are unverified**; do not
open a PR, push or merge on an assumption that preview deployment is safe. PR-preview
design remains out of scope. The unresolved preview safety question must be
settled before using a remote workflow that could start a build.

This documentation-only lane performs no build, backend validation, deploy or
browser operation. Its local checks are links, whitespace and runbook consistency.

## Development configuration reference

The following target facts are recorded from #30 and the prior runbook, **not
reverified in this documentation pass**:

- Development deployment: `bold-bee-347`.
- Local frontend origin: `http://localhost:5173`.
- Separate Development GitHub OAuth app callback:
  `https://bold-bee-347.convex.site/oauth/github/callback`.
- The v1 OAuth app was shared with Production. The separate Development app
  avoided changing that shared app. Do not modify the shared callback for Dev.

Before an authorized Development validation session, privately confirm that the
running frontend, backend, callback and component credentials refer to that same
Development environment. Do not infer the target from a branch name or copy a
production deploy key into a local session. Do not print environment values.

| Server-side Development setting | Required verification |
| --- | --- |
| `AUTH_GITHUB_CLIENT_ID` | Separate Development GitHub OAuth app, not the shared v1 app |
| `AUTH_GITHUB_CLIENT_SECRET` | Bound to that app's GitHub component; secret-safe handling only |
| `OWNER_GITHUB_ID` | Verified immutable numeric GitHub ID as a decimal string, matching trusted legacy owner linkage; never match by email or username |
| `AUTH_ALLOWED_REDIRECT_ORIGINS` | Explicit bare frontend origins; localhost origin above for local validation. Missing/malformed/wildcard or non-local HTTP origins must fail closed |
| `SITE_URL` | Independently verify the intended secure-file CORS origin; OAuth redirect allowlisting is not file CORS configuration |

Preserve legacy auth tables, schema, signing configuration and credentials. Do not
remove the legacy dependency simply because v2 login works: recovery code still
uses it at the #30 checkpoint. No replacement of Development data is allowed for
convenience. If replacement becomes absolutely necessary, stop and obtain separate
explicit approval.

## Production planning sequence — blocked and non-executable

The following is an ordered planning gate, **not a concrete approved production
runbook**. No production target/origin, OAuth-app choice, deployment controls,
backup custodian, freeze owner or recovery method has been confirmed here. Do not
substitute guessed values or execute commands from a generic deployment tutorial.

1. **Review Development evidence.** Integrate #31 and #32, identify the exact
   candidate revision, complete or explicitly disposition the checklist in the
   [ledger](auth-v2-dev-validation.md), and present limitations to the owner.
   Callback concurrency/rollback and recovery are not proven by a successful login.
2. **Resolve production facts privately.** Confirm the actual Convex deployment,
   Vercel project, frontend origin(s), numeric owner linkage and selected GitHub
   OAuth app/callback. Decide how to coordinate callback and component credentials
   without disrupting the current production login. Do not copy Dev configuration.
3. **Verify deploy controls.** Record the actual controls preventing builds,
   pushes/merges or release workflows from bypassing approval, including credential
   scope and preview behavior. Retain the known-good frontend/backend revisions
   and legacy auth configuration via an approved private location.
4. **Agree maintenance and writes.** Name the operator and owner responsible for
   the maintenance window, write freeze, communications, abort decision and reopen
   decision. Reauthentication is expected. A UI notice alone is not a server-side
   write freeze; select and approve the actual mechanism before execution.
5. **Resolve backup and recovery readiness.** Confirm a fresh backup covers
   application records, auth state and stored file bytes, not merely metadata.
   Identify its private custodian/access and integrity-verification method without
   publishing paths or contents. Recovery rehearsal remains deferred; request an
   owner decision on the remaining recovery evidence and acceptable method, not an
   unrequested isolated restore. No restore or data replacement is authorized.
6. **Write the executable cutover and rollback steps.** Using only confirmed facts,
   specify target-checked commands/configuration actions, operators, old/new OAuth
   ordering, backend/frontend release order and verification/abort points. Account
   for Vercel's backend-first build path. Define how maintenance is enforced and
   how the known-good revision can be restored without removing authorization.
7. **Obtain explicit #34 approval.** Present the concrete sequence, exact candidate,
   current Dev evidence, recovery limitations and write policy to the owner. Record
   explicit production approval and its scope before any deployment/migration.
   Ticket readiness, #30 acceptance and local-commit permission are not that approval.
8. **Only under that approval, execute and verify.** During the agreed freeze,
   capture fresh private integrity evidence, apply the approved coordinated changes,
   reauthenticate the owner, compare owner/linkage/storage/audit invariants and test
   protected reads/files before permitting normal use. Use controlled smoke writes
   only as approved. Monitor auth failures, ownership misses and file denials with
   sanitized status/invariant reporting, not tokens or financial contents.
9. **Abort/recovery decision.** Identity mismatch, lost data/files, unauthorized
   access or unrecoverable login/file failure is a stop condition. Keep writes
   frozen, preserve diagnostic and post-cutover data, and use only the approved
   recovery plan. A package downgrade is not a recovery plan. A stale snapshot must
   never overwrite newer financial writes without explicit reconciliation approval.
   Do not delete new auth state or disable authorization to restore access.
10. **Report and reopen deliberately.** Record actual results, remaining gaps and
    the owner's decision to resume normal use. Keep legacy auth and recovery state;
    cleanup and PR-preview work require separate approval.

## Questions for the production planning gate

- What are the confirmed production target, frontend origin(s) and OAuth-app choice,
  and who can make the coordinated configuration changes?
- Which actual auto-deploy/preview controls prevent unintended backend deployment?
- Who owns maintenance, the write-freeze mechanism, aborts and reopening?
- Is a fresh application/auth/file backup available, who controls it privately,
  and what recovery method/evidence does the owner accept given deferred rehearsal?
- What exact release/recovery sequence and post-cutover-write reconciliation policy
  will the owner approve after reviewing integrated Development evidence?

These unanswered production questions do not block local #31/#32 implementation.
They do block describing #34 as ready or executing a production cutover.
