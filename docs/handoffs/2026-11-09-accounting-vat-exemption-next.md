# HANDOFF — 2026-11-09 — Λογιστική: αιτία εξαίρεσης ΦΠΑ (Γ1) → βελτιώσεις επιπέδου «μεγάλων παικτών»

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree** (`EnterWorktree` με το path). Στο `main` κανένα commit.
`wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio. Κανένα test χωρίς έγκρισή του. Κανένα `tsc`.

## 1. Τι ολοκληρώθηκε (commit σε αυτό το κλαδί — δες `git log`)
Γ1 «αιτία εξαίρεσης ΦΠΑ» — πλήρης περιγραφή: **ADR-ACC-003 §22.1** (+ changelog), ADR-ACC-018 changelog.
- Κατάλογος 31 κωδικών ΑΑΔΕ §8.3 v2.0.2: `src/subapps/accounting/services/config/vat-exemption-reasons.ts`
  (μόνο ταυτότητες: κωδικός + ομάδα · `vatCodeEditionAt` · `vatExemptionCitation(t, code, issueDate)`).
- Κείμενα: `src/i18n/locales/{el,en}/accounting-vat-exemptions.json` (διατύπωση ΑΑΔΕ κατά λέξη, ν. 2859/2000
  **και** ν. 5144/2024 — σε ισχύ από 11/10/2024· τίτλοι άρθρων από τον κωδικοποιημένο Κώδικα ΦΠΑ ΑΑΔΕ 04/2026).
  Namespace καταχωρημένο: `namespace-loaders.ts`, `lazy-config.ts`, `namespace-manifest.json`· παραγόμενα
  (`types/i18n.ts`, `i18n/generated/*`) ξαναφτιάχτηκαν με `generate:i18n-types` + `generate:i18n-shell-slice`.
- Ένας κανόνας «λείπει αιτία»: `isVatExemptionMissing` / `requiresVatExemption` στο `mydata-codes.ts`
  (τον καλούν φόρμα **και** `mydata-preflight.ts`).
- Φόρμα: `components/shared/VatExemptionReasonField.tsx` (+ `VatExemptionLineNote`), `invoices/forms/invoice-line-vat.ts`
  (εκτός 0% η αιτία → `null`, και από preset), `LineItemsEditor.tsx`, `InvoiceForm.tsx` (περνά `issueDate`), `InvoiceDetails.tsx`.
- PDF: `services/pdf/invoice-pdf-vat-exemption.ts` (ν. 4308/2014 άρθρο 9 — παραπομπή στη διάταξη)·
  `INVOICE_DOCUMENT_LANGUAGE` μετακόμισε στο `invoice-pdf-constants.ts`.

## 2. Επαλήθευση
- ✅ Ο pre-commit hook του `4f576c64` έτρεξε τις περιοχές **Accounting + Type Safety**: **90/90 suites πράσινες**
  (μαζί τα νέα `config/__tests__/vat-exemption-reasons.test.ts`, `pdf/__tests__/invoice-pdf-vat-exemption.test.ts`,
  `invoices/forms/__tests__/invoice-line-vat.test.ts`, και το ενημερωμένο `LineItemsEditor.units.test.tsx`)· 84 παράλληλοι
  έλεγχοι πράσινοι.
- ⚠️ Ο πράκτορας **δεν** έτρεξε `tsc` (N.17)· **δεν** δοκιμάστηκε στην οθόνη (φόρμα, PDF).

## 3. Επόμενο βήμα — βελτιώσεις (πρόταση εγκεκριμένης σειράς 1 → 2 → 3 → 4· τα 5–6 μετά από έρευνα)
Πρότυπο μεγάλων παικτών: **η αιτία ζει στον φορολογικό κωδικό / είδος / πελάτη, όχι πληκτρολογείται ανά γραμμή**
(NetSuite tax codes με legal justification · Xero default tax ανά contact · EN 16931 BT-120/BT-121 VATEX).
1. **Επικύρωση γραμμών στον διακομιστή** — σήμερα `lineItems: z.array(z.record(z.unknown()))` στο
   `src/app/api/accounting/invoices/route.ts` και `invoice-schemas.ts`. Σχήμα γραμμής (zod) με `vatExemptionCategory`
   μέλος του καταλόγου· εκτός 0% → `null`.
2. **Αιτία στο `ServicePreset`** (πεδίο + φόρμα `components/setup/ServicePresetsSection.tsx` + API
   `src/app/api/accounting/setup/presets/route.ts`)· το `applyPreset` του `LineItemsEditor` τη μεταφέρει (μέσω
   `withLineVatRate` + νέο πέρασμα αιτίας).
3. **Δηλωμένη απαλλαγή εταιρείας** — σήμερα `vatRegime: 'normal' | 'exempt'` (`types/company.ts:111`,
   `FiscalInfoSection.tsx`) δεν λέει **ποια** απαλλαγή. Πεδίο κωδικού από τον κατάλογο όταν `exempt`· νέα γραμμή ξεκινά
   0% + αυτή η αιτία. Προσοχή: `company-profile-field-mask.ts` γράφει `vatRegime: 'common'`.
4. **Προεπιλογή ανά πελάτη** (π.χ. ΕΕ με έγκυρο ΑΦΜ) — **πρόταση με πηγή, ποτέ σιωπηλή εφαρμογή** (νομική κρίση).
5. Αντιστοίχιση ΑΑΔΕ §8.3 → **VATEX (EN 16931)** στον κατάλογο — προετοιμασία Β2 (πάροχος, προθεσμία 31/01/2027).
6. Αντιστοίχιση αιτίας → **κωδικοί δήλωσης ΦΠΑ** (π.χ. 342/312 — taxheaven πρακτικό βοήθημα 09/2025) για το `vat-engine`.
Ό,τι δεν είναι μονοσήμαντο → `null` → μπλοκάρει (πρότυπο `mydata-codes.ts`).

Πριν από κώδικα: N.8 αξιολόγηση → N.14 μοντέλο → Φάση 1 N.0.1 (ADR-ACC-003 §22.1 vs κώδικας) → **SSoT audit με grep**.

## 4. Παρατηρήσεις εκτός εντολής (μόνο πρόταση — ΜΗΝ τις υλοποιήσεις χωρίς «ναι»)
- `components/shared/VATRateSelector.tsx` κρατά δικό του αντίγραφο `24/13/6/0` αντί για `GREEK_VAT_RATES`.
- `InvoiceDetails.tsx` ~γρ. 210: hardcoded «Βεβαιώσεις Παρακράτησης →» (N.11).
- Το `docs/handoffs/2026-11-09-accounting-open-items.md` (Γ1) δεν ενημερώθηκε για το κλείσιμο του πεδίου.

## 5. ΜΗΝ
- ΜΗ διαγράψεις το `src/subapps/accounting/services/mydata/` ως «νεκρό» (`9a92a079`).
- ΜΗΝ κάνεις δοκιμαστική εγγραφή τιμολογίου στην παραγωγή.
- ΜΗ χρησιμοποιήσεις πίνακες αιτιών τρίτων (invoicemaker/SingularLogic διαφωνούν) — μόνο ΑΑΔΕ.
