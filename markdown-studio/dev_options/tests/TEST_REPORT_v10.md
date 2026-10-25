# Validation — Markdown Studio v10.0.0

Date: 2026-10-25. Environment: Linux, Python 3.12.14 runtime, headless Chromium 133 via Playwright. No messages were sent, no PRs were created, no model weights downloaded.

## Passed

- Python: 4 new tests for category/year/course filters applying to the same changed file, Greek normalization, merged/date filtering, image transparency, invalid inputs, model permission, missing dependency and mock inference.
- Python: 3 report/SMTP tests (pagination fixtures, safe HTML, field selection, mocked TLS/SMTP, recipient header injection rejection).
- Node: 7 assertions for Greek case/accents/sigma normalization, fuzzy spelling, prefixes, phonetic Latin input, scoped vocabulary and transpositions.
- Existing basic PDF regression: Greek cover, mathematical expression, table, source map, editing a source block and re-export.
- Existing in-memory Story regression: five repeated PDF renders without intermediate story.pdf.
- HTTP smoke: export PDF with source map; preview; email confirmation guard; Origin guard; OCR status without loading model; all new static modules.
- Browser: refresh repository catalogue, filter courses by year/semester, typo suggestions, keyboard selection, exact repository path, clearing stale course.
- Browser: Ctrl+K feature search, direct routes, MathJax preview and clipboard copy.
- Browser: table cell editing, LaTeX escaping, Markdown table insertion and preview.
- Browser: report search, escaped PR body, sending exactly the displayed subset to the mocked send endpoint.
- Browser: theme persistence and reset; detached window → insert into original Studio; feature-specific feedback; real ZIP download; clear missing-OCR state.
- Browser: all nine principal routes at 390 × 844, with no page overflow; desktop at 1440 × 1000; no JavaScript page errors.
- Browser: HTML-only tool route opened directly from index.html.
- ZIP readback: CRCs valid; Greek comment text intact; separate equations/reports files and machine-readable comments.json.
- JavaScript syntax and Python compilation.

## Reproduce local checks

From application root:

```bash
python dev_options/tests/test_features_v10.py
python dev_options/tests/test_reports_v95.py
python dev_options/tests/test_basic_pdf_v94.py
python dev_options/tests/test_story_in_memory.py
node dev_options/tests/test_search_v10.cjs
```

Optional browser regression: install Playwright for development only (`npm install --no-save --package-lock=false playwright` then `npx playwright install chromium`), start the Python server separately, and run:

```bash
node dev_options/tests/test_ui_v10.cjs
```

It mocks catalogue reads and report sending. It never sends email or modifies GitHub. Set STUDIO_TEST_BASE for a different localhost port. Screenshots/test downloads are written to a temporary directory. Browser testing is not required for normal app use.

## Not verified live

- Native Windows execution or the user's particular browser/Conda environment.
- Sending/delivery through a real SMTP provider.
- Real pix2tex model initialization, weight download or recognition quality. Only image validation, optional dependency behavior and mock inference were tested.
- GitHub API retrieval from a live authenticated user session or a real PR creation. Existing PR flow was preserved.

The validation scope should not be described as full Windows, OCR or production integration certification.
