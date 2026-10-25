# OCR v10.0.1 validation

2026-10-25. This patch adds region inspection and multiline processing, not a guarantee of recognition quality.

Passed:

- Actual geometric analysis of the expression shown in the user's screenshot: eight regions; fraction numerators/denominators remained together. The screenshot and extracted expression are not bundled with the application.
- Seven new Python OCR tests: line grouping with a fraction; crop and single-block overrides; invalid/empty inputs; repeated ones/unit fractions; brace imbalance; separate per-line model calls; resize retry; suspect output; preservation of the first result when retry fails.
- Existing four feature tests and three report/SMTP tests.
- Existing basic PDF regression: Greek, cover, equations, table, source mapping and re-export.
- Browser via actual /api/ocr/analyze: eight regions; dragging a crop; resetting crop; single-block override; no horizontal overflow at mobile width.
- Browser via mocked /api/ocr/equation: suspect warning; disabled copy/insert before review; editing resets acknowledgment; alternate scaling candidate; aligned output and clipboard. Hidden review controls stay hidden before an anomaly occurs.
- Full existing UI regression for search, categories, reports, email payload, themes, detached tools, feedback ZIP, desktop/mobile routes and HTML-only tools. No JavaScript page errors.

Actual pix2tex inference with loaded weights was not run in the development environment. No recognition-accuracy percentage or mathematical-correctness claim follows from the checks. The screenshot example in examples/OCR_Example_Manual.md was transcribed by hand and is not used as an OCR response.

Reproduce backend checks:

```bash
python dev_options/tests/test_ocr_v101.py
python dev_options/tests/test_features_v10.py
```

With the Python server running and Playwright installed for development, the portable browser test uses a synthetic image, an actual layout-analysis endpoint and a mocked recognition endpoint:

```bash
node dev_options/tests/test_ocr_ui_v101.cjs
```

The fixture in fixtures/ocr_multiline.png is synthetic. It is not an OCR benchmark or a recognized output. Use STUDIO_OCR_TEST_IMAGE to run the same layout test against another image; that test expects eight lines.
