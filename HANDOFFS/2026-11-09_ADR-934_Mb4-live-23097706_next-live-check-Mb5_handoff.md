# HANDOFF — ADR-934: Μ-β4 ΣΤΗΝ ΠΑΡΑΓΩΓΗ (`23097706`) · επόμενο: ΖΩΝΤΑΝΟΣ ΕΛΕΓΧΟΣ Μ-β4 → Μ-β5

- **Worktree**: `C:\Nestor_Worktrees\product-portal` · **Κλαδί**: `agent/product-portal` · ΠΟΤΕ commit στο `main`.
- **wt:land / push**: ΜΟΝΟ με ρητή εντολή Giorgio, και **χωριστά**.
- Αντικαθιστά το `2026-11-09_ADR-934_Mb4-done-tests-76_next-live-check_handoff.md`.
- **Αυθεντία**: ADR-934 §5.2.2 (Μ-β1…Μ-β4 «όπως υλοποιήθηκε» + αποφάσεις) + changelog (τελευταία γραμμή = rebase + νέα σφράγιση).
- **Εγκεκριμένο σχέδιο Μ-β**: `C:\Users\user\.claude\plans\kind-yawning-fox.md` §Μ-β5 (το ADR το διορθώνει όπου διαφωνούν).

## 1. Κατάσταση (2026-11-09)

- **Παραγωγή = `main` = `23097706`** (land + push με εντολές Giorgio· CI «live 2309770»· `/api/build-info` =
  `23097706e2342c14a7ce4e3764ee6d6972cd920a`, διαβασμένο από τον browser).
- Το `wt:land` **ένωσε** όλο το Μ-β4 σε ΕΝΑ commit (`23097706`, 36 αρχεία) με τίτλο του τελευταίου
  (`docs(adr): … resealed 15345`) — ο τίτλος είναι παραπλανητικός, το περιεχόμενο είναι όλο το Μ-β4. Τα παλιά hashes
  (`6e394c87` κ.λπ.) **δεν** υπάρχουν στο `main` — για έλεγχο χρησιμοποίησε το `23097706`.
- Κλαδί = `main` (`23097706`), καθαρό, + αυτό το handoff.
- **Τι έγινε στο land**: σύγκρουση με Β5.2 (`231e37cb`) — μόνο imports (`ImportBatchWorkspace.tsx`, `catalog-import.schema.ts`)
  + 2 παραγόμενα (γεννήτορες). Η ένωση Β5.2 + Μ-β4 ξεπέρασε το ταβάνι του shell slice της σελίδας εισαγωγών (15345 > 14797)
  ⇒ **νέα σφράγιση 15345** με γραπτό `why` στο `.i18n-shell-slice.json` (πρότυπο Chromium `Binary-Size:`, απόφαση Giorgio).

## 2. Επόμενα βήματα (κάθε εγγραφή στην παραγωγή ΜΟΝΟ με «ναι» Giorgio)

### 2.1 Ζωντανός έλεγχος Μ-β4 στο https://nestorconstruct.gr

⚠️ Το `curl` προς το nestorconstruct.gr παίρνει **403** (προστασία bots, ακόμη και η αρχική). Έλεγχος παραγωγής **μόνο
από τον browser** (Claude in Chrome). Το `curl` προς τρίτους servers δουλεύει.

Ο Giorgio **δεν έχει** δικές του διευθύνσεις. Βρέθηκαν και **ελέγχθηκαν με curl** (2026-11-09):

| Περίπτωση | Διεύθυνση | Μετρημένο | Αναμενόμενο στη Nestor |
|---|---|---|---|
| PDF | `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf` | 200 · PDF 13264 B · ETag · **304 με If-None-Match ✓** | έτοιμο · 2η εισαγωγή ⇒ `unchanged` χωρίς bytes |
| PNG (W3C) | `https://www.w3.org/Icons/w3c_home.png` | 200 · PNG · ETag | έτοιμο |
| PNG (httpbin) | `https://httpbin.org/image/png` | 200 · PNG · χωρίς ETag | έτοιμο · 2η εισαγωγή ⇒ `sameContent` |
| JPEG (httpbin) | `https://httpbin.org/image/jpeg` | 200 · JPEG | έτοιμο (2 στον ίδιο host ⇒ ≤ 2 ανά host) |
| 404 | `https://httpbin.org/status/404` | 404 | `notFound` |
| 404 μέσω 301 | `https://www.w3.org/no-such-file-nestor.pdf` | 301 → 404 | `notFound` |
| HTML | `https://httpbin.org/html` | 200 · text/html | `notAFile` |
| http | `http://www.w3.org/Icons/w3c_main.png` | 200 · PNG | αναβάθμιση σε https, **χωρίς** `insecure` |

