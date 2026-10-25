# Markdown Studio v9 — Test report (2026-10-24)

- `node --check studio.js`: PASS.
- Headless Chromium (HTML injected locally due browser network policy): no page errors; cover renders; changing `solver` changes cover; hide/show works.
- MathJax vendor: loaded offline in browser; 4 math containers rendered; no JavaScript errors.
- HTML-only XeLaTeX `.tex` export: 2-page PDF, `xelatex -halt-on-error` PASS after correction to preserve `\[\]` and `\(\)` math.
- Optional Python `/api/export`: LaTeX generated; compiled PDF with Greek to 2 pages; PASS.
- PDF `/api/pdf/preview`: recognized 7 text blocks from sample solution; PASS.
- PDF `note`, `highlight`, `redact`, `image`: PASS; redaction verified by checking removed heading is absent in extracted PDF text.
- PDF text insertion in too-small rectangle: clear validation error, no corrupted PDF returned.
- GitHub repo structure: read-only inspected via connected GitHub access; folder structure and name variations confirmed.
- GitHub `/api/pr/preflight` without `gh` installed: returns `ok=false` and explicit setup guidance; PASS.
- **Not tested live**: GitHub fork/push/create PR, because this execution environment lacks authenticated `gh` credentials. Requires user-side integration test; UI does not falsely mark success and provides URL + verify operation after creation.
- **Not yet verified**: cross-platform print styles, extremely long PDFs, SyncTeX-to-source PDF region map; remain for next version.

## v9.3.1 clean release (2026-10-25)

- PASS: `python dev_options/tests/test_local.py` — XeLaTeX PDF and PDF note operation.
- PASS: 4 unit tests `test_github_auth.py` (mock only, no live authorization).
- PASS: 5 Unicode/Git subprocess tests `test_unicode_pr_v92.py`.
- PASS: `test_pdf_source_mapping.py` — generated PDF, source offsets, page PNG, edit formula, regenerated PDF.
- PASS: local HTTP `/api/export` source map (12 anchors), `/api/pdf/preview` page PNG, recompiled formula, `/api/pdf/edit` annotation, invalid file rejected.
- PASS: JavaScript syntax (`node --check studio.js`), Python syntax (`compileall`).
- PASS: initial PDF image stays hidden until loaded (`[hidden]` CSS rule); failed images expose readable error state.
- LIMIT: Full browser UI E2E could not run here because the container's headless browser blocked navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. API and source mapping were exercised directly; Windows browser UX remains to be confirmed by user.
- LIMIT: Live GitHub PR creation and OAuth device workflow were not executed. No repository changes were made.
