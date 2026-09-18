"""Unit tests for OCR proxy upload signature validation."""

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock


def load_module():
    """Load the proxy without requiring Google Cloud client libraries."""
    google = types.ModuleType("google")
    cloud = types.ModuleType("google.cloud")
    documentai = types.ModuleType("google.cloud.documentai_v1")
    cloud.documentai_v1 = documentai
    google.cloud = cloud
    sys.modules.setdefault("google", google)
    sys.modules.setdefault("google.cloud", cloud)
    sys.modules.setdefault("google.cloud.documentai_v1", documentai)

    module_path = Path(__file__).with_name("main.py")
    spec = importlib.util.spec_from_file_location("ocr_proxy", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


proxy = load_module()


class ValidateFileSignatureTests(unittest.TestCase):
    """Verify that uploaded bytes match their declared supported MIME type."""

    def test_accepts_supported_file_signatures(self):
        """Accept JPEG, PNG, WebP, HEIC, and PDF signatures."""
        cases = [
            (b"\xff\xd8\xff\xe0", "image/jpeg"),
            (b"\x89PNG\r\n\x1a\n", "image/png"),
            (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "image/webp"),
            (b"\x00\x00\x00\x18ftypheic", "image/heic"),
            (b"%PDF-1.7", "application/pdf"),
        ]

        for content, mime_type in cases:
            with self.subTest(mime_type=mime_type):
                self.assertTrue(proxy.has_valid_file_signature(content, mime_type))

    def test_rejects_mismatched_or_unsupported_signatures(self):
        """Reject arbitrary bytes and signatures that do not match the MIME type."""
        self.assertFalse(proxy.has_valid_file_signature(b"not an image", "image/jpeg"))
        self.assertFalse(proxy.has_valid_file_signature(b"%PDF-1.7", "image/png"))
        self.assertFalse(proxy.has_valid_file_signature(b"\xff\xd8\xff", "text/plain"))


class ProcessDocumentTests(unittest.TestCase):
    """Verify invalid file bytes do not reach the Document AI client."""

    def setUp(self):
        """Configure the Flask application for an authenticated test request."""
        self.client = proxy.app.test_client()
        self.original_secret = proxy.API_SECRET
        self.original_project = proxy.PROJECT_ID
        self.original_processor = proxy.PROCESSOR_ID
        proxy.API_SECRET = "test-secret"
        proxy.PROJECT_ID = "test-project"
        proxy.PROCESSOR_ID = "test-processor"

    def tearDown(self):
        """Restore module configuration after each request test."""
        proxy.API_SECRET = self.original_secret
        proxy.PROJECT_ID = self.original_project
        proxy.PROCESSOR_ID = self.original_processor

    def test_rejects_invalid_bytes_before_document_ai(self):
        """Return 400 without constructing a Document AI client for invalid bytes."""
        proxy.documentai.DocumentProcessorServiceClient = MagicMock()

        response = self.client.post(
            "/process",
            headers={"Authorization": "Bearer test-secret"},
            json={"content": "bm90IGFuIGltYWdl", "mimeType": "image/jpeg"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {"error": "File content does not match mimeType"})
        proxy.documentai.DocumentProcessorServiceClient.assert_not_called()


if __name__ == "__main__":
    unittest.main()
