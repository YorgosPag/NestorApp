# HANDOFF — 2026-11-10 — Λογιστική: βήμα 9 (3 ελαττώματα PDF/φόρμας) → επαλήθευση + ζωντανός έλεγχος + βήμα 10

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς την έγκρισή του (N.(-2)). Κανένα `tsc` (N.17).
- Commit στο κλαδί από τον πράκτορα με ρητή λίστα αρχείων (ADR-925). Ο hook τρέχει σουίτες, άρα **ζήτα έγκριση πριν από το commit**.
- Απαντήσεις **πάντα στα ελληνικά**. Μεγάλο περιεχόμενο ⇒ `Write`, όχι heredoc (N.19).
- **Καμία** μεταβλητή shell μέσα σε εντολή (`f=…; sed $f`): ο φρουρός του worktree την αρνείται.
- Προηγούμενο handoff: `docs/handoffs/2026-11-10-accounting-vat-exemption-step-9.md`.

## 1. Κατάσταση (2026-11-10)
- **Βήμα 8 (ADR-ACC-003 §22.9)**: επαληθεύτηκε **ζωντανά** στο nestorconstruct.gr με τρία δοκιμαστικά πρόχειρα τιμολόγια. Κανένα δεν διαβιβάστηκε στην ΑΑΔΕ, και ο Giorgio είπε να **μείνουν**.
  - **Α-3** (2.2, DE, αιτία 4): ✅ ενικός.
  - **Α-4** (2.2, DE, αιτίες 4 + 16): ✅ πληθυντικός «Γραμμές 1, 2», άρθρα 18 / 45.
  - **Α-5** (ΤΠΥ, GR, αιτία 15): ✅ χωρίς μπλοκ αντίστροφης επιβάρυνσης, άρθρο 44.
- **Βήμα 9 = ADR-ACC-003 §22.10 + ADR-ACC-018 §14**: γράφτηκε και έγινε commit στο κλαδί.
  - ⚠️ **Δεν έχει τρέξει κανένα jest / jscpd από πράκτορα.** Ο hook του commit έτρεξε ό,τι τρέχει ο ίδιος (δες το `git log -1`).
- Λογαριασμός: Giorgio, χώρος `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`. Ο πράκτορας **δεν** κάνει σύνδεση.

## 2. Τι έκανε το βήμα 9
- **(α) Κεφαλίδα PDF** — νέο `services/pdf/invoice-pdf-parties.ts`, όπου μετακόμισαν οι `drawHeader` / `drawCustomerSection`.
  - Η δεξιά στήλη μετριέται πρώτα (`getTextWidth`). Ο εκδότης αναδιπλώνεται στο υπόλοιπο πλάτος: `δεξί άκρο − φαρδύτερη − 6mm`, ελάχιστο 60mm.
  - Τέλος η επικάλυψη «Δραστηριότητα» ↔ «Ημ/νία Έκδοσης».
  - Νέος κοινός βοηθός `drawWrappedLines` στο `invoice-pdf-constants.ts`, που επιστρέφει το y μετά τις πραγματικές γραμμές.
- **(β) Πελάτης**.
  - Η διεύθυνση βγαίνει από `formatContactAddressLine` (`utils/address/address-line.ts`): πόλη + Τ.Κ. και χωρίς οδό, ελληνικός Τ.Κ. «546 21».
  - Η χώρα τυπώνεται «Γερμανία / Germany» μέσω του νέου `utils/address/country-label-text.ts` → `countryLabelIn`. Ακολουθεί το ιδίωμα των `uomLabelIn` / `global-role-text`.
  - Το πλαίσιο μετριέται πριν σχεδιαστεί (ελάχιστο 22mm).
  - ⚖️ ν. 4308/2014 άρθρο 9 §1 **ε** (πλήρης διεύθυνση πωλητή και πελάτη) · Οδηγία 226 §5.
- **(γ) «Invoice not found» μετά τη «Δημιουργία»**.
  - Νέος τύπος `InvoiceCreatedResponse` (`types/invoice.ts`), που τον δηλώνει ο route (`created<InvoiceCreatedResponse>`).
  - Νέο `forms/invoice-submit.ts` → `submitInvoice`, μέσω `apiClient`. Τα σφάλματα περνούν από το ίδιο `invoiceSubmitErrorMessage` (`apiErrorBodyOf`).
  - Το `InvoiceForm.tsx` δεν κάνει πια χειροκίνητο `fetch`.
  - `InvoiceDetails.tsx`: «Invoice not found» / «Back» ⇒ `invoices.notFound` (νέο, el + en) / `forms.back`.
  - Το `src/types/i18n.ts` ξαναπαράχθηκε.
- **Tests γραμμένα, ΟΧΙ εκτελεσμένα**:
  - Νέα `services/pdf/__tests__/invoice-pdf-parties.test.ts` (Κ1–Κ5, ψεύτικο jsPDF που καταγράφει θέσεις).
  - Νέα `components/invoices/forms/__tests__/invoice-submit.test.ts` (Κ1–Κ4).
  - Αλλαγμένη `components/invoices/__tests__/invoice-transport-migration.test.tsx`: περιμένει το κλειδί `invoices.notFound` αντί για το ωμό κείμενο.

## 3. ΠΡΩΤΑ: επαλήθευση (ζήτα έγκριση πριν από ΚΑΘΕ εκτέλεση)
1. Jest στις 4 σουίτες:
   - `invoice-pdf-parties.test.ts`
   - `invoice-submit.test.ts`
   - `invoice-transport-migration.test.tsx`
   - `invoice-pdf-vat-exemption.test.ts`
