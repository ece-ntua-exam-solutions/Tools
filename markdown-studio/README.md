# Markdown Studio — Exam Solutions Workbench

**Τοπικό περιβάλλον συγγραφής και υποβολής λύσεων εξετάσεων ΣΗΜΜΥ με Markdown/LaTeX, εξώφυλλα, PDF και GitHub Draft PR.**

Έκδοση **10.0.1** · δοκιμαστική έκδοση. Η αναγνώριση εικόνας εξίσωσης είναι **πειραματική** και δεν παρέχει αξιόπιστη αυτόματη μεταγραφή χωρίς ανθρώπινο έλεγχο.

## Τι προσφέρει

- Editor Markdown/LaTeX με προεπισκόπηση και ξεχωριστό εξώφυλλο ΣΗΜΜΥ.
- PDF μέσω Python/PyMuPDF, χωρίς υποχρεωτικό MiKTeX/XeLaTeX.
- Αντιστοίχιση blocks παραγόμενου PDF με την πηγή και επανεξαγωγή μετά τη διόρθωση.
- Κατάλογο μαθημάτων από το repo λύσεων, φίλτρα εξαμήνου/έτους και αναζήτηση με προτάσεις και ανοχή σε ορθογραφικά λάθη.
- Βοηθητικά εργαλεία εξισώσεων και πινάκων, με deep links, ξεχωριστό παράθυρο και copy/paste.
- Σύνδεση GitHub μέσω προσωπικού `gh` και δημιουργία Draft PR στο `Problems-Solutions`.
- On-demand reports PR μέσα στην εφαρμογή ή μέσω email, με φίλτρα και προφίλ ενημέρωσης.
- Διακριτικό φωτεινό μπλε θέμα, dark mode, βοήθεια «?» και σχόλια ανά λειτουργία σε ZIP για χειροκίνητη επισύναψη στο Discord.

## Εγκατάσταση

Απαιτείται Python 3.10+. Στα Windows χρησιμοποίησε Anaconda Prompt και το κατάλληλο Conda environment. Για νέο environment προτείνεται Python 3.11, ιδίως αν θα δοκιμάσεις το προαιρετικό OCR.

Η παρούσα δοκιμαστική έκδοση βρίσκεται στο branch `feature/markdown-studio`:

```bash
git clone --branch feature/markdown-studio --single-branch https://github.com/ece-ntua-exam-solutions/Tools.git
cd Tools/markdown-studio
python -m pip install -r requirements.txt
python studio_server.py
```

Άνοιξε **http://127.0.0.1:8765/**. Κλείσε παλιότερο server πριν ξεκινήσεις και κάνε Ctrl+Shift+R μετά από αναβάθμιση. Εναλλακτικά, άνοιξε το `index.html` για βασικό HTML-only editor και εργαλεία.

| Λειτουργία | Απαίτηση |
|---|---|
| Βασική συγγραφή / εξισώσεις / πίνακες | Browser, δυνατό και HTML-only |
| PDF / επεξεργασία PDF / reports | Python server και βασικά requirements |
| Πραγματικό Draft PR | Git, GitHub CLI και `gh auth login` |
| Πλήρης εξαγωγή `.tex` από Python | Προαιρετικό Pandoc |
| Αποστολή report email | Ρυθμίσεις SMTP στο περιβάλλον του server |
| Πειραματική εικόνα → LaTeX | Προαιρετικό `requirements-ocr.txt` και λήψη βαρών pix2tex |

## Όρια της έκδοσης

Το OCR είναι βοηθητικό πείραμα: περιλαμβάνει επιλογή περιοχής, διαχωρισμό γραμμών, εναλλακτική κλίμακα και ενδείξεις ύποπτης εξόδου. Η πραγματική ακρίβεια με βάρη pix2tex δεν έχει επαληθευτεί στο περιβάλλον ανάπτυξης, και οι δοκιμές χρήσης έδειξαν σημαντικά λάθη. Έλεγχε κάθε γραμμή· οι προειδοποιήσεις δεν ανιχνεύουν όλα τα λάθη.

Η προεπισκόπηση MathJax υποστηρίζει περισσότερες εντολές από το βασικό Python PDF (matplotlib mathtext). Σύνθετα blocks `aligned`/matrices/TikZ χρειάζονται κατάλληλη ροή LaTeX. Τα Draft PR και οι εξαγωγές δεν αποτελούν έλεγχο μαθηματικής ορθότητας ή έγκριση της ομάδας.

Ο server προορίζεται για localhost. GitHub και email δεν εκτελούν εγγραφή/αποστολή χωρίς τη σχετική ενέργεια και επιβεβαίωση του χρήστη. Δεν υπάρχει scheduler όταν η εφαρμογή είναι κλειστή. SMTP ρυθμίσεις δίνονται ως μεταβλητές περιβάλλοντος· δεν αποθηκεύονται στον κώδικα.

## Οδηγοί και έλεγχοι

- [Οδηγός χρήσης και deep links](START_HERE_EL.md)
- [Περιοχές και πολλές γραμμές OCR](UPDATE_v10_0_1.md)
- [Επισκόπηση αρχιτεκτονικής](dev_options/ARCHITECTURE_v10.md)
- [Έλεγχοι UI/PDF](dev_options/tests/TEST_REPORT_v10.md)
- [Έλεγχοι αλλαγών OCR](dev_options/tests/TEST_REPORT_v10_0_1.md)

Ενδεικτικοί έλεγχοι χωρίς πραγματικό email, δημιουργία PR ή λήψη μοντέλου:

```bash
python dev_options/tests/test_features_v10.py
python dev_options/tests/test_ocr_v101.py
python dev_options/tests/test_reports_v95.py
python dev_options/tests/test_basic_pdf_v94.py
node dev_options/tests/test_search_v10.cjs
```

Τα tests του μοντέλου και της αποστολής SMTP χρησιμοποιούν προσομοίωση. Δεν έχει επιβεβαιωθεί πλήρης λειτουργία σε Windows, πραγματική αποστολή SMTP ή πραγματικό OCR. Τα browser tests καλύπτουν desktop/mobile διαστάσεις και περιγράφονται στις αναφορές.

Η δημοσίευση περιλαμβάνει τον ενεργό κώδικα, τεκμηρίωση και tests. Τα ιστορικά αντίγραφα εφαρμογών, παλιά launchers και παλαιά δυαδικά παραδείγματα δεν ανήκουν στον ενεργό φάκελο.

## Τρίτα μέρη

Το MathJax διατίθεται στο `vendor/` για offline προεπισκόπηση. Δες [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) και την άδεια στο `vendor/`. Το προαιρετικό pix2tex και τα Python πακέτα εγκαθίστανται χωριστά και διατηρούν τις δικές τους άδειες.
