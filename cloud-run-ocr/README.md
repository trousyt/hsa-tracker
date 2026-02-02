# Cloud Run OCR Proxy

Proxy service for Google Document AI Expense Parser. Uses attached service account credentials (no key files).

## Deployment

### 1. Generate a shared secret

```bash
openssl rand -hex 32
```

Save this value - you'll need it for both Cloud Run and Convex.

### 2. Deploy to Cloud Run

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Deploy (from this directory)
gcloud run deploy ocr-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "API_SECRET=YOUR_SECRET,GOOGLE_CLOUD_PROJECT_ID=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us,GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID=YOUR_PROCESSOR_ID"
```

### 3. Attach service account permissions

The Cloud Run service uses the default compute service account. Grant it Document AI User role:

```bash
# Get the default compute service account
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Document AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/documentai.user"
```

### 4. Add environment variables to Convex

In Convex Dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `CLOUD_RUN_OCR_URL` | `https://ocr-proxy-XXXXX-uc.a.run.app` (from deploy output) |
| `CLOUD_RUN_API_SECRET` | The secret you generated in step 1 |

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
