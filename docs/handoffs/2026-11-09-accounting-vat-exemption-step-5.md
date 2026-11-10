# HANDOFF — 2026-11-09 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → βήμα 5 (μετά τα 1–4)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test / scan / `jscpd` χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από
τον πράκτορα με ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει σουίτες, άρα **ζήτα έγκριση πριν το commit**.
Προηγούμενο handoff: `docs/handoffs/2026-11-09-accounting-vat-exemption-step-4.md`.

## 1. Τι υπάρχει στο κλαδί (`git log`, όλα χωρίς land/push)
- Βήμα 1 `1ae70073` (§22.2) · βήμα 2 `7ded8024` (§22.3) · βήμα 3 `e42e29c8` (§22.4).
- **Βήμα 4 — §22.5 «Πρόταση ΦΠΑ από τον πελάτη»** (το commit αυτού του handoff). Πλήρης περιγραφή:
  ADR-ACC-003 §22.5 (`src/subapps/accounting/docs/adrs/ADR-ACC-003-mydata-aade-integration.md`).
  - `services/config/eu-member-states.ts` — ρίζα 27 κρατών μελών (`GR`, όχι `EL`).
  - `services/tax/customer-vat-treatment.ts` — **ο ΕΝΑΣ κριτής** (καθαρός): `assessCustomerVatTreatment(customer, type)`
    → `suggestion` / `unknown_country` / `none`· κωδ. 4, τύπος 2.2/2.3, βάση `art18_2a`/`art18_15`, επιφυλάξεις.
  - `invoices/forms/customer-vat-application.ts` (`plan…` = προεπισκόπηση **και** εφαρμογή · `revert…` = αναίρεση χωρίς
    απώλεια) · `use-customer-vat-suggestion.ts` · `CustomerVatSuggestionNotice.tsx` · `use-company-line-vat-default.ts`
    (μεταφορά αυτούσια από `InvoiceForm.tsx`, τώρα 454 γραμμές).
  - `CustomerSelector.tsx`: επιλογέας χώρας, ΑΦΜ 9 ψηφίων/μοναδικότητα μόνο για Έλληνα. `InvoiceForm.tsx`: τύποι από
    `INVOICE_TYPES` (εμφανίζονται 2.2/2.3).
  - `utils/address/country-codes.ts` + `common:countries.*`: +19 κράτη ΕΕ (ADR-332 changelog).
  - Γεννήτορες i18n έτρεξαν (`src/types/i18n.ts`, `src/i18n/generated/shell-slice.*`).
  - Tests **γραμμένα, ΑΤΡΕΧΤΑ** (εκτός αν τα έτρεξε ο hook στο commit — δες το αποτέλεσμα του commit στο `git log`):
    `services/tax/__tests__/customer-vat-treatment.test.ts` · `services/config/__tests__/eu-member-states.test.ts` ·
    `components/invoices/forms/__tests__/customer-vat-application.test.ts`.
  - ⚠️ **Δεν δοκιμάστηκε στην οθόνη**. ⚠️ `jscpd:diff` (N.18) δεν έτρεξε.

## 2. Επόμενο: βήμα 5 — VATEX / EN 16931 (ΜΟΝΟ μετά από έρευνα, Plan Mode)
**Στόχος**: κάθε αιτία §8.3 να έχει αντιστοίχιση σε **VATEX** (CEF code list, EN 16931 «VAT exemption reason code») +
κατηγορία ΦΠΑ EN 16931 (UNCL5305: `E` απαλλαγή · `AE` αντίστροφη επιβάρυνση · `K` ενδοκοινοτική · `G` εξαγωγή ·
`O` εκτός πεδίου · `Z` μηδενικός) — για ηλεκτρονική τιμολόγηση (Peppol / πάροχοι ΑΑΔΕ, ν. 4308/2014 & B2B e-invoicing).
Ερευνητικά ερωτήματα (μόνο επίσημες πηγές: ΑΑΔΕ, CEF/EC eInvoicing, CEN, OpenPeppol):
1. Δημοσιεύει η ΑΑΔΕ επίσημη αντιστοίχιση §8.3 ↔ VATEX / UNCL5305 (π.χ. στην προδιαγραφή e-invoicing / παρόχων);
2. Ο κωδ. 4 (τόπος παροχής, §22.5) είναι `AE` (αντίστροφη επιβάρυνση, ενδοκοινοτική B2B υπηρεσία) ή `O`;
   `VATEX-EU-AE` vs `VATEX-EU-O` — ανάλογα με σενάριο ⇒ ίσως η αντιστοίχιση είναι **(κωδικός, σενάριο)**, όχι μόνο κωδικός.
