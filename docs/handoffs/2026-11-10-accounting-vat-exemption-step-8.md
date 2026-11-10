# HANDOFF — 2026-11-10 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → ζωντανή επαλήθευση βήματος 7 + βήμα 8

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test / scan / `jscpd` χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από
τον πράκτορα με ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει σουίτες, άρα **ζήτα έγκριση πριν το commit**.
Απαντήσεις **πάντα στα ελληνικά**. Μεγάλο περιεχόμενο ⇒ `Write`, όχι heredoc (N.19 — και **καμία** μεταβλητή shell
μέσα σε εντολή git/npm: ο φρουρός του worktree την αρνείται).
Προηγούμενο handoff: `docs/handoffs/2026-11-10-accounting-vat-exemption-step-7.md`.

## 1. Κατάσταση (επαληθευμένη 2026-11-10)
- Βήμα 7 = **ADR-ACC-003 §22.8** «Έλεγχος πριν την έκδοση» — εντάχθηκε στο `main` με `wt:land` ως `a392e96e`.
  Ο Giorgio έκανε push· **αναμένεται deploy** (GitHub → Netcup → nestorconstruct.gr). **Ο Giorgio θα ειδοποιήσει**
  όταν ολοκληρωθεί — ΜΗΝ ξεκινήσεις ζωντανή επαλήθευση πριν.
- Επαλήθευση πριν το land: 17 σουίτες / 205 tests πράσινα · `jscpd:diff` καθαρό (14 αρχεία) · hook: 84 έλεγχοι +
  104 σουίτες Accounting/Type Safety πράσινα.
- Στο land: σύγκρουση **μόνο** στο παραγόμενο `src/types/i18n.ts` ⇒ rebase, εκδοχή `main`, `npm run generate:i18n-types`
  (ποτέ χειρόγραφη διόρθωση). Το ίδιο θα ξανασυμβεί σε κάθε αλλαγή locale όσο άλλες συνεδρίες αλλάζουν locales.

## 2. Τι έκανε το βήμα 7 (πλήρες: ADR-ACC-003 §22.8)
- `services/invoices/review-severity.ts` — ρίζα βαθμίδων `block` / `warn` / `info`.
- `services/mydata/mydata-preflight.ts` — `MYDATA_PREFLIGHT_SEVERITY` · `isBlockingPreflightIssue` ·
  `preflightMyDataDraft` (περιεχόμενο) · νέος `COUNTERPART_COUNTRY_TYPE_MISMATCH` (`warn`, μόνο 2.2 / 2.3).
- `services/mydata/mydata-payload-builder.ts` — σταματά μόνο σε `block`· `warnings` στο `ok: true`.
- `services/tax/invoice-vat-review.ts` — πρώτος καταναλωτής των §22.6 / §22.7.
- `services/invoices/invoice-review.ts` — συνθέτης `reviewInvoiceDraft` (βαθμίδα, άγκυρα, σφάλματα ΑΑΔΕ 217 / 243 / 244 / 287).
- UI: `forms/invoice-field-ids.ts` (μία πηγή `id`) · `use-invoice-review.ts` · `InvoiceReviewSummary.tsx` ·
  `invoice-review-presentation.tsx` · inline ευρήματα στο `LineItemsEditor` · i18n `invoices.review.*` el + en.
- 🔑 Η ΑΑΔΕ **δεν** δημοσιεύει πίνακα «τύπος → χώρα» (ελέγχθηκαν myDATA ERP v1.0.9, v1.0.12, Providers v2.0.2).

## 3. ΠΡΩΤΑ: ζωντανή επαλήθευση του βήματος 7 (μόλις πει ο Giorgio ότι τελείωσε το deploy)
Στο nestorconstruct.gr → Λογιστική → Νέο τιμολόγιο (browser = εργαλείο που ζήτησε ο Giorgio):
1. Κενή φόρμα ⇒ πίνακας «Έλεγχος πριν την έκδοση» με `block` «Λείπει ο ΑΦΜ του πελάτη» (αναμενόμενο — λίστα
   ετοιμότητας, όχι σφάλμα πεδίου)· «Μετάβαση στο πεδίο» εστιάζει τον ΑΦΜ πελάτη.
