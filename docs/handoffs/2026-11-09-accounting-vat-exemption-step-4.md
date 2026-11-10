# HANDOFF — 2026-11-09 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → βήμα 4 (μετά τα 1–3)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από τον πράκτορα με
ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει τις σουίτες Accounting, άρα **ζήτα έγκριση πριν το commit**.
Προηγούμενα handoffs: `2026-11-09-accounting-vat-exemption-steps-3-4.md` · `2026-11-09-accounting-vat-exemption-next.md`.

## 1. Τι υπάρχει στο κλαδί (δες `git log`, όλα χωρίς land/push)
- **Βήμα 1 — `1ae70073`** · ADR-ACC-003 §22.2: επικύρωση γραμμών/ποσών στον διακομιστή· `utils/invoice-amounts.ts` =
  ο ΕΝΑΣ υπολογισμός ποσών· `api/accounting/invoices/invoice-schemas.ts`.
- **Βήμα 2 — `7ded8024`** · §22.3: `ServicePreset.vatExemptionCategory`, κληρονομείται στο `LineItemsEditor.applyPreset`·
  `components/shared/vat-rate-transition.ts` (`withVatRate`/`withVatExemption`)· `hasVatExemptionContradiction`.
- **Βήμα 3 — `e42e29c8`** · §22.4: δηλωμένη απαλλαγή εταιρείας.
  - `types/company.ts`: ρίζα `COMPANY_VAT_REGIMES`, `vatExemptionCategory?: number | null` στο προφίλ.
  - `services/setup/company-vat-regime.ts` = **ο ΕΝΑΣ κριτής**: `companyLineVatDefault(profile)` (καθεστώς → αφετηρία
    γραμμής) · `withVatRegime` · `parseCompanyVatRegime` (PUT setup: 400 σε άγνωστο καθεστώς / κωδικό εκτός §8.3 /
    αντίφαση — ο PUT **δεν** επικύρωνε καθόλου το `vatRegime` πριν).
  - `vat-rates.ts`: `GREEK_EXEMPT_VAT_RATE`. `FiscalInfoSection.tsx`: επιλογέας αιτίας στο `exempt`.
  - `invoices/forms/invoice-line-defaults.ts`: `newInvoiceLineItem(n, vat)` · `isPristineInvoiceLine` ·
    `reseedPristineInvoiceLines`. `LineItemsEditor` prop `lineVatDefault` (υποχρεωτικό). `InvoiceForm`:
    `useCompanyLineVatDefault` — το προφίλ φτάνει μετά τη φόρμα ⇒ αλλάζουν **μόνο ανέγγιχτες** γραμμές, ποτέ σε επεξεργασία.
  - Επαλήθευση: στοχευμένο jest 96/96 (5 σουίτες) + hook 94/94. ⚠️ **Δεν** δοκιμάστηκε στην οθόνη.
  - `InvoiceForm.tsx` = **490 γραμμές** (όριο 500) ⇒ νέα λογική εκεί πρέπει να **εξαχθεί** σε hook/module.

## 2. Επόμενο: βήμα 4 — πρόταση αιτίας ανά πελάτη (Plan Mode, Opus — εγκεκριμένο)
**Στόχος**: όταν ο πελάτης του τιμολογίου υποδηλώνει απαλλαγή (π.χ. επιχείρηση ΕΕ με έγκυρο ΑΦΜ ΕΕ ⇒ ενδοκοινοτική
παροχή υπηρεσιών / παράδοση· πελάτης εκτός ΕΕ ⇒ εξαγωγή / εκτός πεδίου), η φόρμα **ΠΡΟΤΕΙΝΕΙ** συντελεστή 0% + αιτία
**με την πηγή της** («γιατί» + διάταξη)· ο άνθρωπος αποδέχεται ή απορρίπτει. **ΠΟΤΕ σιωπηλή εφαρμογή** — νομική κρίση.

Τι να ερευνήσεις/αποφασίσεις (Φάση 1 N.0.1 πρώτα: ADR-ACC-003 §22.1–22.4 vs κώδικας):
1. **Μοντέλο πελάτη** — grep: `InvoiceCustomer` (`types/invoice.ts`), `CustomerSelector.tsx`, επαφές (ADR-332),
   πεδία χώρας/ΑΦΜ/ΕΕ. Υπάρχει ήδη έλεγχος VIES ή «χώρα πελάτη»; (`MYDATA_COUNTERPART_REQUIRED`, `service_invoice_eu`
   = 2.2 στο `mydata-codes.ts`). Αν υπάρχει χώρα/VIES, **επαναχρησιμοποίησέ το**.
