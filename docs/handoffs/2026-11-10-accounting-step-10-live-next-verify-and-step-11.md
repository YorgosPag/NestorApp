# HANDOFF — 2026-11-10 — Λογιστική: βήμα 10 ΖΩΝΤΑΝΟ (0876de7) → ζωντανή επαλήθευση → βήμα 11 (σελίδα πληρωμής)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς έγκριση (N.(-2)). Κανένα `tsc` (N.17).
- Commit στο κλαδί με ρητή λίστα αρχείων (ADR-925). Απαντήσεις **στα ελληνικά**. Μεγάλο περιεχόμενο ⇒ `Write` (N.19).
- Ο φρουρός του worktree αρνείται: μεταβλητές shell, `powershell`, σύνθετα heredoc με git. Μεγάλα scripts ⇒ αρχείο στο scratchpad + `python <αρχείο>`.
- Προηγούμενο handoff: `docs/handoffs/2026-11-10-accounting-bank-accounts-step-10.md`.

## 1. Κατάσταση
- **Βήμα 10 = `0876de77`** στο `main` + origin. Deploy Netcup ✅ (`live 0876de7`, run 42878227267). Firebase: καμία αλλαγή κανόνων/δεικτών.
- Τεκμηρίωση: **ADR-ACC-018 §15** (πλήρης αρχιτεκτονική + αποφάσεις) · ADR-ACC-008 §2 + Decision Log. **Διάβασε την §15 πρώτα.**
- Απόφαση Giorgio: **email πελάτη στο PDF = ΝΑΙ** (Decision Log ADR-ACC-018).
- ⚠️ Τα **5 νέα αρχεία τεστ ΔΕΝ έχουν τρέξει** (μόνο οι πύλες του hook):
  `services/payments/__tests__/{creditor-reference,epc-qr-payload,invoice-payment-accounts}.test.ts` ·
  `services/engines/__tests__/matching-reference-rf.test.ts` · `src/types/contacts/__tests__/banking-bic.test.ts`.
  Επηρεαζόμενα: `services/pdf/__tests__/*`, `engines/__tests__/{matching-candidates,tax-engine,vat-engine}`, `app/api/accounting/__tests__/*`, `invoices/__tests__/*`, tests του repository για `createInvoice`. **Ζήτα έγκριση.**

### Τι υλοποιήθηκε (σύντομα — λεπτομέρειες στην §15)
- Μητρώο `accounting_bank_accounts` (ένας γραφέας `accounting-repo-bank-accounts.ts`, συναλλαγή: μοναδικό IBAN · ακριβώς ένας προεπιλεγμένος · απενεργοποίηση αντί διαγραφής · IBAN αμετάβλητο) + API `/api/accounting/bank-accounts` + ίχνη `BANK_ACCOUNT_*`.
- Διορθώθηκε διαρροή: `getBankAccounts` χωρίς `companyId`.
- Snapshot `issuer.bankAccounts` γράφεται από τον **διακομιστή** (`createInvoice` του repository + PATCH πρόχειρου). Καμία εφεδρεία από το σημερινό μητρώο.
- PDF: Τράπεζα · IBAN · BIC · Δικαιούχος + «Αιτιολογία πληρωμής: RF… (σειρά-αριθμός)» + EPC QR (v3.1, level M, διανυσματικό). Μόνο για μεταφορά / επί πιστώσει / μικτό, ποτέ σε πιστωτικό.
- RF αναγνωρίζεται στη συμφωνία τράπεζας (`extractInvoiceReferences`).
- UI: Ρυθμίσεις → «Τραπεζικοί λογαριασμοί».

## 2. ΕΠΟΜΕΝΟ #1 — Ζωντανή επαλήθευση στο nestorconstruct.gr
Λογαριασμός Giorgio, χώρος `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`. Ο πράκτορας **δεν** κάνει σύνδεση.
Δοκιμαστικά στοιχεία ✅ · διαβίβαση ΑΑΔΕ ❌ · **Α-3 / Α-4 / Α-5 / Α-6 ΜΕΝΟΥΝ**.
1. Ρυθμίσεις λογιστικής → «Τραπεζικοί λογαριασμοί» → νέος με δοκιμαστικό έγκυρο IBAN (π.χ. `GR16 0110 1250 0000 0001 2300 695`). Έλεγχος: αυτόματη τράπεζα + BIC, δικαιούχος = επωνυμία, σήμα «Προεπιλογή».
2. Δεύτερος λογαριασμός → ορισμός ως προεπιλεγμένος ⇒ ο πρώτος χάνει το σήμα (ένας μόνο).
3. Διπλό IBAN ⇒ μήνυμα «Υπάρχει ήδη…» (409).
4. Νέο πρόχειρο με «Τραπεζική Μεταφορά» ⇒ PDF (μέθοδος iframe, §3): πίνακας 4 στηλών, γραμμή RF, QR δεξιά, χωρίς επικάλυψη. **Αποκωδικοποίησε το QR** (π.χ. `jsQR` μέσα στη σελίδα, πάνω σε canvas από το blob) και έλεγξε: `BCD/002/1/SCT/BIC/όνομα/IBAN/EUR<πληρωτέο>//RF…`.
5. Πρόχειρο «Μετρητά» ⇒ **χωρίς** ενότητα λογαριασμών.
6. Τα Α-3 … Α-6 (παλιά snapshot `[]`) ⇒ **χωρίς** λογαριασμούς (σωστό: δεν τους είχαν).
7. Απενεργοποίηση λογαριασμού ⇒ σήμα «Ανενεργός», ο άλλος γίνεται προεπιλεγμένος.