2. `npm run jscpd:diff` στα αλλαγμένα αρχεία `src`.
3. Αν κάτι αποτύχει: αναφορά με ακριβές output· διόρθωση μόνο με «ναι».
4. Μετά, με εντολή Giorgio: `wt:land` + push.
   - Στο land, πιθανή σύγκρουση **μόνο** στο `src/types/i18n.ts`. Η λύση: `git rebase main` · `git checkout --ours src/types/i18n.ts` · `npm run generate:i18n-types` · `git add` · `git -c core.editor=true rebase --continue`.
5. **Ζωντανός έλεγχος μετά το deploy**, στα Α-3 / Α-4 / Α-5 → PDF.
   - Τι πρέπει να φαίνεται:
     - Η κεφαλίδα δεν έχει επικάλυψη, και η «Δραστηριότητα» αναδιπλώνεται.
     - Το Α-3 δείχνει «München, 80331» και «Χώρα / Country: Γερμανία / Germany».
     - Το Α-5 δείχνει «Εγνατίας 1, Θεσσαλονίκη, 546 30» χωρίς γραμμή χώρας.
     - Νέα «Δημιουργία» ανοίγει κατευθείαν το τιμολόγιο (όχι `?view=undefined`).
   - ⚙️ Η καρτέλα PDF (blob) **δεν** φωτογραφίζεται από τον πράκτορα, και η φόρτωση pdf.js από CDN **απορρίφθηκε** από τον φρουρό.
   - Η μέθοδος που δούλεψε:
     - Μέσα στη σελίδα, παράκαμψη των `HTMLAnchorElement.prototype.click` και `EventTarget.prototype.dispatchEvent` για `a[download]`, ώστε να μη σωθεί αρχείο.
     - Μετά `window.open(blobUrl)`.
     - Στο τέλος, ο Giorgio στέλνει στιγμιότυπο.
   - ⚙️ Επιλογέας αιτίας (Radix): η λίστα μετακινείται όταν ανοίγει, οπότε **έλεγξε την τιμή μετά το κλικ** (μία φορά μπήκε 11 αντί για 15).

## 4. ΑΝΟΙΧΤΕΣ ερωτήσεις για τον Giorgio (ρώτα, μην αποφασίσεις)
- **Email πελάτη στο PDF**: το ADR-ACC-018 Decision Log 2026-03-17 λέει «ΔΕΝ εμφανίζεται (GDPR)», αλλά ο κώδικας το τύπωνε ήδη και το κρατήσαμε. Μένει ή φεύγει;
- **Βήμα 10**: δεν έχει οριστεί. Υποψήφια, κανένα χωρίς «ναι»:
  1. Έλεγχος **VIES** του ΑΦΜ ΕΕ (κλείνει το `vatNumberNotVerified` της §22.5).
  2. **Προεπισκόπηση Φ2** (342/345/348/349/310) πάνω στη `vat-engine`.
  3. Ένδειξη αντίστροφης επιβάρυνσης στο `InvoicePreview.tsx`, μαζί με το i18n χρέος «ΦΠΑ {vatRate}%» (`InvoicePreview.tsx:34`) και «Χωρίς παρακράτηση» (`InvoiceForm.tsx`).
  4. Εμφάνιση του `creditWarning` της απάντησης POST στη φόρμα (σήμερα δεν το δείχνει κανείς).
  5. Εξειδίκευση VATEX ανά υπηρεσία.

## 5. Ροή για ό,τι επιλεγεί
- Plan Mode.
- Έρευνα σε **επίσημες** πηγές (ΑΑΔΕ / ΓΓΠΣ / EC / νόμος).
- **Πραγματικό SSoT audit με grep** πριν από κώδικα.
- ADR-ACC-003 νέα §22.11 + Decision Log στο ίδιο commit.

## 6. ΜΗΝ
- ΜΗΝ ξαναγράψεις τοπικά τη γραμμή διεύθυνσης ή το όνομα χώρας: υπάρχουν `formatContactAddressLine` / `countryLabelIn`.
- ΜΗΝ βάλεις `import common.json` στο `country-codes.ts`. Το εισάγει μισή εφαρμογή, γι' αυτό υπάρχει το `country-label-text.ts`.
- ΜΗΝ επιστρέψεις σε χειροκίνητο `fetch` στη φόρμα τιμολογίου. Το συμβόλαιο είναι το `InvoiceCreatedResponse`.
- ΜΗΝ αλλάξεις τη φράση «Αντίστροφη επιβάρυνση» (κατά λέξη, C-247/21) ούτε τους πίνακες §22.6 / §22.7 χωρίς επίσημη πηγή.
- ΜΗ διορθώσεις χειρόγραφα το `src/types/i18n.ts` — `npm run generate:i18n-types`.
- ΜΗ σβήσεις τα δοκιμαστικά Α-3 / Α-4 / Α-5. Ο Giorgio είπε να μείνουν.
- Γνωστά, **μη** εγκεκριμένα:
  - Το διπλό κείμενο της «Δραστηριότητας». Είναι δεδομένο του προφίλ, `profile.profession`.
  - Η αχρησιμοποίητη `quarter` στο `InvoiceForm.handleSubmit`.
  - Η `handleSubmit` > 40 γρ.
  - Το τοπικό `splitTextToSize` στις σημειώσεις και στη σημείωση ΦΠΑ.
