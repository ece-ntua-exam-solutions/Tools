# v10 modules and performance decisions

| File | Responsibility |
|---|---|
| search.js | Vocabulary normalization, prefix/token scoring, edit distance, accessible combobox |
| studio.js | Existing editor/export/PDF/PR core; scoped repository catalogue |
| ui.js | Hash routes, theme, help, command search, cross-window insertion |
| reports.js | Report search, profiles, visible subset and email request |
| tools.js | Equation blocks, MathJax preview, table builder, image-to-LaTeX frontend |
| feedback.js | Local feature comments and dependency-free ZIP export |
| ui.css | Forum-inspired light defaults, dark theme and responsive layout |
| backend/reports.py | Paginated read-only GitHub retrieval, filters, SMTP |
| ocr.js | Crop selection, region inspection, per-line candidates and suspect-output review |
| backend/ocr_equation.py | Validated image decoding, line grouping, output anomaly checks and lazy optional pix2tex |

The attached advanced Discord bot was inspected. UI search adapts its scoped-vocabulary, normalization, prefix and spelling approach, implemented locally in JavaScript. It does not claim to reproduce the bot's E5 embedding/semantic search.

Search input is debounced, result lists are bounded, dictionaries are indexed, and distant word lengths skip edit-distance work. Report keyword filtering happens locally after a fetch. Repeated GitHub reads have a short memory cache. Catalogue requests can be aborted, stale results are ignored, and cached catalogues are scoped to repository/branch. Metadata-only edits avoid rebuilding/typesetting the Markdown body. Tool previews serialize and debounce MathJax work. OCR imports and model loading happen only on explicit recognition, with one model reused and concurrent inference prevented. Optional dependencies are outside the base requirements.

Routes hide panels instead of creating additional permanent work areas in the editor. Detailed controls live in collapsible sections. Cross-window blocks travel through a same-origin BroadcastChannel targeted to one active document instance; content is never embedded in deep-link URLs. A missing receiver falls back to clipboard.

Comments are local browser drafts. The ZIP includes only selected feature comments and explicitly chosen attachments. It does not contain work documents, SMTP settings, account credentials or the attached source bot. It is sent to Discord manually by the user.