3. Πού ζει: **επέκταση** του `VAT_EXEMPTION_REASONS` (`services/config/vat-exemption-reasons.ts`) με ταυτότητες, ποτέ
   δεύτερος κατάλογος. Κοινό SSoT για PDF, payload myDATA και μελλοντικό UBL.
**Βήμα 6** (μετά το 5): κωδικοί δήλωσης ΦΠΑ (Φ2) ανά αιτία — επίσης μόνο μετά από έρευνα.

## 3. Ανοιχτές προτάσεις (ΜΗΝ τις υλοποιήσεις χωρίς «ναι» του Giorgio)
- Τρέξιμο των 3 νέων tests + `jscpd:diff` (αν δεν τα κάλυψε ο hook) · δοκιμή στην οθόνη (σενάρια στο ADR §22.5).
- ADR-ACC-004 §9.1 γράφει «δεν κάνει ενδοκοινοτικές» — πλέον ανακριβές.
- Ένδειξη «Αντίστροφη επιβάρυνση» στο PDF του 2.2 (έρευνα ν. 4308/2014 πρώτα) — σχετίζεται με το βήμα 5.
- Έλεγχος VIES (δίκτυο) · τύποι 1.2/1.3 (αγαθά) · ίχνος αποδοχής πρότασης στο τιμολόγιο ·
  `resolveCustomer` (`services/sales-accounting/sales-accounting-helpers.ts`) γράφει πάντα `country: 'GR'`.
- Από παλαιότερα: «-EX» διασυνοριακό καθεστώς μικρών · προειδοποίηση απαλλασσόμενης εταιρείας με υπηρεσία 24% ·
  ο διακομιστής να γράφει σύνολα/`balanceDue`/`withholdingAmount` · `Math.round(…*100)/100` υπολείμματα ·
  N.11 σε `InvoicePreview.tsx`/`InvoiceDetails.tsx`/`InvoiceForm.tsx` (παρακράτηση: «Χωρίς παρακράτηση», «Ποσό
  παρακράτησης») · `VATRateSelector.tsx` αντίγραφο `24/13/6/0`.

## 4. ΜΗΝ
- ΜΗ διαγράψεις το `src/subapps/accounting/services/mydata/` ως «νεκρό» (`9a92a079`).
- ΜΗ χρησιμοποιήσεις πίνακες αιτιών τρίτων (invoicemaker/SingularLogic διαφωνούν) — μόνο ΑΑΔΕ / EC / CEN.
- ΜΗΝ ξαναγράψεις `utils/invoice-amounts.ts`, `hasVatExemptionContradiction`, `companyLineVatDefault`,
  `assessCustomerVatTreatment`, `planCustomerVatApplication` — επέκτεινέ τα.
- ΜΗΝ εφαρμόσεις αιτία σιωπηλά. ΜΗΝ κάνεις δοκιμαστική εγγραφή τιμολογίου στην παραγωγή.
- Μεγάλα `grep -rn … src` στο Bash κολλάνε — `git grep` ή στοχευμένη διαδρομή. Περιεχόμενο > 6.000 χαρακτήρων ⇒ `Write`
  σε αρχείο, όχι heredoc (N.19). Σύνθετες εντολές με `git` μέσα σε `for`/`cd` απορρίπτονται από την απομόνωση worktree.
