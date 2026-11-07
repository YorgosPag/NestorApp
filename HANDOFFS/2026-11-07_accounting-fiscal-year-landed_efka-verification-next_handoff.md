# Handoff — Λογιστική: χρήση ανοίγει αυτόματα (Φ9-Α) + «Λογιστικές χρήσεις» (Φ9-Β) LANDED · επόμενο: push → ζωντανή επαλήθευση ΕΦΚΑ → σάρωση ADR-ACC

- **Ημερομηνία:** 2026-11-07
- **Worktree:** `C:\Nestor_Worktrees\accounting-competitive-parity` (η νέα συνεδρία συνεχίζει ΕΔΩ)
- **Κλαδί:** `agent/accounting-competitive-parity`
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-07_accounting-reversal-live-verification_handoff.md` (§2 ΕΦΚΑ, §3 σάρωση ADR — ισχύουν)

## 1. Κατάσταση

| Τι | Commit στο `main` (τοπικά) | Push |
|---|---|---|
| Handoff προηγούμενης συνεδρίας | `749066c5` | ❌ |
| **Φ9-Α** — η χρήση υπάρχει πριν τη χρειαστεί κανείς | `a63ffa44` | ❌ |
| **Φ9-Β** — ενότητα «Λογιστικές χρήσεις» στη «Ρύθμιση Επιχείρησης» | `47297550` | ❌ |

- Έγινε `wt:land` (εντολή Giorgio). **ΔΕΝ έγινε push** ⇒ τίποτα δεν είναι ακόμη στην παραγωγή (nestorconstruct.gr).
- Στο land: σύγκρουση ΜΟΝΟ στο παραγόμενο `src/types/i18n.ts` ⇒ `git checkout --ours` + `npm run generate:i18n-types` (rebase μέσα στο worktree).
- Tests (εγκεκριμένα): 5 σουίτες Φ9-Α = 236/236 · `fiscal-period-actions.test.ts` 6/6 · pre-commit και των δύο commits πράσινο (69 / 82 σουίτες λογιστικής).
- Τεκμηρίωση: `src/subapps/accounting/docs/adrs/ADR-ACC-010-portability-abstraction-layers.md` §2.1.1 «Φάση 9» + «Φάση 9-Β» + 2 γραμμές Decision Log.

### Φ9-Α (server)
- `openFiscalYear` (repo `accounting-repo-fiscal-periods.ts`) = ο ΕΝΑΣ γραφέας: 13 περίοδοι όλες-ή-καμία σε μία συναλλαγή + ίχνος `FISCAL_YEAR_OPENED` (origin `setup|posting|manual`) · `ifExists: refuse|accept` · μερική ⇒ `FiscalYearIncompleteError` (409, ποτέ επισκευή).
- Παράθυρο αυτόματου ανοίγματος `[max(τρέχον−1, έτος έναρξης), τρέχον+1]`, ημέρα Αθήνας — `services/fiscal-year-window.ts`.
- Πρωτεύουσα διαδρομή: `PUT /api/accounting/setup` → `ensureFiscalYear(..., 'setup')` (αποτυχία = log, η αποθήκευση δεν αποτυγχάνει).
- Δίχτυ: `validatePostingAllowed` → `openFiscalYearAutomaticallyFor` · route αντιλογισμού ανοίγει πρώτα τη χρήση του «σήμερα».

### Φ9-Β (UI)
- `components/setup/FiscalPeriodsSection.tsx` + `FiscalPeriodActionDialog.tsx` + `hooks/useFiscalPeriods.ts` πάνω στα ΥΠΑΡΧΟΝΤΑ `GET/POST /fiscal-periods`, `PATCH /fiscal-periods/[periodId]`.
- Ενέργειες μόνο με `useCapability('admin_access')`· κουμπιά από `fiscalPeriodActionsFrom` (παράγωγο του `TRANSITIONS` του γραφέα)· διάλογος εφαρμογής (λόγος υποχρεωτικός στην επαναφορά)· ξαναδιάβασμα λίστας μετά από κάθε πράξη.
- `API_ROUTES.ACCOUNTING.FISCAL_PERIODS` · i18n `accounting:fiscalPeriods.manage.*` (el/en) · `PERIOD_NOT_FOUND` οδηγεί στη «Ρύθμιση Επιχείρησης → Λογιστικές χρήσεις».

## 2. Επόμενο βήμα (με σειρά)

1. **Push — ΜΟΝΟ με εντολή Giorgio.** Πριν: `gh run list --branch main`. Μετά: περίμενε deploy Netcup.
2. **Ενεργοποίηση χρήσης 2026 στην ΑΕ:** άνοιξε «Ρύθμιση Επιχείρησης» → «Αποθήκευση» (ανοίγει τη χρήση, origin `setup`) — ή απλώς η πρώτη καταχώρηση την ανοίγει. Έλεγξε στην ενότητα «Λογιστικές χρήσεις» ότι 2026 = 13 ανοιχτές περίοδοι.
3. **Ζωντανή επαλήθευση ΕΦΚΑ** (ακριβώς όπως στο §2 του προηγούμενου handoff):
   - URL: `https://nestorconstruct.gr/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/accounting/journal`
   - ΜΙΑ εγγραφή 10 € «Εισφορές ΕΦΚΑ» (έξοδο, ΦΠΑ 0%, σημείωση «δοκιμή επαλήθευσης»). **ZOOM στην κατηγορία πριν το «Δημιουργία»** (κλικ έπεσε κάποτε σε «Καύσιμα»).
   - Έλεγχος: Corporate Tax ΑΕ «Συνολικά έξοδα» ΧΩΡΙΣ ΕΦΚΑ, «ΕΦΚΑ» = 10 €, φορολογητέο = 145.151,29 € · κάρτα «Σύνολο Εξόδων» = 10 € · P&L / Σύνοψη Φόρων: ΕΦΚΑ δική της γραμμή, αφαιρείται ΜΙΑ φορά.
   - Αμέσως **«Αντιλογισμός»**, λόγος «Λάθος καταχώριση» — ΠΟΤΕ διαγραφή.
   - Επιστροφή ΑΚΡΙΒΩΣ στη βάση: έσοδα 145.161,29 € · έξοδα 0 · ΕΦΚΑ 0 · φορολογητέο 145.161,29 € · υποχρέωση 58.483,86 €.
   - Κανένας διάλογος browser.
