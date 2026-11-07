# HANDOFF — Λογιστική: ζωντανή επαλήθευση ΕΦΚΑ + ό,τι ΔΕΝ έχει υλοποιηθεί στα ADR (2026-11-07)

**Worktree:** `C:\Nestor_Worktrees\accounting-competitive-parity` (η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree)
**Κλαδί:** `agent/accounting-competitive-parity`
**Κανόνες:** commit ΜΟΝΟ στο κλαδί `agent/*`, με ρητή λίστα αρχείων · ΟΧΙ commit στο `main` · `wt:land` και `push` ΜΟΝΟ με εντολή Giorgio · κανένα test/jscpd χωρίς έγκριση · όχι tsc · όχι `git stash` · όχι `git add -A`.
**Ποιότητα:** επίπεδο μεγάλων παικτών (SAP / Xero / QuickBooks / DATEV), full enterprise + full SSoT, χωρίς εκπτώσεις. Αμφιβολία για νόμο ή πρακτική ⇒ έρευνα στο διαδίκτυο. ΠΡΙΝ από κώδικα: πραγματικό SSoT audit (grep), επαναχρησιμοποίηση, όχι διπλότυπα.

## 1. Τι έγινε (κλειστό, ζωντανό)

- **ΕΦΚΑ: Βιβλίο Ε-Ε = ΜΙΑ πηγή** — commit `54cda54e` → land `3631e34e` → push → **live `edb639e`** (deploy 42363717447 success, 2026-11-07).
  - SSoT `ledgerTaxTotals` / `isEfkaContribution` / `filterLedgerEntries` / `scaleLedgerTaxTotals` στο `src/subapps/accounting/services/journal/journal-ledger.ts`.
  - Αφαιρέθηκε η αφαίρεση από εγγραφές πληρωμών ΕΦΚΑ από κάθε υπολογισμό φόρου· `TaxResult.efkaContributions` + γραμμή στο TaxDashboard (ατομική).
  - ADR: **ADR-ACC-006 §7.1** (νέα), ADR-ACC-009 «Ενημέρωση 2026-11-07», ADR-ACC-010 changelog.
- Επαλήθευση στην οθόνη (2026-11-07): `/accounting/reports`, εταιρεία **ΑΕ**, 2026: έσοδα 145.161,29 € · έξοδα 0 · ΕΦΚΑ 0 · φορολογητέο 145.161,29 € · υποχρέωση 58.483,86 € — αμετάβλητα, όπως αναμενόταν (καμία εγγραφή `efka`). Το νέο κουτί της ατομικής ΔΕΝ ελέγχθηκε (η εταιρεία είναι ΑΕ).

## 2. ΕΡΓΑΣΙΑ 1 — Πλήρης ζωντανή επαλήθευση ΕΦΚΑ (ΕΓΚΡΙΘΗΚΕ από Giorgio)

Στην παραγωγή (`https://nestorconstruct.gr`, Claude in Chrome):
1. Καταχώριση **μίας** εγγραφής εξόδου κατηγορίας «ΕΦΚΑ» (μικρό ποσό, π.χ. 10 €, σημείωση «δοκιμή επαλήθευσης»).
2. Έλεγχος: Αναφορές & Φόρος → «Εταιρικός Φόρος ΑΕ»: «Συνολικά έξοδα» **χωρίς** την ΕΦΚΑ, γραμμή «ΕΦΚΑ» = 10 €, φορολογητέο = έσοδα − έξοδα − ΕΦΚΑ (ΜΙΑ αφαίρεση). Κάρτα επισκόπησης «Σύνολο Εξόδων» = ΟΛΑ τα έξοδα (μαζί η ΕΦΚΑ). P&L / Σύνοψη Φόρων της περιόδου: ΕΦΚΑ ως δική της γραμμή, ΟΧΙ και μέσα στην ανάλυση εξόδων.
3. **Αντιλογισμός (storno)** της εγγραφής αμέσως μετά — ΟΧΙ διαγραφή (το βιβλίο κρατά ίχνος· βλ. `journal-ledger.ts` σχόλιο Storno). Επιβεβαίωση ότι τα σύνολα επιστρέφουν στα αρχικά.
4. ⚠️ Ό,τι ζητά επιβεβαίωση/irreversible κουμπί → ενημέρωσε πρώτα· μην προκαλέσεις browser dialogs.

## 3. ΕΡΓΑΣΙΑ 2 — Ό,τι ΔΕΝ έχει υλοποιηθεί στη λογιστική (ΕΓΚΡΙΘΗΚΕ: «ό,τι ακόμη δεν έγινε»)

