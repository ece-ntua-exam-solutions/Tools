# Markdown Studio v9.5.0

## Μαθήματα
Η λίστα ακολουθεί το **έτος εξέτασης** και το εξάμηνο. Παλιές επιλογές που δεν υπάρχουν στο νέο φίλτρο καθαρίζονται. Οι προτάσεις εμφανίζονται κάτω από την αναζήτηση, αγνοούν τόνους/πεζά και ανέχονται ορθογραφικά λάθη (edit distance). Πατήστε πρόταση για διόρθωση. Δεν χρησιμοποιείται transformer. Ο κατάλογος αποθηκεύεται για επόμενες εκκινήσεις· ενημερώστε από GitHub για νέες διαδρομές.

## Reports PR
Κουμπί «Ενημερώσεις PR». Python mode και ενημερωμένο GitHub CLI με `gh auth login` απαιτούνται. Φίλτρα: πρόθεμα διαδρομής κατηγορίας, μέρος ονόματος μαθήματος, κατάσταση, ημερομηνία τελευταίας αλλαγής, GitHub συντάκτης, οποιοδήποτε label από λίστα, drafts. Περιγραφή και λίστα αρχείων επιλέγονται ανεξάρτητα. Τα φίλτρα συνδυάζονται με AND, τα labels με OR. Η κατάσταση «Κλειστά» περιλαμβάνει merged.

1. Ρυθμίστε τα φίλτρα ή πατήστε «Φίλτρα από τρέχουσα λύση».
2. Προαιρετικά αποθηκεύστε ονομασμένο προφίλ (στον συγκεκριμένο browser).
3. Πατήστε «Ενημέρωση report»: ανακτώνται PR και αλλαγμένα αρχεία με pagination από το κοινό repo.
4. Διαβάστε το report μέσα στην εφαρμογή ή κατεβάστε HTML.
5. Για email, δώστε παραλήπτες/θέμα **πριν** από την ενημέρωση report. Πατήστε αποστολή και επιβεβαιώστε τους παραλήπτες. Αλλαγή ρυθμίσεων ακυρώνει το παλιό report.

Το email έχει HTML και plain-text μορφή, τίτλους, περιγραφές, φίλτρα και links προς PR και αρχεία αλλαγών. Κατηγορία σημαίνει διαδρομή στο repository ή label. Δεν υπάρχει εξάρτηση από Discord webhook. Δεν εκτελείται αυτόματος έλεγχος όταν το Studio είναι κλειστό και δεν στέλνονται αυτόματα μηνύματα. Τα reports είναι snapshots όλων των PR που ταιριάζουν, όχι μόνο των μη αναγνωσμένων. Πολλά PR απαιτούν περισσότερο χρόνο και GitHub API requests. Το GitHub περιορίζει τη λίστα αρχείων σε 3000 ανά PR.

## Ρύθμιση SMTP σε Anaconda Prompt
Ο πάροχος email πρέπει να υποστηρίζει SMTP και, όπου απαιτείται, app password. Ρυθμίστε στο ίδιο prompt πριν ξεκινήσετε τον server:

```bat
set "STUDIO_SMTP_HOST=smtp.example.org"
set "STUDIO_SMTP_PORT=587"
set "STUDIO_SMTP_SECURITY=starttls"
set "STUDIO_SMTP_FROM=your-address@example.org"
set "STUDIO_SMTP_USER=your-address@example.org"
set "STUDIO_SMTP_PASSWORD=YOUR_APP_PASSWORD"
python studio_server.py
```

Για implicit TLS χρησιμοποιήστε `STUDIO_SMTP_SECURITY=ssl` και θύρα 465. Οι SMTP ρυθμίσεις/κωδικοί παραμένουν στο περιβάλλον του server, όχι στα προφίλ browser. Τα προφίλ περιέχουν φίλτρα, παραλήπτες και θέμα. Η αποδοχή από SMTP δεν εγγυάται παράδοση στο inbox. Μην αποθηκεύετε πραγματικούς κωδικούς μέσα στο πακέτο.

## Εγκατάσταση και έλεγχοι
Αποσυμπιέστε σε νέο φάκελο, κλείστε τον παλιό server, ενεργοποιήστε το υπάρχον Conda env, εκτελέστε `python -m pip install -r requirements.txt` και `python studio_server.py`. Ανοίξτε http://127.0.0.1:8765 και κάντε Ctrl+Shift+R. Το παλαιό εγχειρίδιο v9.4.1 παραμένει για τις υπάρχουσες λειτουργίες· αυτό το αρχείο περιγράφει τις προσθήκες v9.5.

Έλεγχοι ανάπτυξης: Python compilation, JS syntax, tests mocked GitHub pagination/filters/escaping, mocked SMTP/TLS και απόρριψη recipient injection, Node assertions scoped catalogue/normalization/edit distance. Δεν έγινε πραγματική αποστολή email, live GitHub report ή οπτική δοκιμή Windows/browser.
