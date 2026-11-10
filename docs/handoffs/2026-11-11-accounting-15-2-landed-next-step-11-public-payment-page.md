# HANDOFF — 2026-11-11 — Λογιστική: §15.1 ζωντανά ✅ · §15.2 δεσμευμένο (bbaa61c2) → βήμα 11 (δημόσια σελίδα πληρωμής)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς έγκριση (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί με ρητή λίστα αρχείων.
- Τις τεχνικές αποφάσεις τις παίρνει ο πράκτορας (κριτήριο: Stripe / Xero / QuickBooks / SAP ή καλύτερα, έρευνα σε επίσημες πηγές). Στον Giorgio μόνο «ναι/όχι» για εγγραφή δεδομένων στην παραγωγή, land, push.
- Προηγούμενα handoff (ισχύουν τα §ΜΗΝ τους): `2026-11-10-accounting-15-1-live-verified-next-findings-and-step-11.md` · `2026-11-10-accounting-step-10-live-next-verify-and-step-11.md`.
- ⚠️ Μάθημα: ο έλεγχος αποτελέσματος commit γίνεται με τον κωδικό του **ίδιου** του `git commit` (όχι `; echo $?` μετά από ανακατεύθυνση) + `git log -1`. Το hook τρέχει ~111 σουίτες jest (~45s) — αποτυχία ⇒ το commit **δεν** έγινε.

## 1. Κατάσταση
- **§15.1 ζωντανή επαλήθευση (2026-11-11) ✅**: (1) ομάδα ανενεργών συμπτυγμένη + κουμπί · (2) δοκιμαστικός Eurobank δημιουργία → απενεργοποίηση → επανενεργοποίηση **200**, επέστρεψε **χωρίς** «Στα τιμολόγια» / «Προεπιλογή», μετά ξανά ανενεργός · (3) διπλό IBAN → **409** + μήνυμα στον διάλογο, έμεινε ανενεργός.
  - ⏳ ΔΕΝ επιβεβαιώθηκαν: ίχνος `BANK_ACCOUNT_REACTIVATED` (καμία οθόνη ιστορικού λογαριασμών) · log `info` αντί ERROR (Netcup logs, μόνο Giorgio).
  - Δοκιμαστικά στην παραγωγή: «ΔΟΚΙΜΗ επανενεργοποίησης» Eurobank `GR28 0260 0010 0000 0001 2345 678` (`bacc_0195333c-…`, **ανενεργός**) · ανενεργή Πειραιώς ίδιο IBAN με την ενεργή, BIC `PIABORAA` (`bacc_da1131b1-…`). Ενεργοί: Πειραιώς `PIRBGRAA` (προεπιλογή), Εθνική. Μένουν ως το τέλος του βήματος 11 (μετά διαγραφή μέσω γραφέων με ίχνος).
- **§15.2 στο κλαδί**: `bbaa61c2` (hook ✅) — Giorgio είπε «ναι» στο land 2026-11-11· **push ΟΧΙ** ακόμη. Μετά το push ⇒ ζωντανή επαλήθευση §15.2 (§2).
- ADR-ACC-018 **§15.2** περιέχει την πλήρη περιγραφή. Σύντομα:
  - `bicAgreementWithIBAN` (`src/constants/greek-banks.ts`) = ο ΕΝΑΣ κριτής BIC↔IBAN (BIC8, `GREEK_SUCCESSOR_BICS` 087 ⇒ `STPGGRAA` + `ATTIGRAA`). Τον χρησιμοποιούν φόρμα · γραφέας · `scripts/report-greek-bank-bic.ts`.
  - `BicIbanMismatchError extends DomainRefusal` (422) στο `accounting-repo-bank-accounts.ts` (δημιουργία + κάθε εγγραφή BIC απέναντι στο αποθηκευμένο IBAN). Μετάφραση στο `withBankAccountErrors`. Κλειδί `setup.bankAccounts.errors.bicMismatch`.
  - Φόρμα: `bankSource: 'derived' | 'manual'` + `withManualBank` (`bank-account-form-state.ts`).
  - `withCurrentPaymentAccounts` / `hasLivePaymentAccounts` (`app/api/accounting/invoices/invoice-payment-snapshot.ts`): μεταβλητό (draft/rejected) ⇒ λογαριασμοί σημερινού μητρώου σε **GET** (`invoices/[id]/route.ts`) και **email** (`send-email/route.ts`, που γράφει το σταλμένο `issuer` στην ίδια εγγραφή με το `emailHistory`). Εκδομένο ⇒ στιγμιότυπο.
  - ⚠️ **Δεν υπάρχει διαδρομή διαβίβασης draft → sent.** Όταν γραφτεί, ΠΡΕΠΕΙ να παγώσει το `withCurrentPaymentAccounts` στην ίδια εγγραφή που αλλάζει την κατάσταση (γραμμένο στο docblock + ADR).
  - Test: `adr603-batch3.route.test.ts` — GET εκδομένου ως έχει · GET πρόχειρου ⇒ φρέσκοι λογαριασμοί.

