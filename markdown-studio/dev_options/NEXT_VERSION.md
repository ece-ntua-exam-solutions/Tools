# Next version (όχι ενεργό)

- Επεξεργασία PDF με αξιόπιστη αντιστοίχιση επιλεγμένου region ↔ source spans, μέσω SyncTeX για παραγόμενα LaTeX PDF και αντιπαραβολής bounding boxes.
- Εξειδικευμένο GUI μαθηματικών: κρατάω image / μετατρέπω σε LaTeX / TikZ / CircuitikZ / επιστρέφω για έλεγχο.
- Υποβοηθούμενο OCR χειρογράφων με human-in-the-loop (το χωριστό SHMMY Handwriting-to-LaTeX εργαλείο αποτελεί βάση).
- Υποστήριξη διορθωτικών PR σε υπάρχοντα `lysi.*` με diff, αντί της σημερινής προστασίας από overwrite.
- Code review / drafts με συγχρονισμό Discord εγκρίσεων (χωρίς να συγχέονται οι δύο αξιολογητές με το GitHub status).
- Έλεγχος εξαγωγής Unicode/Greek σε όλες τις πλατφόρμες και εκτεταμένα E2E tests.
- Transformer προαιρετικός για συντακτική διόρθωση μόνο, όχι για αυτόματη μεταβολή επιστημονικών λύσεων.

## Launcher / Conda (προς υλοποίηση — **όχι** στην v9.1)

- [ ] Αναγνώριση διαθέσιμων Conda installations / environments στα Windows.
- [ ] Επιλογή environment από το `start_windows.bat`, χωρίς να εγκαθιστά δεύτερη Python.
- [ ] Έλεγχος ύπαρξης `fitz`, Pandoc, XeLaTeX, Git, GitHub CLI και φιλικό μήνυμα για ελλείψεις.
- [ ] Επιλογή αποθηκευμένου env ή επιλογή ``conda activate`` σε κάθε εκκίνηση.
- [ ] Δεν απαιτείται ούτε θα ενεργοποιείται Transformer/PyTorch.

## v9.2 post-checks

- [x] Force UTF-8 on Pandoc stdin/stdout and Git/gh subprocess capture.
- [x] Run compile during PR preflight before any GitHub mutation.
- [ ] Live Windows + GitHub CLI fork/branch/commit/push/PR end-to-end verification.
- [ ] Prevent duplicate PRs by detecting existing source branches and reusing/opening their PR.
- [ ] Full source-mapped PDF ↔ Markdown editing (not just annotations/redaction).
- [ ] Conda environment selection in BAT (requested later).

## Βιβλιοθήκη επαναχρησιμοποιήσιμων προτύπων στοιχείων (requested 2026-10-25)

- [ ] **Πίνακες**: προτυποποιημένοι πίνακες Markdown / LaTeX (μεγέθη, επικεφαλίδες, συγχωνεύσεις κελιών, αριθμητική μορφοποίηση), εισαγωγή με μενού και φόρμα/GUI.
- [ ] **Μαθηματικά**: εξισώσεις, συστήματα εξισώσεων, aligned, πίνακες/μήτρες, θεωρήματα, αποδείξεις, απαριθμήσεις.
- [ ] **Ηλεκτρολογικά σχήματα**: TikZ, CircuitikZ, blocks, λογικές πύλες, κυκλώματα RLC, εναλλακτική εισαγωγής εικόνας.
- [ ] **Διαγράμματα/γραφήματα**: PGFPlots, Mermaid/Graphviz (όπου είναι εφικτό), εισαγωγή εικόνας/CSV.
- [ ] **Σχόλια/σημειώσεις/παραδοχές**: κοινά blocks, τυποποίηση μεθοδολογίας/λύσης χωρίς πλαίσιο τελικού αποτελέσματος.
- [ ] Προεπισκόπηση template, εισαγωγή με cursor και placeholders, αποθήκευση custom template βιβλιοθήκης.
- [ ] Δυνατότητα περισσότερων document templates με επιλογή style (μετά από επιλογή της ομάδας παραμένει ένα default).
- [ ] **Typst**: διερεύνηση προαιρετικού renderer και διαδρομών Markdown ↔ Typst ↔ PDF χωρίς απώλειες κώδικα ή εικόνων. Να μην εξαναγκαστεί αλλαγή της κύριας LaTeX ροής.
- [ ] Συμβατότητα / αξιολόγηση Pandoc, Quarto, LaTeX, Typst, KaTeX, MathJax, TikZ, CircuitikZ, SVG, PDF.js και εισαγωγής μακροεντολών.