4. **Εργασία 2 — σάρωση `src/subapps/accounting/docs/adrs/ADR-ACC-*.md`** → πίνακας «σχεδιασμένο ↔ υπάρχει στον κώδικα» (grep) → προτεινόμενη σειρά (νομικά/οικονομικά κρίσιμα πρώτα) → **περίμενε «ναι»** → υλοποίηση. >5 αρχεία & 2+ domains ⇒ ρώτα Orchestrator vs Plan Mode (N.8).
   Γνωστά ανοιχτά: φρουρός τραπεζικής συμφωνίας (αντίστροφος σύνδεσμος από matching engine) · αντιλογισμός από παραστατικό εξόδου (SAP MR8M + ADR-917) · ακύρωση τιμολογίου ως μία συναλλαγή · ADR-ACC-006 §7.2/§7.3 · ADR-ACC-022 #4/#5 · οθόνη ΕΦΚΑ «Εκπιπτόμενο» από `ledgerTaxTotals` · `calculateMonthlyBreakdown` · διπλό fetch `TaxEstimateCard` · διπλότυπο `aggregateByCategory` · νεκρό `calculateFullTax` · ποσά ΕΦΚΑ 2025 · `accounting-repo-financial.getJournalEntry` διαβάζει χωρίς έλεγχο μισθωτή.
   Νέα ανοιχτά Φ9: `FiscalYearPicker` δείχνει μόνο [τρέχον−5, τρέχον] · μη ημερολογιακή χρήση / `fiscalYearEnd` αδιάβαστο (θέλει έρευνα ν.4308/2014 — μόνο πρόταση).

## 3. Κανόνες (αμετάβλητοι)
- Commit ΜΟΝΟ στο `agent/accounting-competitive-parity` με ρητή λίστα αρχείων· ΠΟΤΕ στο `main`· ΠΟΤΕ `git add -A`.
- `wt:land` και push ΜΟΝΟ με εντολή Giorgio.
- Κανένα test / jscpd χωρίς έγκριση· ΠΟΤΕ tsc.
- ΠΟΤΕ διαγραφή εγγραφών βιβλίου· ΠΟΤΕ αφαίρεση ΕΦΚΑ από πληρωμές στους φορολογικούς υπολογισμούς.
- Νέο `defineRoute` ⇒ γραμμή στο `.rate-limit-policy-baseline.json`.
- Σύγκρουση `src/types/i18n.ts` ⇒ `git checkout --ours` + `npm run generate:i18n-types`.
- Stash μόνο με μοναδικό tag + apply με SHA. Μην αγγίζεις δουλειά άλλων συνεδριών (ADR-923/928/929/930/property-dossier) ούτε το `C:\Nestor_Pagonis`.
- Πριν από κώδικα: πραγματικό SSoT audit (grep)· ποιότητα SAP / Xero / DATEV, χωρίς εκπτώσεις· έρευνα στο διαδίκτυο όπου υπάρχει αβεβαιότητα για νόμο/πρακτική.
