# HANDOFF — 2026-11-11 — Λογιστική: ADR-ACC-030 «Πληρωμή τώρα» (Everypay) LANDED → ΕΠΟΜΕΝΟ ζωντανή επαλήθευση σε sandbox

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς έγκριση (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί με ρητή λίστα αρχείων.
- Κανένα κλειδί/διαπιστευτήριο παρόχου από τον πράκτορα. Κανένα live mode.
- Στον Giorgio μόνο «ναι/όχι» για: εγγραφή στην παραγωγή (και deploy κανόνων/δεικτών Firebase), land, push, αύξηση σφράγισης πύλης.
- Ισχύουν τα §ΜΗΝ των προηγούμενων handoffs (`…16-live-verified-next-pay-now-all-methods.md`).

## 1. Κατάσταση
- **Τοπικό `main` = `bdbbc204`** (land έγινε 2026-11-11). Ο Giorgio έκανε **push** — περιμένουμε ολοκλήρωση ανάπτυξης στο Netcup· ο Giorgio θα ενημερώσει.
- Commits: `67c9a9d1` (ACC-018 **§16.2**, ευρήματα ζωντανής επαλήθευσης — μετονομάστηκε από §16.1 λόγω σύγκρουσης με το §16.1 «κανάλια συνομιλίας» άλλης συνεδρίας) · `c290622a` (ACC-030 βήμα 1) · `bdbbc204` (ACC-030 βήματα 2–6).
- **Πλήρης περιγραφή: `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md`** (§3 μοντέλο · §4 Everypay · §5 ροή · §5.7 ρύθμιση · §5.8 ανοιχτά).

## 2. Τι υλοποιήθηκε (σύνοψη — λεπτομέρειες στο ADR)
- Πάροχος **Everypay** (απόφαση Giorgio), όχι PayPal/Revolut. Μόνο **sandbox** (ο κώδικας έχει μόνο sandbox URLs).
- Ένας γραφέας πληρωμής `recordInvoicePayment` (συναλλαγή, ντετερμινιστικό `ipay_` id, ίχνος `PAYMENT_RECORDED` / `PAYMENT_REFUNDED`). Παράγωγα από `settleInvoicePayments`. `payments/totalPaid/balanceDue/paymentStatus` = server-owned.
- `PaymentMethod` + `iris` (myDATA 8).
- Port `src/server/payments/payment-provider.ts` + adapter `src/server/payments/providers/everypay/*`.
- Routes: `POST /api/shares/[shareId]/invoice-payment/checkout` · `POST /api/payments/webhooks/[provider]` · `GET|POST /api/payments/return/[provider]` · cron `payment-reconcile` (`9,28,48 * * * *`).
- Σελίδα: `InvoicePayNowSection` (Κάρτα · IRIS · Τραπεζική μεταφορά) + «Η πληρωμή σας καταχωρείται» με σιωπηλό polling.
- `isPayableByLink` και για τιμολόγια «κάρτα»/«IRIS».

## 3. ΕΠΟΜΕΝΟ — Ζωντανή επαλήθευση σε sandbox (μετά την ανάπτυξη)
**Προϋποθέσεις (τα κάνει ο Giorgio — ο πράκτορας ΔΕΝ βάζει κλειδιά):**
1. Λογαριασμός sandbox Everypay (`https://sandbox-dashboard.everypay.gr` / docs «Sandbox Account»).
2. Env στο Netcup (ή `.env.local` για dev): `EVERYPAY_SECRET_KEY`, `EVERYPAY_PUBLIC_KEY`, `PAYMENTS_PROVIDER_MODE=sandbox`.
3. Webhooks στο dashboard → `https://nestorconstruct.gr/api/payments/webhooks/everypay` για: Notification paid · Notification expired · Refund · New Payment (IRIS).
4. IRIS / Apple Pay / Google Pay ενεργά στον λογαριασμό εμπόρου sandbox.
5. **Deploy στο Firebase** (ναι/όχι Giorgio): `firestore.rules` (2 νέες συλλογές deny-all), `firestore.indexes.json` (δείκτης `accounting_payment_checkouts (status, createdAt)` + TTL `payment_provider_events.expireAt`). Χωρίς τον δείκτη το cron αποτυγχάνει (`FAILED_PRECONDITION`).

**Σενάρια επαλήθευσης (Test Cases της Everypay):**
- Κάρτα δοκιμής ⇒ webhook ⇒ «Εξοφλήθηκε» στη σελίδα + `PAYMENT_RECORDED` στο ίχνος + `payments[]` στο τιμολόγιο.
- Μερική πληρωμή (αφού αλλάξει το υπόλοιπο) ⇒ `partial`.
- Ίδιο webhook δύο φορές ⇒ μία κίνηση (`duplicate`).
- Πλαστή υπογραφή (curl με UA browser — το middleware κόβει `curl/`) ⇒ 401.
- IRIS sandbox ⇒ τράπεζα/QR στον πάροχο ⇒ επιστροφή στη σελίδα με `?payment=` ⇒ «Εξοφλήθηκε».
- Επιστροφή χρημάτων από το dashboard ⇒ `PAYMENT_REFUNDED`, υπόλοιπο ανεβαίνει.
- Χωρίς κλειδιά ⇒ η σελίδα όπως πριν (μόνο μεταφορά).
- Cron: συνεδρία χωρίς webhook ⇒ καταγράφεται στο επόμενο πέρασμα.

**Ανοιχτά προς επιβεβαίωση (ADR-ACC-030 §5.8):** κωδικοποίηση υπογραφής IRIS `hash` (δεκτά hex/base64) · ακριβής μορφή σώματος κάθε webhook (ταξινόμηση με πρόθεμα `pnt_`/`pmt_`) · μορφή λιστών (`GET /payments?merchant_ref=`, `GET /refunds?payment=`) · αν η hosted σελίδα κάρτας επιστρέφει στον έμπορο (γι' αυτό ανοίγει σε νέα καρτέλα). Κάθε απόκλιση ⇒ διόρθωση στον adapter μόνο.

## 4. Δεν έτρεξαν (χωρίς έγκριση)
- `src/subapps/accounting/services/payments/__tests__/invoice-payment-settlement.test.ts` (πέρασε μέσα στο hook — ζώνη Accounting).
- `src/server/payments/providers/everypay/__tests__/everypay-signature.test.ts` · `…/everypay-adapter.test.ts`.
- `tests/firestore-rules/suites/accounting-payment-checkouts.rules.test.ts` · `…/payment-provider-events.rules.test.ts` + `npm run test:rules-coverage-completeness`.

## 5. ΜΗΝ
- ΜΗΝ εισαγάγεις κλειδιά. ΜΗΝ προσθέσεις live URL στο `EVERYPAY_ENDPOINTS` (απαιτεί ρητή απόφαση + ADR).
- ΜΗΝ γράψεις πληρωμή εκτός `recordInvoicePayment`. ΜΗΝ ξαναβάλεις `payments` στο PATCH τιμολογίου.
- ΜΗΝ εμπιστευτείς payload webhook — πάντα `readSettlement`.
- ΜΗΝ βάλεις το share token στη διεύθυνση επιστροφής του παρόχου (cookie `nestor_payment_return`).
- ΜΗΝ λογότυπα/συνδέσμους τραπεζών στη σελίδα μας.
- ΜΗΝ αλλάξεις snapshot εκδομένου τιμολογίου. Καμία διαβίβαση ΑΑΔΕ.
- ΜΗ διορθώσεις χειρόγραφα `src/types/i18n.ts` / `src/i18n/generated/*` (μόνο γεννήτορες).
- Πριν από κάθε κώδικα: πραγματικό SSoT audit (grep).

## 6. Εκτός εμβέλειας (προτάσεις, όχι εντολή)
- Επιστροφή χρημάτων **από** την εφαρμογή (port έτοιμο).
- Κλειδιά εμπόρου ανά εταιρεία με κρυπτογράφηση σε ηρεμία (σήμερα ένα από το env).
- Χειροκίνητη καταγραφή πληρωμής από την εφαρμογή μέσω του ίδιου γραφέα.
- Σελίδα ληγμένου συνδέσμου με στοιχεία εκδότη · `createAccountingServices` χωρίς audited repository · labels email τιμολογίου στα locales.
