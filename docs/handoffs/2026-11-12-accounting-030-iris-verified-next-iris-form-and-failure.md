# Handoff — ADR-ACC-030 «Πληρωμή τώρα»: IRIS επαληθεύτηκε ⇒ επόμενο IRIS στη φόρμα + σενάριο αποτυχίας

**Ημερομηνία:** 2026-11-12
**Worktree:** `C:\Nestor_Worktrees\accounting-next`
**Κλαδί:** `agent/accounting-next`
**ADR:** `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md`
**Προηγούμενο handoff:** `docs/handoffs/2026-11-12-accounting-030-iris-unlocked-next-iris-live-test.md`

## 1. Κατάσταση

- ✅ **IRIS ενεργό στο sandbox και επαληθευμένο ζωντανά.** Καταγραφή στο ADR §5.9 #2 + changelog, commit `ca55360b`.
  Καμία αλλαγή κώδικα.
  - Τιμολόγιο **Α-12** (`inv_a7e634ab-a92c-4757-a35e-0c41e985c577`), 12,40 €. Πελάτης «ΔΟΚΙΜΗ Everypay sandbox»,
    πλασματικός ΑΦΜ `123456783` (σωστό ψηφίο ελέγχου). Σύνδεσμος «Δοκιμή IRIS Α-12» (`share_8adda890-…`).
    Συνεδρία `pchk_23d2493a-d769-4432-af5c-cfa8d0e37d08`.
  - Το sandbox στέλνει σε **προσομοιωτή IRIS** (`sandbox-dashboard.everypay.gr/iris-emulator`): «Δημιουργία QR» ή
    «Επιλέξτε τράπεζα» ⇒ κουμπιά «Επιτυχής Ταυτοποίηση» / «Αποτυχία Ταυτοποίησης».
  - Logs: επιστροφή browser `authorized-source` · webhook `authorized-source` ⇒ `recorded` · δεύτερο webhook
    `payment-reference` (`pmt_`, κεφαλίδα υπογραφής) ⇒ `unchanged` · συμφιλίωση `pending 0`.
  - Ο φόβος «διπλή χρέωση πηγής» δεν εμφανίστηκε· μένει θεωρητικός για **επανάληψη** του webhook `hash`.
  - ⚠️ Δεν ελέγχθηκε το Firestore (`payments[]` με `method: 'iris'`, ίχνος, `payment_provider_events`): η κονσόλα
    Firebase **πάγωσε** στο Chrome (renderer χωρίς απάντηση, 4 προσπάθειες). Τα logs + η Λογιστική «Εξοφλημένο»
    αποδεικνύουν την καταγραφή.
- Commits στο κλαδί **χωρίς land**: `1d259b97`, `5e237f9d`, `ece9074e`, `ca55360b` και το commit αυτού του handoff.
  **wt:land και push ΜΟΝΟ με εντολή Giorgio.**

## 2. Επόμενα βήματα (Giorgio: «ΟΚ ΣΥΝΕΧΙΣΕ» — επιβεβαίωσε τη σειρά μαζί του πριν από κώδικα)

1. **Επιλογή IRIS στη φόρμα τιμολογίου.** Ο τρόπος πληρωμής («Κατάσταση Πληρωμής») προσφέρει μόνο Μεταφορά ·
   Κάρτα · Μετρητά · Επιταγή · Πίστωση · Μικτός. Το μοντέλο έχει `'iris'` ⇒ myDATA 8 (ADR §3).
   - Πρώτα: πραγματικό SSoT audit (`git grep` για τη λίστα επιλογών, τα κλειδιά i18n el/en, το `PaymentMethod`,
     το `MYDATA_PAYMENT_METHOD_CODES`, το `isPayableByLink` / `showsPaymentInstructions`). Πες στον Giorgio τι
     βρήκες και τι θα αλλάξει, **μετά** κώδικας.
2. **Σενάριο αποτυχίας IRIS:** νέο τιμολόγιο + σύνδεσμος ⇒ ο Giorgio πατά «Αποτυχία Ταυτοποίησης».
   Αναμένεται: σήμα `ignored` (`iris-authorization-failed`, `irisSignalOf` στο `everypay-adapter.ts`), καμία
   χρέωση, τιμολόγιο «Απλήρωτο», η συνεδρία μένει `pending` και κλείνει `expired` 24 ώρες μετά τη λήξη
   (`IRIS_ABANDON_AFTER_MS`). ⚠️ Τι δείχνει η δημόσια σελίδα μετά την επιστροφή με αποτυχία («καταχωρείται» για
   15′;) — **διάβασε τον κώδικα και πες το πριν τη δοκιμή.**
3. Προαιρετικά: ξαναδοκίμασε την κονσόλα Firebase για το Α-12 (`payments[]`, `PAYMENT_RECORDED`,
   `payment_provider_events`).

## 3. Εκκρεμότητες που περιμένουν απόφαση Giorgio (μην τις υλοποιήσεις χωρίς «ναι»)

Αμετάβλητες από το προηγούμενο handoff §3: §2.3 κενό συμφιλίωσης + σελιδοποίηση (`listRequest`) · (β) πολιτική
επαναλήψεων webhook (ερώτηση στην Everypay) · §2.4 δημόσια σελίδα μετά από πλήρη επιστροφή · §2.5 υπόλοιπα σενάρια
(διπλό webhook, κάρτα αποτυχίας, μερική πληρωμή, myDATA dev) · ανάκληση δοκιμαστικών συνδέσμων · `[WARN]
[AUTH_CONTEXT] DENY` (εμφανίστηκε ξανά στα logs, άσχετο με την πληρωμή) · έγκριση jest του adapter.
Νέο: §5.8 #1 (hex ή base64 πριν από το `|` στο `hash`) παραμένει άγνωστο — πέρασε, χωρίς να φαίνεται ποια μορφή.

## 4. Κανόνες (από τον Giorgio)

- Απαντάς **πάντα στα ελληνικά**.
- **Στο main ΔΕΝ κάνεις commit.** **wt:land και push ΜΟΝΟ με εντολή Giorgio.**
- Κανένα test, scan, jscpd ή tsc χωρίς έγκριση (ο pre-commit hook τρέχει μόνος του τις σουίτες Λογιστικής).
- Κανένα κλειδί παρόχου από τον πράκτορα. Κανένα live mode. Μόνο sandbox.
- Εγγραφές δοκιμής στην παραγωγή: εγκεκριμένες. Πλασματικός ΑΦΜ για δοκιμαστικό πελάτη: εγκεκριμένος.
- Κάρτες / IRIS προσομοιωτής / dashboard Everypay: ο Giorgio (screenshots). Τιμολόγια, σύνδεσμοι, Firebase console:
  εσύ μέσω Chrome.
- Για κάθε σενάριο: πρώτα κώδικας ⇒ τι αναμένεται ⇒ μετά δοκιμή.
- Πριν από κώδικα: πραγματικό SSoT audit (`git grep`). Ό,τι δεν ξέρεις: docs.everypay.gr.
- Full enterprise + full SSoT, πρακτική Stripe/Adyen.
- Handoff σε δικό του commit, μόνο με το δικό του αρχείο (`git add -- <διαδρομή>`).
