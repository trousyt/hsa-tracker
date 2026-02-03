# Deployment Guide

This guide explains how to deploy HSA Tracker to Vercel with Convex backend.

## Prerequisites

- GitHub repository with this code
- Convex production deployment (already exists)
- Vercel account

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
