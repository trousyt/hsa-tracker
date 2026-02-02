"""
Cloud Run proxy for Google Document AI Expense Parser.
Accepts requests with shared secret auth, calls Document AI, returns results.
"""

import os
import base64
from flask import Flask, request, jsonify
from google.cloud import documentai_v1 as documentai

app = Flask(__name__)

# Configuration from environment
API_SECRET = os.environ.get("API_SECRET")
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT_ID")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us")
PROCESSOR_ID = os.environ.get("GOOGLE_CLOUD_EXPENSE_PROCESSOR_ID")


def validate_auth():
    """Validate the Authorization header matches our secret."""
    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {API_SECRET}"

    if not API_SECRET:
        return False, "API_SECRET not configured"
    if auth_header != expected:
        return False, "Invalid authorization"
    return True, None


def parse_expense_entities(document):
    """Extract amount, date, and provider from Document AI response."""
    result = {}

    for entity in document.entities:
        if entity.type_ == "total_amount" and entity.normalized_value.money_value:
            money = entity.normalized_value.money_value
            dollars = float(money.units or 0) + (money.nanos or 0) / 1e9
            result["amount"] = {
                "valueCents": round(dollars * 100),
                "confidence": entity.confidence,
            }

        elif entity.type_ == "receipt_date" and entity.normalized_value.date_value:
            d = entity.normalized_value.date_value
            result["date"] = {
                "value": f"{d.year}-{d.month:02d}-{d.day:02d}",
                "confidence": entity.confidence,
            }

        elif entity.type_ == "supplier_name" and entity.mention_text:
            result["provider"] = {
                "value": entity.mention_text.strip(),
                "confidence": entity.confidence,
            }

    return result


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/process", methods=["POST"])
def process_document():
    """Process a document through Document AI Expense Parser."""

    # Validate auth
    valid, error = validate_auth()
    if not valid:
        return jsonify({"error": error}), 401

    # Validate config
    if not all([PROJECT_ID, PROCESSOR_ID]):
        return jsonify({"error": "Missing configuration"}), 500

    # Get request data
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    content_base64 = data.get("content")
    mime_type = data.get("mimeType")

    if not content_base64 or not mime_type:
        return jsonify({"error": "Missing content or mimeType"}), 400

    try:
        # Decode base64 content
        content = base64.b64decode(content_base64)

        # Initialize Document AI client
        client = documentai.DocumentProcessorServiceClient()

        # Build the processor name
        name = client.processor_path(PROJECT_ID, LOCATION, PROCESSOR_ID)

        # Create the request
        raw_document = documentai.RawDocument(content=content, mime_type=mime_type)
        process_request = documentai.ProcessRequest(name=name, raw_document=raw_document)

        # Process the document
        result = client.process_document(request=process_request)

        # Extract expense data
        extracted_data = parse_expense_entities(result.document)

        return jsonify({
            "success": True,
            "data": extracted_data,
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