**Βήμα 1 (πριν από κώδικα):** σάρωσε ΟΛΑ τα `src/subapps/accounting/docs/adrs/ADR-ACC-*.md` και φτιάξε πίνακα «σχεδιασμένο στο ADR ↔ υπάρχει στον κώδικα (grep)». Κώδικας = αλήθεια. Παρουσίασε τον πίνακα στον Giorgio με **προτεινόμενη σειρά** (κρίσιμο νομικά/οικονομικά πρώτα) και ΠΕΡΙΜΕΝΕ «ναι» πριν από υλοποίηση (N.(-2) §4). Αν > 5 αρχεία & 2+ domains → πρόταση Orchestrator vs Plan Mode (N.8).

**Ήδη γνωστά ανοιχτά (επαλήθευσε με grep — μπορεί να άλλαξαν):**
- **ADR-ACC-006 §7.2** — πληρωμή ΕΦΚΑ → αυτόματη εγγραφή στο Βιβλίο Ε-Ε (ΜΙΑ φορά, ιδεμπότητα: `sourceType:'efka'`, `sourceId:paymentId`), + §7.3 πρόσθετα τέλη ως `other_expense`. Σήμερα: `generateEfkaPaymentId` (`services/enterprise-id-convenience.ts`) και `updateEFKAPayment` χωρίς καλούντα. Χωρίς αυτό: εισφορά εταίρου ΟΕ που πληρώνεται προσωπικά δεν εκπίπτει.
- **Απλός εταίρος ΕΠΕ/ΙΚΕ**: η εισφορά του ΔΕΝ εκπίπτει από την εταιρεία (ΠΟΛ.1113/2015), αλλά αν καταχωρηθεί ως `efka` θα εκπέσει ⇒ ένδειξη «μη εκπιπτόμενο» (συνδέεται με ADR-ACC-022 απόκλιση #4).
- **Οθόνη ΕΦΚΑ** «Εκπιπτόμενο ποσό» (`taxDeductibleAmount` στο `accounting-efka-operations.ts`) = πληρωμές· πρέπει να δείχνει το ποσό του βιβλίου (`ledgerTaxTotals`).
- **Έξυπνη πρόβλεψη ΕΦΚΑ**: καταχωρημένες έως σήμερα + υπόλοιπο από `calculateMonthlyBreakdown` (`services/config/efka-config.ts`) αντί γραμμικής αναγωγής — πάνω στο `ledgerTaxTotals`.
- **`TaxEstimateCard`** ξανακαλεί το endpoint που ήδη καλεί το `useTaxEstimate` (διπλό fetch).
- **`aggregateByCategory`** (`services/reports/profit-and-loss.ts`) = διπλότυπο του `groupNetAmount` (`journal-ledger.ts`).
- **`calculateFullTax`** (`services/accounting-service.ts`) νεκρό· η παράμετρος `efkaTotal` είναι πρόσθετη αφαίρεση — διαγραφή ή σύνδεση.
- **ADR-ACC-022** αποκλίσεις #4 / #5 (◐) · έρευνα #5: μέλος ΔΣ ΑΕ με μετοχές < 3%.
- Ποσά ΕΦΚΑ **2025** δεν επαληθεύτηκαν (ADR-ACC-006 changelog 2026-11-06).

## 4. Tests

Τα tests του προηγούμενου βήματος (`report-tax-basis.test.ts` Φ-1/Φ-7, `tax-engine.test.ts`) γράφτηκαν· τα έτρεξε **μόνο** το pre-commit hook (Accounting 67/67 ✅). Νέα tests: γράφονται, τρέχουν ΜΟΝΟ με έγκριση Giorgio.

## 5. ΜΗΝ

- ΜΗΝ αφαιρείς ΕΦΚΑ από εγγραφές πληρωμών σε ΚΑΝΕΝΑΝ υπολογισμό φόρου (ADR-ACC-006 §7.1).
- ΜΗΝ διαγράφεις εγγραφές βιβλίου — μόνο αντιλογισμός.
- ΜΗΝ αγγίξεις δουλειά άλλων συνεδριών (π.χ. ADR-930, ADR-929, ADR-923) ή αρχεία στο `C:\Nestor_Pagonis`.
- ΜΗΝ `signDisplay:'negative'`.
- Συγκρούσεις `src/types/i18n.ts` στο `wt:land` → `git checkout --ours` + `npm run generate:i18n-types` + `git add` + `GIT_EDITOR=true git rebase --continue`.
- Πριν το push: έλεγξε `gh run list --branch main` — αν τρέχει deploy, ΠΕΡΙΜΕΝΕ να τελειώσει· σπρώξε μόνο μέχρι το δικό σου commit (`git push origin <sha>:refs/heads/main`) όταν το `main` έχει ξένα commits από πάνω.