## 2. Ζωντανή επαλήθευση §15.2 (μετά το push του Giorgio)
1. Νέος λογαριασμός: πληκτρολόγησε IBAN Eurobank → τράπεζα/BIC `ERBKGRAA` · άλλαξε σε Optima `GR7103400010000000012345678` **χωρίς** να κλείσεις → πρέπει να γίνει Optima `IBOGGRAA` (όχι Eurobank). Άκυρο — μην αποθηκεύσεις.
2. Γράψε χειροκίνητα BIC `ETHNGRAA` σε IBAN Eurobank → «Καταχώριση» ⇒ μήνυμα `bicMismatch` (χωρίς αίτημα στον διακομιστή).
3. Πρόχειρο **Α-7** (είχε `PIABORAA`): προεπισκόπηση/PDF ⇒ QR γραμμή 5 = `PIRBGRAA`. Μέθοδος PDF/QR: προηγούμενο handoff (iframe `#zoom=` ξαναδημιουργείται).
4. Εκδομένο τιμολόγιο δεν υπάρχει (ΑΑΔΕ ΟΧΙ) — το «αμετάβλητο» καλύπτει το test.

## 3. ΕΠΟΜΕΝΟ — Βήμα 11: δημόσια σελίδα πληρωμής (πλήρες σχέδιο σε **Plan Mode**)
N.8: ~12–18 αρχεία, 3 πεδία ⇒ Plan Mode (όχι orchestrator). Έρευνα που ΕΓΙΝΕ (λεπτομέρειες: §4 του handoff `…15-1-live-verified…`): `qrUrl` myDATA v2.0.2 (δεν αποθηκεύεται πουθενά — πρέπει πριν από την πρώτη διαβίβαση) · IRIS Commerce μόνο μέσω PSP, P2Pro χωρίς ποσό/RF ⇒ IRIS = πρόσθετη επιλογή, όχι αντικατάσταση EPC QR.

**SSoT που ΒΡΕΘΗΚΕ (grep 2026-11-11) — η σελίδα πατά πάνω τους, κανένα δεύτερο σύστημα συνδέσμων:**
- `src/server/sharing/*` — `share-create.ts` (διακριτικό 256 bit, μόνο `tokenHash`, scrypt κωδικός, **υποχρεωτική** λήξη 1ώρα–30μέρες, `mayCreateShare`) · `share-resolve.ts` · `share-revoke.ts` · `share-gate.ts` · `share-open-notice.ts` · `share-token-lookup.ts` · `share-links-list.ts` · `share-refusal-response.ts`.
- `src/services/sharing/share-entity-registry.ts` + `resolvers/` (`file` · `contact` · `spatial-tour` · `showcase-surfaces`) · `share-resolve-contract.ts` (`RESOLVABLE_SHARE_KINDS`, `SHARE_KIND_LINK_POLICY`, `ResolvedShareDataByKind`).
  - Πρότυπο νέου είδους: `resolvers/spatial-tour.resolver.ts` (66 γρ.: `buildSafePublicProjection`, `validateShareBaseInput`, `ShareEntityDefinition`).
  - ⇒ Σχέδιο: νέο είδος **`invoice_payment`** (resolver + γραμμή πολιτικής + `mayCreateShare` = δικαίωμα λογιστικής).
