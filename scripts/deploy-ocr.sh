#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Helper to read var from .env.local
get_env_var() {
  grep "^$1=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-
}

# Helper to set/update var in .env.local
set_env_var() {
  local name="$1"
  local value="$2"
  if grep -q "^$name=" "$ENV_FILE" 2>/dev/null; then
    # Update existing
    sed -i.bak "s|^$name=.*|$name=$value|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    # Append new (with header if first OCR var)
    if ! grep -q "# OCR Configuration" "$ENV_FILE" 2>/dev/null; then
      echo "" >> "$ENV_FILE"
      echo "# OCR Configuration" >> "$ENV_FILE"
    fi
    echo "$name=$value" >> "$ENV_FILE"
  fi
}

# Prompt for value with default
prompt_var() {
  local name="$1"
  local prompt="$2"
  local default="$3"
  local current=$(get_env_var "$name")

  if [ -n "$current" ]; then
    echo "$name already set: $current"
    return
  fi

  if [ -n "$default" ]; then
    read -p "$prompt [$default]: " value
    value="${value:-$default}"
  else
    read -p "$prompt: " value
  fi

  set_env_var "$name" "$value"
}

echo "==> OCR Deployment Setup"
echo ""

# Check/prompt for each required variable
API_SECRET=$(get_env_var "CLOUD_RUN_API_SECRET")
if [ -z "$API_SECRET" ]; then
  echo "Generating API secret..."
  API_SECRET=$(openssl rand -hex 32)
  set_env_var "CLOUD_RUN_API_SECRET" "$API_SECRET"
  echo "CLOUD_RUN_API_SECRET generated and saved"
fi

prompt_var "GOOGLE_CLOUD_PROJECT_ID" "Google Cloud Project ID" "hsatracker"
prompt_var "GOOGLE_CLOUD_LOCATION" "Document AI Location" "us"
prompt_var "GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID" "Expense Parser Processor ID"

# Reload vars
API_SECRET=$(get_env_var "CLOUD_RUN_API_SECRET")
PROJECT_ID=$(get_env_var "GOOGLE_CLOUD_PROJECT_ID")
LOCATION=$(get_env_var "GOOGLE_CLOUD_LOCATION")
PROCESSOR_ID=$(get_env_var "GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID")

echo ""
echo "==> Deploying to Cloud Run..."

cd "$PROJECT_ROOT/cloud-run-ocr"
OUTPUT=$(gcloud run deploy ocr-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "API_SECRET=${API_SECRET},GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${LOCATION},GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID=${PROCESSOR_ID}" \
  2>&1)

# Extract service URL
SERVICE_URL=$(echo "$OUTPUT" | grep -oE 'https://[^ ]+\.run\.app' | tail -1)

if [ -z "$SERVICE_URL" ]; then
  echo "Warning: Could not parse service URL"
  echo "$OUTPUT"
  exit 1
fi

# Save URL to .env.local
set_env_var "CLOUD_RUN_OCR_URL" "$SERVICE_URL"

echo ""
echo "==> Setting Convex environment variables..."

cd "$PROJECT_ROOT"
bunx convex env set CLOUD_RUN_OCR_URL "$SERVICE_URL"
bunx convex env set CLOUD_RUN_API_SECRET "$API_SECRET"

echo ""
echo "==> Done!"
echo "    Cloud Run: $SERVICE_URL"
echo "    Convex env vars: configured"
echo "    .env.local: updated"