## 3. Μέθοδος ζωντανού ελέγχου PDF που ΔΟΥΛΕΥΕΙ
1. `javascript_tool`: παράκαμψη `HTMLAnchorElement.prototype.click` + `EventTarget.prototype.dispatchEvent` για `a[download]` ⇒ το blob URL στο `window.__pdfUrls`, χωρίς αποθήκευση.
2. Μενού «⋯» → «Λήψη PDF».
3. `<iframe src="blobUrl#zoom=page-width&toolbar=0">` `position:fixed; inset:0; z-index:max` μέσα στη σελίδα της εφαρμογής.
4. Screenshot της καρτέλας της εφαρμογής (η καρτέλα blob δεν φωτογραφίζεται) · `zoom` για λεπτομέρεια.
5. Αφαίρεση iframe πριν από πλοήγηση.

## 4. ΕΠΟΜΕΝΟ #2 — Βήμα 11: δημόσια σελίδα πληρωμής (link + QR στο PDF)
**Μεγάλο έργο ⇒ N.8: ΠΡΩΤΑ πρόταση τρόπου εκτέλεσης (Plan Mode / Orchestrator) στον Giorgio, μετά Plan Mode.**
- Πρότυπα: Stripe Hosted Invoice Page · Xero «View and pay online» · QuickBooks «Pay now».
- Περιεχόμενο-στόχος: δικαιούχος / IBAN / BIC / τράπεζα με κουμπιά αντιγραφής · RF · EPC QR · **ζωντανή κατάσταση** (απλήρωτο / μερικώς / εξοφλημένο / ακυρωμένο με πιστωτικό, υπόλοιπο, λήξη) · ΜΑΡΚ + σύνδεσμος επαλήθευσης ΑΑΔΕ (αντι-απάτη) · νέα λήψη PDF · επικοινωνία εκδότη · «Πλήρωσα» (+ αποδεικτικό) · αργότερα κάρτα (Viva / Stripe).
- 🆕 **Εξέτασε IRIS** (ΔΙΑΣ): πληρωμή με ΑΦΜ / QR από όλες τις μεγάλες ελληνικές τράπεζες — πιθανώς **καλύτερο** από EPC QR για Έλληνες λήπτες. Έρευνα σε επίσημες πηγές (dias.com.gr, τράπεζες) πριν από απόφαση.
- ⚖️ Περιεχόμενο τιμολογίου αμετάβλητο· «ζωντανή» μόνο η κατάσταση.
- 🔒 Δημόσια σελίδα με προσωπικά δεδομένα: αμάντευτο κλειδί, ανάκληση/λήξη, όριο ρυθμού, `noindex`, ελάχιστα στοιχεία. Πύλες: 3.60 · 3.74 · 3.78 (νέα `defineRoute` διαδρομή ⇒ γραμμή στο `declarations` του `.rate-limit-policy-baseline.json`, πρότυπο `f62b9a06`) · 3.90 · 3.94.
- ❓ `qrUrl` απάντησης myDATA: **επαλήθευσε** στην τεκμηρίωση ΑΑΔΕ (myDATA API v2.0.1) πριν βασιστείς.
- Νέο ADR: αριθμός με `ls` τη στιγμή που χρειάζεται.
- SSoT audit με grep **πριν** από κώδικα: υπάρχοντα δημόσια token routes (`createPublicTokenRouteExport`, `showcase-core`), `qr-code.ts`, `invoicePaymentReference`, `paymentQrPayload`, `showsPaymentInstructions`.

## 5. Ευρήματα εκτός εντολής (ΔΕΝ αγγίχτηκαν — κανένα χωρίς «ναι»)
1. Κανόνες Firestore επιτρέπουν εγγραφή από browser στο `accounting_bank_accounts` (παράκαμψη γραφέα + ίχνους) ⇒ πρόταση: άρνηση client writes.
2. Όλοι οι καλούντες του PDF περνούν `withholdingAmount: 0` ⇒ «ΠΛΗΡΩΤΕΟ» και QR = μικτό, χωρίς παρακράτηση.
3. `useCustomCategories` διαβάζει `data.categories`, το API απαντά `{ data: [...] }` ⇒ πιθανώς κενή λίστα κατηγοριών (ανεπιβεβαίωτο).
4. `getInvoice` / `updateInvoice` / `getInvoiceSeries` (repo-financial) χωρίς φράχτη `companyId`.
5. Διπλό `formatIBAN` (`invoice-pdf-constants.ts` + `src/types/contacts/banking.ts`).
6. `.rate-limit-policy-baseline.json`: `declaration_count` (124) ≠ μήκος λίστας (127) — προϋπήρχε η απόκλιση.
7. Από πριν: VIES · προεπισκόπηση Φ2 · αντίστροφη επιβάρυνση στο `InvoicePreview` · `creditWarning` · VATEX ανά υπηρεσία.

## 6. ΜΗΝ
- ΜΗΝ φτιάξεις δεύτερη σχεδίαση λογαριασμών/QR: `drawBankAccountsSection`, `invoice-pdf-payment-qr.ts`.
- ΜΗΝ ξαναγράψεις RF/EPC/κανόνες: `services/payments/*`, `invoiceCreditorReference` (matching-reference).
- ΜΗΝ γράψεις στο `accounting_bank_accounts` εκτός `accounting-repo-bank-accounts.ts`.
- ΜΗ βάλεις εφεδρεία «σημερινό μητρώο» στο PDF — τυπώνεται μόνο το snapshot.
- ΜΗ διορθώσεις χειρόγραφα `src/types/i18n.ts` ή `src/i18n/generated/*` — `npm run generate:i18n-types` · `npm run generate:i18n-shell-slice:index`.
- ΜΗ σβήσεις τα Α-3 / Α-4 / Α-5 / Α-6. Καμία διαβίβαση ΑΑΔΕ.
