# Deployment Guide

This guide explains how to deploy HSA Tracker to Vercel with Convex backend.

> **Auth v2 migration gate:** Do not deploy, push, or merge this migration until the
> Development identity-preservation checks have passed and the owner explicitly
> approves production deployment. The Development backup includes files, but a
> restore rehearsal was deferred and has **not** been verified. Automatic Vercel
> builds can deploy Convex; control those triggers before pushing or merging.
> The existing GitHub OAuth app is shared by Development and Production: do not
> alter it for this proof.

## Prerequisites

- GitHub repository with this code
- Convex production deployment (already exists)
- Vercel account

## Auth v2 Development configuration and acceptance

The v2 core and GitHub components use these **server-side Convex Development**
settings. Configure them only on the explicitly verified Development deployment,
using a secret-safe mechanism; never put credentials in the repository or logs.
Do not change or remove existing v1 environment variables, signing configuration,
auth tables or state: they are retained for recovery.

| Variable | Purpose |
|----------|---------|
| `AUTH_GITHUB_CLIENT_ID` | Client ID of the separate Development GitHub OAuth app |
| `AUTH_GITHUB_CLIENT_SECRET` | Secret of that Development app, bound only to its GitHub component |
| `OWNER_GITHUB_ID` | Owner's verified immutable numeric GitHub account ID as a decimal string; verify against the legacy owner account linkage, not email or username |
| `AUTH_ALLOWED_REDIRECT_ORIGINS` | Comma-separated explicit bare frontend origins; for local Development use `http://localhost:5173`. Missing, malformed, wildcard and non-local HTTP origins fail closed. |

Register `https://bold-bee-347.convex.site/oauth/github/callback` on the **separate
Development** GitHub OAuth app. The component is mounted at `/oauth/github`, so
this callback is distinct from the v1 route. Do not add it to or otherwise modify
the shared Development/Production v1 OAuth app. For any future environment,
explicitly configure its actual frontend origins and callback; there is no default
production origin. Its production configuration and cutover require separate
approval after Development validation.

Before a reviewed Development deploy, compare non-sensitive preflight counts and
booleans for the unique owner and matching numeric legacy account, ownership and
unowned records, audit rows, document relationships and file-storage existence.
Stop on ambiguity; do not claim or reassign records. After deploy, the owner must
use a headed browser for real GitHub OAuth and verify that the existing application
user ID and owned records remain unchanged. Repeat sign-in and exercise concurrent
sign-ins, denied access and failure/retry paths; verify no duplicate account, owner
or usable partial session remains. Compare the non-sensitive invariants afterward.

The local `convex-test` GitHub component helpers register component functions but
its public `t.fetch` routes the root HTTP router, not a mounted component's OAuth
callback. Thus the local start/invalid-ticket tests do **not** prove a successful
GitHub callback or its transaction rollback. Complete that proof on the approved
Development callback and real provider flow; do not call private component APIs
or seed private component tables to simulate it. Likewise, `withIdentity` HTTP
tests exercise session lookup and ownership but bypass real bearer JWT signature
verification. On the approved Development deployment, verify actual HTTP requests
from the signed-in browser for owner success and absent, invalid, revoked and
other-user denial; record only status/invariant results, never tokens, financial
records or sensitive screenshots. A successful login alone does not establish
concurrency, rollback or recovery.

## Setup Steps

### 1. Get Convex Deploy Key

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings** → **Deploy Key**
4. Copy the deploy key

### 2. Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Vercel will auto-detect Vite framework

### 3. Configure Environment Variables

In Vercel Project Settings → Environment Variables, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `CONVEX_DEPLOY_KEY` | Your deploy key from step 1 | Production & Preview |
| `VITE_CONVEX_URL` | `https://your-deployment.convex.cloud` | Production only |

**Important:** Mark `CONVEX_DEPLOY_KEY` as **Sensitive**.

### 4. Deploy

Click **Deploy**. Vercel will:
- Run `bun install`
- Run the build command from `vercel.json`
- Deploy to production

## How It Works

### Production Deploys (master branch)

When you merge to master:
1. GitHub Actions CI runs (type check, lint, test, build)
2. If CI passes, Vercel deploys
3. Vercel runs `bunx convex deploy` to update Convex production
4. Vercel builds and deploys the frontend

### Preview Deploys (PR branches)

When you open a PR:
1. GitHub Actions CI runs
2. Vercel creates a preview deployment
3. Vercel runs `bunx convex deploy --preview <branch>` to create isolated Convex preview
4. Preview URL connects to the isolated Convex backend

**Safety:** PR schema changes only affect the preview Convex deployment, not production.

## Branch Protection (Recommended)

After first successful deployment, enable branch protection:

1. Go to GitHub repo → Settings → Branches
2. Add rule for `master`
3. Enable "Require status checks to pass before merging"
4. Select the CI checks: `typecheck`, `lint`, `test`, `build`

## Troubleshooting

### Build fails with "CONVEX_DEPLOY_KEY not set"

Ensure the environment variable is added in Vercel and available to both Production and Preview environments.

### Preview deployment shows wrong data

Preview deployments use isolated Convex backends. They start empty. This is expected behavior to protect production data.

### CI fails but Vercel deployed anyway

By default, Vercel deploys in parallel with CI. To require CI to pass first:
1. In Vercel Project Settings → Git
2. Under "Ignored Build Step", you can configure to skip builds when CI fails