Κενό: κανένας αξιόπιστος server **μόνο http** (το neverssl.com απάντησε 200 και σε https) ⇒ η επιστροφή σε `insecure`
καλύπτεται μόνο από tests.

Ροή (ζήτα «ναι» πριν από το βήμα 2):
1. Φτιάξε αντίγραφο του xChange του MFP με αυτά τα 8 ως συνημμένα (όπως στον ζωντανό έλεγχο του Μ-α — δες το changelog του
   ADR-934, γραμμή «Ζωντανός έλεγχος Μ-α στο `ab29a180`», και το handoff `2026-11-09_ADR-934_Ma-landed-ab29a180_next-Mb-plan_handoff.md`
   για το πώς φτιάχτηκε). Ρόλοι: datasheet για PDF, εικόνα για PNG/JPEG.
2. Εισαγωγή → ενότητα «Μέσα»: λήψεις (≤ 3, ≤ 2 ανά host), «Έτοιμα X από Y», αποτυχίες με λόγο.
3. «Ξαναδοκιμή» σε μία αποτυχία (ίδιο αποτέλεσμα, νέα προσπάθεια).
4. Δεύτερη εισαγωγή του ίδιου αρχείου ⇒ PDF/W3C `unchanged` (304), httpbin `sameContent`.
5. «Εγκατάλειψη» και των δύο παρτίδων ⇒ καμία νέα λήψη. Τα αρχεία καραντίνας **μένουν** (καθαρισμός = Μ-β5).
Αποτυχία ⇒ χαρακτήρισε (κώδικας/δεδομένα/υποδομή), διόρθωσε στο κλαδί, changelog ADR. Στο τέλος: γραμμή changelog ADR-934.

### 2.2 Μ-β5 — κύκλος ζωής καραντίνας (σχέδιο §Μ-β5)
Πρώτα SSoT audit (grep): υπηρεσία κάδου αρχείων, `file-purge.job.ts`, cron jobs, `discardImportBatch`/`settleImportBatch`,
`staging/catalog-media/`. Discard/settle ⇒ κάδος για περιεχόμενο χωρίς άλλη ανοιχτή παρτίδα · cron δίχτυ 7 ημερών ·
καθαρισμός προσωρινών `staging/catalog-media/` · **επαναφορά** από κάδο αντί για `contentUnavailable`.
Plan Mode, έγκριση Giorgio, κώδικας + ADR στο ίδιο commit, tests μόνο με έγκριση.

## 3. Ανοιχτά (μόνο με «ναι»)
- ADR-884: μία γραμμή για το `perGroup` της `priority-task-queue`.
- `sniffImageFormat` (avatar) / `isPdfHeader` (handover) να ζητούν το `content-signature`. · HEIC/WOFF στο μητρώο τύπων.
- Κεφαλίδα `outbound-url-guard.ts` (στρώμα 3) μπαγιάτικη. · TOCTOU (DNS rebinding).
- Πολλοί ρόλοι ανά διεύθυνση: κρίνει ο πρώτος· ξανακρίνεται στο Μ-δ.

## 4. ΜΗΝ
- Κανένα test πέρα από τα εγκεκριμένα, κανένα tsc. Ποτέ `--no-verify` / `SKIP_*`.
- Όχι commit στο `main`· commit μόνο με ρητή λίστα αρχείων. `wt:land` και push μόνο με εντολή, χωριστά.
- Καμία εγγραφή στην παραγωγή χωρίς «ναι». Όχι `git stash` χωρίς ετικέτα.
- Μήνυμα commit ⇒ `Write` + `git commit -F <απόλυτη διαδρομή>` **χωρίς** ανακατεύθυνση `>` (ο φρουρός του worktree αρνείται
  σύνθετες εντολές git — χώρισέ τες).
- Μη μετατρέψεις την ενότητα «Μέσα» σε lazy επιφάνεια (CHECK 3.34). Νέα αύξηση του slice της σελίδας εισαγωγών ⇒ νέα σφράγιση
  με γραπτό `why`, ποτέ σιωπηλά.