- `src/services/showcase-core` (`createPublicTokenRouteExport`, `public-media.ts`) · `src/lib/sharing/share-token.ts` · `src/lib/qr/qr-code.ts`.
- Οδηγίες πληρωμής: **`withCurrentPaymentAccounts`** (πρόχειρο ⇒ φρέσκο · εκδομένο ⇒ στιγμιότυπο) · `invoicePayableAmount` · `invoiceCreditorReference` · `epc-qr-payload.ts` · `selectInvoicePaymentAccounts`. Η σελίδα **δεν** ξαναγράφει τίποτα από αυτά.
- Πύλες που θα κρίνουν: 3.60 (workspace scope) · 3.74 (read boundary) · 3.78 (rate-limit policy — νέα δημόσια διαδρομή ⇒ γραμμή) · 3.90 (server action boundary) · 3.94 (public reflow) · 3.92 (idempotency, αν υπάρξει POST). Νέο ADR: αριθμός με `ls docs/centralized-systems/reference/adrs/` τη στιγμή που χρειάζεται + ξανά πριν το commit (CHECK 3.49).

**Ερωτήματα που ΠΡΕΠΕΙ να απαντήσει το σχέδιο (με έρευνα — Stripe Hosted Invoice Page, Xero «Online invoice», QuickBooks «Invoice link»):**
1. Τι δείχνει: σύνοψη τιμολογίου (εκδότης, πελάτης, γραμμές, σύνολα, πληρωτέο, λήξη) · λογαριασμοί + RF + EPC QR · λήψη PDF (ίδιος `renderInvoicePDF`) · κατάσταση πληρωμής.
2. Ποιος μπορεί να φτιάξει / ανακαλέσει σύνδεσμο · λήξη · ένα ενεργό ανά τιμολόγιο ή πολλά · ακύρωση τιμολογίου ⇒ σύνδεσμος «μη διαθέσιμος».
3. Πρόχειρο vs εκδομένο: σύνδεσμος μόνο για εκδομένο; (Stripe: μόνο finalized). Αν ναι, μέχρι να υπάρξει διαβίβαση → τι;
4. Σύνδεσμος/QR μέσα στο PDF και στο email (`send-email`) — από τον ίδιο γραφέα.
5. Ιδιωτικότητα: τι **ΔΕΝ** βγαίνει δημόσια (εσωτερικές σημειώσεις, ίχνη, email πελάτη;) · `noindex` · `Referrer-Policy` · rate limit.
6. i18n δημόσιας σελίδας (γλώσσα πελάτη `detectInvoiceEmailLanguage`) · κέλυφος (3.52/3.63/3.72).

## 4. Μικρά ανοιχτά
- Λίστα τραπεζών: «Παγκρήτια Τράπεζα (πλέον CrediaBank)» **και** «CrediaBank» — 016 vs 087 (HEBIC). Σχετίζεται με το `GREEK_SUCCESSOR_BICS`.
- Παρακράτηση στο πληρωτέο (`withholdingAmount: 0` σε όλους τους καλούντες) — ADR-ACC-018 §15 «Εκτός εμβέλειας».

## 5. ΜΗΝ
- ΜΗΝ φτιάξεις δεύτερο σύστημα δημόσιων συνδέσμων — `src/server/sharing/*` + `ShareEntityRegistry`.
- ΜΗΝ ξαναγράψεις κανόνα «ποιοι λογαριασμοί / ποιο BIC» — `invoice-payment-accounts.ts` · `bicAgreementWithIBAN` · `withCurrentPaymentAccounts`.
- ΜΗΝ αλλάξεις snapshot **εκδομένου** τιμολογίου. ΜΗΝ γράψεις στο `accounting_bank_accounts` εκτός `accounting-repo-bank-accounts.ts`.
- ΜΗΝ τρέξεις ανάγνωση/εγγραφή παραγωγής από script χωρίς τον Giorgio.
- ΜΗ σβήσεις Α-3 / Α-4 / Α-5 / Α-6. Καμία διαβίβαση ΑΑΔΕ. ΜΗ διορθώσεις χειρόγραφα `src/types/i18n.ts` / `src/i18n/generated/*`.