2. Τύπος 2.2 με πελάτη GR ⇒ `warn` χώρα × τύπος, «Προλαμβάνει τα σφάλματα ΑΑΔΕ 243 / 244 / 287».
3. Γραμμή 0% χωρίς αιτία ⇒ `block` + 217· «Μετάβαση» ανοίγει/εστιάζει τον επιλογέα αιτίας της γραμμής.
4. Αιτία 4 με Έλληνα πελάτη ⇒ `warn` αντίφαση, inline κάτω από τη γραμμή **και** στη σύνοψη, ίδιο κείμενο.
5. Αιτία 1 ⇒ `info` «…το πεδίο της δήλωσης ΦΠΑ (Φ2)…». Αιτία 5 ⇒ «…Φ2 και … EN 16931» (σύνδεσμος από `formatList`).
6. Πελάτης ΕΕ με ΑΦΜ + 2.2 + αιτία 4 + έγκυρα στοιχεία ⇒ «Κανένα εύρημα: … έτοιμο για διαβίβαση».
7. Αγγλικά (en): ίδια ροή, κανένα ωμό κλειδί. Σκοτεινό θέμα: εικονίδια ορατά.
Αν κάτι αποτύχει ⇒ αναφορά με στιγμιότυπο, **καμία** διόρθωση χωρίς «ναι».

## 4. ΜΕΤΑ: βήμα 8 — ΔΕΝ έχει οριστεί. Ρώτα τον Giorgio (AskUserQuestion)
Υποψήφια (κανένα χωρίς «ναι»):
1. **Ένδειξη «Αντίστροφη επιβάρυνση»** στο PDF (Οδηγία 2006/112 άρθρο 226 §11α / ν. 4308/2014) — ο επιλυτής EN 16931
   δίνει ήδη `AE` (αιτία 16).
2. **Προεπισκόπηση Φ2**: σύνολα ανά πεδίο 342 / 345 / 348 / 349 / 310 ανά περίοδο, πάνω στη `vat-engine` (καταναλωτής
   του `resolveVatReturnTreatment`).
3. **Έλεγχος VIES** του ΑΦΜ ΕΕ (σήμερα η πρόταση §22.5 φέρει `vatNumberNotVerified`· θα μπορούσε να γίνει εύρημα του
   ελέγχου §22.8).
4. **Εξειδίκευση VATEX ανά υπηρεσία** (`fidelity: 'article'` → `exact`).
5. Από τα «Εκτός εμβέλειας» της §22.8: ενημέρωση λήπτη αιτίας 16 (VAT_366) ως `info` · αποθήκευση ευρημάτων στον
   διακομιστή / επιβεβαίωση `warn` κατά τη διαβίβαση · προφίλ `gr-b2g-peppol` (B2G).
Πρόταση πράκτορα: **1** (μικρό, ορατό, νομική υποχρέωση στο παραστατικό) ή **3** (κλείνει την επιφύλαξη) — αποφασίζει ο Giorgio.

## 5. Ροή για ό,τι επιλεγεί
Plan Mode · έρευνα σε **επίσημες** πηγές (ΑΑΔΕ / ΓΓΠΣ / EC / CEN / νόμος) · **πραγματικό SSoT audit με grep** πριν από
κώδικα (σημεία εκκίνησης: `services/invoices/`, `services/tax/*`, `services/mydata/*`, `services/pdf/`,
`components/invoices/forms/`, `lib/intl-formatting.ts`) · ποιότητα «μεγάλων παικτών» · ADR-ACC-003 νέα **§22.9** +
Decision Log στο ίδιο commit.

## 6. ΜΗΝ
- ΜΗΝ αλλάξεις τους πίνακες §22.6 / §22.7 χωρίς νέα επίσημη πηγή **και** ενημέρωση ADR.
- ΜΗΝ κάνεις το `COUNTERPART_COUNTRY_TYPE_MISMATCH` `block` χωρίς **επίσημο** πίνακα τύπος → χώρα.
- ΜΗΝ προσθέσεις κανόνα στο UI: ό,τι κρίνεται, κρίνεται στο `mydata-preflight` / `invoice-vat-review` και φαίνεται
  μέσω του `reviewInvoiceDraft`. Νέος κωδικός ⇒ βαθμίδα + άγκυρα + i18n el/en (το `satisfies Record` το επιβάλλει).
- ΜΗ σβήσεις `vat-return-treatment.ts` / `en16931-vat-treatment.ts` / `vat-return-form.ts` ως «νεκρά».
- ΜΗ διορθώσεις χειρόγραφα το `src/types/i18n.ts` — `npm run generate:i18n-types`.
- Γνωστά, **μη** εγκεκριμένα: ωμά ελληνικά της παρακράτησης στο `InvoiceForm.tsx` · κύρια συνάρτηση `LineItemsEditor` > 40 γρ.