2. **Ποιοι κωδικοί §8.3** αντιστοιχούν σε ποιο σενάριο (ενδοκοινοτική παροχή υπηρεσιών, ενδοκοινοτική παράδοση,
   εξαγωγή, τόπος παροχής εκτός Ελλάδας) — **ΜΟΝΟ** από επίσημες πηγές ΑΑΔΕ / Κώδικα ΦΠΑ (ν. 5144/2024). Ο κατάλογος
   και τα κείμενα: `services/config/vat-exemption-reasons.ts` + `locales/{el,en}/accounting-vat-exemptions.json`.
3. **Σχέση με το είδος παραστατικού**: ο τύπος `service_invoice_eu` (2.2) μάλλον πρέπει να συμβαδίζει με την πρόταση.
4. **Μοτίβο UI**: πρόταση με πηγή + «Εφαρμογή» / «Απόρριψη» (ποτέ αυτόματα)· ποτέ πάνω σε γραμμή που άγγιξε ο
   άνθρωπος· σειρά προτεραιότητας: γραμμή > υπηρεσία (§22.3) > πελάτης (πρόταση) > εταιρεία (§22.4). Έρευνα πώς το
   κάνουν Xero (tax rate by contact), NetSuite (nexus / tax code), SAP — και πρόταση πιο έξυπνης λύσης.
5. Ο κανόνας «πρότεινε» να είναι **καθαρή συνάρτηση** (σενάριο → `{vatRate, code, reasonKey}` | `null`), δοκιμάσιμη,
   κοινή για φόρμα και (αργότερα) preflight.

**Μετά το 4**: τα 5 (VATEX / EN 16931) και 6 (κωδικοί δήλωσης ΦΠΑ) **μόνο μετά από έρευνα**.

## 3. Προτάσεις εκτός εντολής (ΜΗΝ τις υλοποιήσεις χωρίς «ναι»)
- Διασυνοριακό καθεστώς μικρών επιχειρήσεων: ΑΦΜ με επίθεμα **«-EX»** σε κάθε τιμολόγιο (Οδηγός ΑΑΔΕ 29/01/2026) — πεδίο.
- Προειδοποίηση όταν απαλλασσόμενη εταιρεία έχει υπηρεσία 24%.
- Ο διακομιστής να **γράφει** ο ίδιος σύνολα / `balanceDue` / `withholdingAmount` (σήμερα μόνο τα ελέγχει).
- Υπολείμματα `Math.round(…*100)/100`: παρακράτηση στο `InvoiceForm.tsx` (2 σημεία) · `JournalEntryForm.tsx:140`.
- N.11: `InvoicePreview.tsx` hardcoded «ΦΠΑ {rate}%» · `InvoiceDetails.tsx` ~γρ. 210 «Βεβαιώσεις Παρακράτησης →».
- `components/shared/VATRateSelector.tsx`: δικό του αντίγραφο `24/13/6/0` αντί για `GREEK_VAT_RATES`.

## 4. ΜΗΝ
- ΜΗ διαγράψεις το `src/subapps/accounting/services/mydata/` ως «νεκρό» (`9a92a079`).
- ΜΗΝ κάνεις δοκιμαστική εγγραφή τιμολογίου στην παραγωγή.
- ΜΗ χρησιμοποιήσεις πίνακες αιτιών τρίτων (invoicemaker/SingularLogic διαφωνούν) — μόνο ΑΑΔΕ.
- ΜΗΝ ξαναγράψεις υπολογισμό ποσών (`utils/invoice-amounts.ts`) ή κανόνα αντίφασης (`hasVatExemptionContradiction`)
  ή αφετηρία γραμμής (`companyLineVatDefault` / `newInvoiceLineItem`) — επέκτεινέ τα.
- ΜΗΝ εφαρμόσεις αιτία σιωπηλά.
- Μεγάλα `grep -rn … src` στο Bash κολλάνε (>120s) — χρησιμοποίησε `git grep` ή στοχευμένη διαδρομή.