## Εκκίνηση Windows / launchers

- [ ] Ένας προαιρετικός ενημερωμένος launcher με αναγνώριση Conda environments, επιλογή ήδη εγκατεστημένης Python, διαγνωστικά για Pandoc/XeLaTeX/Git/gh.
- [ ] Ο launcher **να μη βρίσκεται στον κύριο φάκελο** έως ότου είναι δοκιμασμένος και ξεκάθαρος. Οι παλαιοί έχουν αρχειοθετηθεί στο `dev_options/legacy_launchers`.

## PDF ↔ source: επόμενα βήματα πέρα από v9.3

- [x] Χωρίς broken image placeholder όταν δεν έχει φορτωθεί PDF.
- [x] Αόρατα anchors για επιλογή Markdown block από παραγόμενο PDF και αναδημιουργία PDF μετά από αλλαγή source.
- [ ] Πιο ακριβές mapping σε λέξεις/ενδοεξισώσεις μέσω SyncTeX ή tagged PDF bounding boxes, συν επιλογή στοιχείων πολλών στηλών.
- [ ] Καλύτερο undo/redo **και** για αλλαγές Markdown που προέρχονται από το PDF.
- [ ] Πρόσθετα εργαλεία επεξεργασίας εικόνων/πίνακα/σχήματος με προαιρετική αναγέννηση LaTeX.

## v9.4 — Προαιρετικά συστήματα παραγωγής PDF (μελλοντικά)

- [x] **Basic Python PDF**: PyMuPDF Story για ελληνικά/HTML/πίνακες/εικόνες και matplotlib mathtext για συνηθισμένες εξισώσεις, *χωρίς* Pandoc/XeLaTeX/MiKTeX.
- [x] **Source mapping**: θέσεις HTML blocks → PDF σελίδες → αρχικό Markdown, με επαναδημιουργία PDF μετά τη διόρθωση πηγής.
- [x] **Draft PR χωρίς XeLaTeX**: Python PDF, προαιρετικό `.tex` μόνο με Pandoc, σαφές preflight για ελλιπείς εξισώσεις.
- [ ] **XeLaTeX/LuaLaTeX** ως προαιρετική μηχανή υψηλής πιστότητας, με πλήρη Math/TikZ/CircuitikZ, όχι υποχρεωτική εξάρτηση.
- [ ] **Typst/Python `typst`** ως προαιρετική μηχανή παραγωγής PDF, με διατήρηση source map αν τεχνικά εφικτό.
- [ ] **Playwright/Chromium/PDF.js** όπου προσθέτουν αξιόπιστο rendering ή καλύτερη επιλογή κειμένου, όχι υποχρεωτικά στον βασικό φάκελο.
- [ ] **Quarto/Pandoc advanced** και επιλογή μηχανής παραγωγής από το GUI όταν έχουν δοκιμαστεί.
- [ ] **Διαγνωστικά GUI** για εγκατεστημένες/ελλείπουσες προαιρετικές μηχανές, χωρίς να μπλοκάρει η βασική εξαγωγή.
- [ ] **Πιστότητα δύσκολων μαθηματικών** (`aligned`, matrices, custom macros) στην Python-only διαδρομή· παρέχονται προειδοποιήσεις, όχι αυτόματη επιστημονική μετατροπή.
- [ ] **Live Windows PR**: δοκιμή fork/branch/push/PR + ανάκτηση συνδέσμου, με προστασία διπλοτύπων και σαφές rollback.

- [x] v9.4.1: In-memory PyMuPDF Story (`BytesIO`) to avoid Windows WinError 32 on temporary story.pdf.
