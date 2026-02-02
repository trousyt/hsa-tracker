# Cloud Run OCR Proxy

Proxy service for Google Document AI Expense Parser. Uses attached service account credentials (no key files).

## Deploy

Run from project root:

```bash
bun run ocr:deploy
```

The script will:
1. Check `.env.local` for OCR variables
2. Prompt for any missing values (auto-generates API secret)
3. Deploy to Cloud Run
4. Configure Convex environment variables
5. Update `.env.local` with the Cloud Run URL

## First-time Setup

You'll need:
- `gcloud` CLI authenticated (`gcloud auth login`)
- Document AI API enabled in your GCP project
- Expense Parser processor created (get ID from GCP console)

The script will prompt for the processor ID on first run.

### Service Account Permissions

After first deploy, grant Document AI User role to the Cloud Run service account:

```bash
# Get the default compute service account
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Document AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/documentai.user"
```

## Testing

```bash
# Health check
curl https://YOUR_CLOUD_RUN_URL/health

# Test OCR (requires valid base64 image)
curl -X POST https://YOUR_CLOUD_RUN_URL/process \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"content": "BASE64_IMAGE_DATA", "mimeType": "image/jpeg"}'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_SECRET` | Shared secret for auth (required) |
| `GOOGLE_CLOUD_PROJECT_ID` | GCP project ID (required) |
| `GOOGLE_CLOUD_LOCATION` | Document AI location (default: `us`) |
| `GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID` | Expense Parser processor ID (required) |

## Manual Deployment

If you prefer manual deployment over the script:

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Generate a shared secret
openssl rand -hex 32

# Deploy (from cloud-run-ocr directory)
gcloud run deploy ocr-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "API_SECRET=YOUR_SECRET,GOOGLE_CLOUD_PROJECT_ID=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us,GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID=YOUR_PROCESSOR_ID"

# Then set Convex env vars manually in Dashboard or via CLI
bunx convex env set CLOUD_RUN_OCR_URL "https://ocr-proxy-XXXXX-uc.a.run.app"
bunx convex env set CLOUD_RUN_API_SECRET "your-secret"
```
