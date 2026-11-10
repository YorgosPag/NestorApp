# HANDOFF — 2026-11-09 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → βήματα 3 και 4 (μετά τα 1–2)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από τον πράκτορα με
ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει tests, άρα **ζήτα έγκριση πριν το commit**.
Προηγούμενο handoff (πλαίσιο Γ1): `docs/handoffs/2026-11-09-accounting-vat-exemption-next.md`.

## 1. Τι ολοκληρώθηκε σε αυτή τη συνεδρία (δες `git log`)
- **Βήμα 1 — `1ae70073`** · ADR-ACC-003 **§22.2**: επικύρωση γραμμών + ποσών στον διακομιστή.
  - `src/subapps/accounting/utils/invoice-amounts.ts` = **Ο ΕΝΑΣ υπολογισμός ποσών** (`lineNetAmount`, `lineVatAmount`,
    `invoiceAmountsOf` — στρογγύλευση ανά γραμμή, σύνολα = άθροισμα γραμμών, σημασιολογία myDATA). Αναγνώστες: φόρμα,
    προεπισκόπηση, `LineItemsEditor`, διακομιστής, `mydata-preflight`, `mydata-payload-builder`.
  - `src/app/api/accounting/invoices/invoice-schemas.ts`: `InvoiceLineItemSchema` (`satisfies z.ZodType<InvoiceLineItem>`),
    `refineInvoiceAmounts`, `invoiceSharedFields` (κοινά POST/PATCH). Αντίφαση = **400 με διαδρομή**, ποτέ σιωπηλή διόρθωση.
  - Ρίζα `MYDATA_INCOME_TYPES` (`types/common.ts`). Διορθώθηκαν: όριο πίστωσης (έβλεπε πάντα 0 €) · λανθάνον
    `NET/VAT_TOTAL_MISMATCH` της φόρμας.
- **Βήμα 2 — commit μαζί με αυτό το handoff** · ADR-ACC-003 **§22.3** + ADR-ACC-011 changelog: αιτία στο `ServicePreset`.
  - `ServicePreset.vatExemptionCategory?: number | null`· το `LineItemsEditor.applyPreset` την κληρονομεί (preset χωρίς αιτία
    δεν σβήνει αιτία της γραμμής· preset ≠ 0% την καθαρίζει).
  - `components/shared/vat-rate-transition.ts` (μετακόμισε από `invoices/forms/invoice-line-vat.ts`): `withVatRate` /
    `withVatExemption` **γενικές** (`VatBearing`).
  - `mydata-codes.ts`: `hasVatExemptionContradiction` — ένας κανόνας για γραμμές **και** presets (διακομιστής).
  - `components/setup/PresetVatFields.tsx` (συντελεστής + αιτία) σε προσθήκη **και** επεξεργασία preset (η επεξεργασία
    δεν είχε επιλογέα ΦΠΑ)· γραμμή προβολής preset 0% δείχνει `VatExemptionLineNote`.
- Επαλήθευση: βήμα 1 — hook 80/80 σουίτες Accounting· βήμα 2 — στοχευμένο jest 71/71 (`vat-rate-transition`,
  `LineItemsEditor`, `adr603-batch2`, `invoice-line-schema`) + hook στο commit. ⚠️ **Δεν** δοκιμάστηκε στην οθόνη.

## 2. Επόμενο: βήμα 3 → βήμα 4 (Plan Mode ανά βήμα, Opus — εγκεκριμένο)
**Βήμα 3 — Δηλωμένη απαλλαγή εταιρείας.** Σήμερα `vatRegime: 'normal' | 'exempt'` (`types/company.ts` ~γρ. 111,
`components/setup/FiscalInfoSection.tsx`) δεν λέει **ποια** απαλλαγή. Πεδίο κωδικού από τον κατάλογο
(`VAT_EXEMPTION_REASONS`) όταν `exempt`· νέα γραμμή τιμολογίου ξεκινά 0% + αυτή η αιτία (`newInvoiceLineItem` στο
`invoices/forms/invoice-line-defaults.ts`, πιθανώς και `InvoiceForm`). ⚠️ `company-profile-field-mask.ts` γράφει
`vatRegime: 'common'` — έλεγξε την ασυμφωνία λεξιλογίου **πριν** από κώδικα. Επαναχρησιμοποίησε `PresetVatFields`
/ `VatExemptionReasonField`, `withVatRate`/`withVatExemption`, `hasVatExemptionContradiction` (και στο API του
προφίλ εταιρείας). Μικρές επιχειρήσεις (άρθρο 39 → 44 ν. 5144/2024, κωδ. ΑΑΔΕ 15) — **επιβεβαίωσε από επίσημη πηγή**.
**Βήμα 4 — Προεπιλογή ανά πελάτη** (π.χ. ΕΕ με έγκυρο ΑΦΜ): **πρόταση με πηγή, ποτέ σιωπηλή εφαρμογή** (νομική κρίση).
Τα 5 (VATEX / EN 16931) και 6 (κωδικοί δήλωσης ΦΠΑ) **μόνο μετά από έρευνα** (μόνο επίσημες πηγές ΑΑΔΕ/νόμων).

Πριν από κώδικα: Φάση 1 N.0.1 (ADR-ACC-003 §22.1–22.3 vs κώδικας) → **SSoT audit με grep** → Plan Mode → ExitPlanMode.

## 3. Προτάσεις εκτός εντολής (ΜΗΝ τις υλοποιήσεις χωρίς «ναι»)
- Ο διακομιστής να **γράφει** ο ίδιος σύνολα / `balanceDue` / `withholdingAmount` (σήμερα μόνο τα ελέγχει).
- Υπολείμματα `Math.round(…*100)/100`: παρακράτηση στο `InvoiceForm.tsx` (2 σημεία) · `JournalEntryForm.tsx:140`.
- `InvoicePreview.tsx`: hardcoded «ΦΠΑ {rate}%» (N.11).
- `components/shared/VATRateSelector.tsx`: δικό του αντίγραφο `24/13/6/0` αντί για `GREEK_VAT_RATES`.
- `InvoiceDetails.tsx` ~γρ. 210: hardcoded «Βεβαιώσεις Παρακράτησης →» (N.11).

## 4. ΜΗΝ
- ΜΗ διαγράψεις το `src/subapps/accounting/services/mydata/` ως «νεκρό» (`9a92a079`).
- ΜΗΝ κάνεις δοκιμαστική εγγραφή τιμολογίου στην παραγωγή.
- ΜΗ χρησιμοποιήσεις πίνακες αιτιών τρίτων (invoicemaker/SingularLogic διαφωνούν) — μόνο ΑΑΔΕ.
- ΜΗΝ ξαναγράψεις υπολογισμό ποσών — **μόνο** `utils/invoice-amounts.ts`.
