# ADR-ACC-030: Online πληρωμές τιμολογίων — port παρόχου, Everypay, ένας γραφέας πληρωμής

| Metadata | Value |
|----------|-------|
| **Status** | IN PROGRESS (sandbox μόνο — live κλειδωμένο) |
| **Date** | 2026-11-11 |
| **Category** | Accounting / Invoicing / Payments |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-018](./ADR-ACC-018-invoice-pdf-generation.md) §16 — δημόσια σελίδα πληρωμής |
| **Related** | [ADR-ACC-003](./ADR-ACC-003-mydata-aade-integration.md) — myDATA (κωδικοί τρόπου πληρωμής) |
| **Related** | ADR-872 (CHECK 3.92 ιδεμποτία) · ADR-855 (CHECK 3.78 όριο ρυθμού) · ADR-298 (CHECK 3.16 κανόνες) |
| **Module** | M-003: Invoicing (Extension) |

---

## 1. Context

Η δημόσια σελίδα τιμολογίου (ACC-018 §16) έδειχνε **μόνο** οδηγίες μεταφοράς + EPC QR. Στο «Εκτός εμβέλειας» του
§16 έμεναν δύο κενά: (α) πληρωμή με κάρτα / IRIS «απαιτεί PSP», (β) **κανείς δεν καταγράφει πληρωμή** — το
`PAYMENT_RECORDED` υπήρχε μόνο ως λέξη στο λεξιλόγιο ίχνους, το `InvoicePayment` δεν το έγραφε κανείς, και το
`PATCH /api/accounting/invoices/[id]` δεχόταν `payments` ελεύθερα (`.passthrough()`).

**Νομικό πλαίσιο (επαληθευμένο 2026-11-11):**
- Αποδοχή άμεσων πληρωμών (IRIS) υποχρεωτική για συναλλαγές με καταναλωτές από **1/12/2025**: ν. 5193/2025 αρ. 219
  (νέα §5 στο αρ. 65 ν. 4446/2016) + ν. 5246/2025 αρ. 46 (ημερομηνία)· ΑΑΔΕ «Υπηρεσίες άμεσων πληρωμών».
- Πωλήσεις ≥ 500 € σε ιδιώτες: μόνο ηλεκτρονικά μέσα (ν. 3842/2010 αρ. 20 §3, όπως ν. 4446/2016 αρ. 69). Κάρτα και
  IRIS είναι ηλεκτρονικά μέσα.
- myDATA τρόπος πληρωμής: **7** POS / e-POS (κάρτα, και τα πορτοφόλια καρτών) · **8** IRIS (ΑΑΔΕ, v1.0.9, 15.07.2024).
- Εξ αποστάσεως πωλήσεις (e-commerce): **χωρίς** υποχρέωση διασύνδεσης POS–ERP / υπογραφής παρόχου (Ε.2044/2024 §6).

**Απόφαση Giorgio 2026-11-11:** πάροχος **Everypay** (IRIS + κάρτες + Apple Pay στο ίδιο API, HMAC webhooks,
δημοσιευμένες τιμές: κάρτες ΕΕ 1,40% + 0,12 €, IRIS 0,55% + 0,01 €). **Όχι** PayPal / Revolut Pay σε αυτή τη φάση
(κόστος, καμία σύνδεση με IRIS, αδιευκρίνιστη φορολογική αναγνώριση). Sandbox με πλασματικό λογαριασμό εμπόρου·
οι πραγματικοί λογαριασμοί = **ρύθμιση**, όχι αλλαγή κώδικα.

## 2. Αρχές

1. **Webhook = σήμα, όχι αλήθεια.** Η αλήθεια διαβάζεται από το API του παρόχου (belt) και συμφιλιώνεται από cron
   (suspenders). Ένα πλαστό payload δεν μπορεί να εξοφλήσει τιμολόγιο.
2. **Ποσό από τον διακομιστή.** Η συνεδρία πληρωμής κρατά το ποσό που υπολόγισε ο διακομιστής
   (`invoiceAmountDueNow`)· ο πελάτης δεν στέλνει ποτέ ποσό.
3. **ΕΝΑΣ γραφέας κινήσεων** (`recordInvoicePayment`), σε συναλλαγή, ιδεμποτικός με ντετερμινιστικό `paymentId`, με
   ίχνος στην **ίδια** συναλλαγή. Τα `totalPaid` / `balanceDue` / `paymentStatus` είναι **παράγωγα** μιας καθαρής
   συνάρτησης (`settleInvoicePayments`).
4. **Ανεξαρτησία παρόχου**: ένα συμβόλαιο `PaymentProvider`, ένας adapter ανά πάροχο. Ο κώδικας λογιστικής δεν
   ξέρει όνομα παρόχου.
5. **Κλειδωμένο live**: μόνο `sandbox` γίνεται δεκτό· τα κλειδιά τα ορίζει ο άνθρωπος στο περιβάλλον.

## 3. Μοντέλο δεδομένων (Βήμα 1)

- `PaymentMethod` + `'iris'` ⇒ `MYDATA_PAYMENT_METHOD_CODES.iris = 8`. Τα πορτοφόλια (Apple Pay / Google Pay)
  είναι `card` (7).
- `InvoicePayment` + προαιρετικά `kind` (`payment` | `refund`), `provider`, `providerReference`, `checkoutId`. Η
  επιστροφή είναι **νέα κίνηση**· η πληρωμή δεν σβήνεται ποτέ (Stripe charge + refund · Xero payment + refund).
- `services/payments/invoice-payment-settlement.ts`: `settleInvoicePayments(totalGross, payments)` ·
  `initialInvoicePaymentState` · `hasInvoicePayment`. Υπερπληρωμή ⇒ `paid`, υπόλοιπο ≥ 0.
- `services/repository/accounting-repo-invoice-payments.ts`: `recordInvoicePayment` (συναλλαγή · `duplicate` ·
  `invoice-absent` · ίχνος `PAYMENT_RECORDED` / `PAYMENT_REFUNDED`) και `resettleInvoicePayments` (μετά από αλλαγή
  γραμμών πρόχειρου).
- **Server-owned**: `payments`, `totalPaid`, `balanceDue`, `paymentStatus` μπήκαν στο `SERVER_OWNED_INVOICE_FIELDS`.
  Το POST γράφει `initialInvoicePaymentState(σύνολο από γραμμές)`· το PATCH με γραμμές καλεί
  `resettleInvoicePayments`. 🔴 Χωρίς αυτό, ένα PATCH με παλιό αντίγραφο του `payments[]` έσβηνε σιωπηλά πληρωμή που
  μόλις κατέγραψε το webhook (lost update). Επαληθευμένο: κανένα UI δεν έγραφε `payments` μέσω PATCH.
- Ταυτότητες: `ipay` (κίνηση, ντετερμινιστική από `πάροχος:είδος:αναφορά`) · `pchk` (συνεδρία) · `pevt` (συμβάν
  παρόχου, ντετερμινιστική). Το `pay` ανήκει στα πλάνα πληρωμών ακινήτων.
- Συλλογές: `accounting_payment_checkouts` · `payment_provider_events` — κανόνες **deny-all** (μόνο Admin SDK), με
  σουίτες στο `coverage-manifest.ts` (CHECK 3.16).
- Ίχνος: νέα `PAYMENT_REFUNDED`, `INVOICE_PAYMENT_CHECKOUT_STARTED`.

## 4. Everypay — επαληθευμένα στοιχεία (docs.everypay.gr, 2026-11-11)

| Θέμα | Στοιχείο |
|---|---|
| API | `https://sandbox-api.everypay.gr` / `https://api.everypay.gr` · Basic auth (`sk_…:`) · form-encoded · ποσά σε cents |
| Κάρτα + Apple Pay + Google Pay | `POST /notifications` ⇒ hosted σελίδα `payment_link_url` (`pnt_…`), `metadata`, `expiration_date` (≥ 5′), `locale`, `skip_notify=1` · `GET /notifications/{id}` ⇒ `payment` · `DELETE` όσο Pending |
| IRIS (Direct) | `POST /iris/sessions` ⇒ `signature` ⇒ form POST στο payform (`flow=direct`) ⇒ τράπεζα / QR **στον πάροχο** ⇒ callback (`token src_…`, `md`, `hash`) ⇒ **εμείς** `POST /payments {token, amount}` (μία φορά ανά token· 2η = `41001`) |
| Webhooks | `X-Signature-SHA256` = base64(**κείμενο hex** του HMAC-SHA256(raw body, secret key)) — `base64_encode(hash_hmac(…))` της PHP, όχι base64 των 32 bytes (§5.9 #3) · IRIS: πεδίο `hash` = base64(«υπογραφή\|JSON») με HMAC-SHA256 του JSON · **κανένα event id**, **κανένα idempotency header** |
| Πληρωμές / επιστροφές | `GET /payments/{id}` · `GET /payments?merchant_ref=` · `POST /refunds {payment, amount?}` (μερικές) · `GET /refunds?payment=` · λίστες = `{ total_count, items: [...] }` (§5.9 #6) · επιστροφή: `ref_…`, `status` `Captured`/`Failed`, `payment` = `pmt_…` |

⚠️ **Ανοιχτό προς επαλήθευση στο sandbox**: η κωδικοποίηση της υπογραφής πριν από το `|` στο IRIS `hash` (hex ή
base64) δεν δηλώνεται ρητά. Ο έλεγχος δέχεται και τις δύο κωδικοποιήσεις του **ίδιου** HMAC. Αυτό δεν χαλαρώνει την
ασφάλεια: η πληρωμή γίνεται μόνο όταν πετύχει το `POST /payments` με το **δικό μας** μυστικό κλειδί και το ποσό της
συνεδρίας.

## 5. Ροή (Βήματα 2–6)

### 5.1 Port + adapter (`src/server/payments/`)

| Αρχείο | Ρόλος |
|---|---|
| `payment-provider.ts` | Το συμβόλαιο: `startCheckout` · `readSettlement` (η αλήθεια) · `captureAuthorizedSource` (IRIS Direct) · `cancelCheckout` (→ `true` μόνο όταν ο πάροχος **εγγυάται** ότι δεν θα χρεώσει) · `judgeWebhook` / `judgeReturn` (καθαρά). |
| `payment-provider-registry.ts` | `paymentProviderForCompany(companyId)` — ο λογαριασμός εμπόρου. Σήμερα ένας, από το περιβάλλον· αύριο ανά εταιρεία χωρίς αλλαγή καταναλωτών. |
| `providers/everypay/*` | Ρυθμίσεις (μόνο sandbox URLs — **κλειδωμένο live**) · υπογραφές (καθαρές) · πελάτης REST με `fetch` (κανένα πακέτο, N.5) · αναγνώστες με φρουρούς (κανένα `as`) · adapter. |
| `payment-checkout-store.ts` | Η συνεδρία πληρωμής: ανάγνωση με φρουρούς, αναζητήσεις συστήματος με αιτιολογία `tenant-scope-exempt`. |
| `payment-provider-event-log.ts` | Ίχνος παραλαβής: αποτύπωμα SHA-256 + σήμα + αποτέλεσμα, **ποτέ** το σώμα (email/τηλέφωνο/ψηφία κάρτας). TTL 400 μέρες (`expireAt`, Timestamp). |
| `payment-return-cookie.ts` | Η επιστροφή του browser χωρίς να δοθεί το token του συνδέσμου στον πάροχο. |
| `lib/payments/payment-routes.ts` | Αναγνωριστικά παρόχων + διαδρομές (ένας ορισμός για route, middleware, πάροχο). |

### 5.2 Έναρξη — `POST /api/shares/[shareId]/invoice-payment/checkout`

Ανώνυμο, με το κουπόνι επίσκεψης (όπως η όψη), STANDARD, ιδεμποτία εξ ορισμού (`Idempotency-Key` ανά πάτημα).
Σώμα: `{ method, locale, returnPath }` — **ποτέ** ποσό. Σειρά (`server/accounting/payments/invoice-payment-checkout.ts`):
`readSharedInvoice` (ΙΔΙΑ είσοδος με όψη/PDF) → η `returnPath` λύνεται στον **ίδιο** σύνδεσμο → πάροχος + τρόπος
ενεργός → ποσό = `invoiceAmountDueNow` σε λεπτά → οι ανοιχτές συνεδρίες του συνδέσμου κλείνουν (μόνο όσες ο πάροχος
εγγυάται) → **η συνεδρία γράφεται ΠΡΙΝ** τον πάροχο → πάροχος → ίχνος `INVOICE_PAYMENT_CHECKOUT_STARTED`.
Επιτυχία ⇒ cookie επιστροφής `HttpOnly; Secure; SameSite=None; Path=/api/payments/return`.

- **Κάρτα / Apple Pay / Google Pay**: Payment Notification ⇒ hosted σελίδα σε **νέα καρτέλα** (ανοίγει συγχρονικά στο
  πάτημα — αλλιώς μπλοκάρεται). Η σελίδα μας περιμένει.
- **IRIS**: συνεδρία IRIS ⇒ φόρμα POST στην **ίδια** καρτέλα ⇒ τράπεζα/QR στον πάροχο ⇒ επιστροφή.

### 5.3 Καταγραφή — `POST /api/payments/webhooks/[provider]`

`withAuth(allowUnauthenticated)` + `withWebhookRateLimit`, ιδεμποτία **natural** (CHECK 3.92 Κ1: ο πάροχος δεν
στέλνει κλειδί ούτε event id· η απόδειξη είναι ο γραφέας). Υπογραφή πάνω στο ωμό σώμα ⇒ σήμα ⇒ συνεδρία ⇒ (IRIS:
`captureAuthorizedSource`) ⇒ `syncCheckoutSettlement` ⇒ `recordInvoicePayment` ανά κίνηση. Κωδικοί: 401 πλαστό ·
400 άκυρο σώμα · 503 πάροχος μη ρυθμισμένος **ή** αποτυχία εφαρμογής (το σύνορο δεν κρατά 503 ⇒ ο πάροχος
ξαναδοκιμάζει· ένα 500 θα αναπαραγόταν 24 ώρες) · 200 αλλιώς.

Ίχνη: άρνηση ⇒ `warn` «Payment webhook refused» · αποτυχία ⇒ `error` · **αποδοχή ⇒ `info` «Payment webhook
applied»** (`provider`, `signal`, `outcome`) — χωρίς αυτήν, webhook που πέρασε και συμφιλίωση δεν ξεχωρίζουν στα
logs (§5.9 #4). Κάθε δεκτό συμβάν γράφει και ίχνος παραλαβής στο `payment_provider_events` (αποτύπωμα, σήμα,
αποτέλεσμα).

🔴 Η καταγραφή **δεν** κοιτά την κατάσταση της συνεδρίας: IRIS που ολοκληρώθηκε σε `canceled`/`expired` συνεδρία
**είναι** χρήματα που μπήκαν. Απόκλιση ποσού ⇒ καταγράφεται η αλήθεια του παρόχου + προειδοποίηση.

### 5.4 Επιστροφή browser — `GET|POST /api/payments/return/[provider]`

**Καμία εγγραφή.** 303 (σχετικό `Location` — ποτέ `request.url`, πίσω από τον proxy είναι το εσωτερικό host) στη
διαδρομή του cookie με `?payment=<checkoutId>`. Η σελίδα δείχνει «Η πληρωμή σας καταχωρείται» και ξαναδιαβάζει
σιωπηλά την όψη (3″ το πρώτο λεπτό, μετά 15″, ως 15′) ώσπου να πει «Εξοφλήθηκε».

### 5.5 Συμφιλίωση — cron `payment-reconcile` (`9,28,48 * * * *`)

Ανοιχτές συνεδρίες > 10′ ⇒ ο **ίδιος** `syncCheckoutSettlement`. Ανοιχτή πολύ μετά τη λήξη ⇒ `expired`: κάρτα μόνο
αν ο πάροχος εγγυηθεί την ακύρωση· IRIS μετά από 24 ώρες. Δείκτης `(status, createdAt)`.

### 5.6 Δημόσια σελίδα

«Πληρωμή τώρα» (`InvoicePayNowSection`): καρτέλες ανά τρόπο — Κάρτα · IRIS · Τραπεζική μεταφορά (οι υπάρχουσες
οδηγίες + EPC QR, αμετάβλητες). Ποιοι τρόποι φαίνονται το λέει ο διακομιστής (`view.onlineMethods`). Κανένα
λογότυπο τράπεζας από εμάς. Χωρίς ρυθμισμένο πάροχο η σελίδα είναι ακριβώς όπως πριν.

**Επιλεξιμότητα συνδέσμου**: `isPayableByLink` = εισπρακτέο ∧ (μεταφορά ∨ κάρτα ∨ IRIS). Οι λογαριασμοί στο PDF
μένουν στο `showsPaymentInstructions` (όχι IBAN σε τιμολόγιο «κάρτα»).

### 5.7 Ρύθμιση από τον άνθρωπο (ποτέ από πράκτορα)

`EVERYPAY_SECRET_KEY` · `EVERYPAY_PUBLIC_KEY` · `PAYMENTS_PROVIDER_MODE=sandbox` (δηλωμένα στο
`environment-contract.ts` + `.env.example`). Στο dashboard της Everypay: webhooks «Notification paid» ·
«Notification expired» · «Refund» · «New Payment (IRIS)» ⇒ `https://<domain>/api/payments/webhooks/everypay`.
Ενεργοποίηση IRIS / Apple Pay / Google Pay στον λογαριασμό εμπόρου.

### 5.8 Ανοιχτά προς επαλήθευση στο sandbox

1. Κωδικοποίηση υπογραφής IRIS `hash` (hex / base64 — δεκτά και τα δύο).
2. Η ακριβής μορφή του σώματος κάθε webhook (η τεκμηρίωση δίνει λίστα πεδίων, όχι παράδειγμα ανά συμβάν): ο adapter
   ταξινομεί με το πρόθεμα του `token` (`pnt_` / `pmt_`)· άγνωστη μορφή ⇒ `ignored` + ίχνος, και η συμφιλίωση καλύπτει.
3. ~~Η μορφή απάντησης λίστας~~ — **έκλεισε** (§5.9 #6): `{ total_count, items }`, μόνο αυτή· άλλη μορφή ⇒ 502.
4. Αν η hosted σελίδα της ειδοποίησης επιστρέφει στον έμπορο (δεν τεκμηριώνεται πεδίο) — γι' αυτό νέα καρτέλα.

### 5.9 Ευρήματα ζωντανής επαλήθευσης (sandbox, 2026-11-11)

Ρύθμιση: κλειδιά στο περιβάλλον (επιβεβαίωση: πλαστή υπογραφή ⇒ `401 signature-invalid`, πριν `503
provider-not-configured`) · ένα webhook στο dashboard με τα συμβάντα «Νέα Πληρωμή (Card)» · «Επιστροφή ποσού
(Card)» · «Νέα Πληρωμή (IRIS)» · `paymentNotificationPaid` · `paymentNotificationExpired` (ΟΧΙ τα POS/Soft POS).
Το webhook είναι **ένα** με πολλά συμβάντα, όχι ένα ανά συμβάν. Το **Ιδιωτικό Κλειδί** του dashboard είναι το
`EVERYPAY_SECRET_KEY`· το «Κοινόχρηστο κλειδί» δεν χρησιμοποιείται.

1. 🔴 **`expiration_date` απορρίφθηκε** («Invalid expiration date»): στέλναμε `toISOString()` (`….123Z`). Το API
   reference δίνει `2027-11-23T15:52:00+0300` — χωρίς χιλιοστά, ζώνη `±HHMM`. Διόρθωση **μόνο στον adapter**:
   `everypayDateTime()` στο `everypay-client.ts` (UTC, `+0000`). Η σελίδα «Πληρωμή τώρα» εμφανίστηκε σωστά
   (Κάρτα · IRIS · Μεταφορά) πριν από το εύρημα.
2. ⏳ **IRIS: «Invalid account setup. Please contact customer support»** (`POST /iris/sessions`, 2026-11-11). **Όχι
   σφάλμα κώδικα**: η κλήση αυθεντικοποιήθηκε, ο λογαριασμός sandbox δεν έχει ενεργό το IRIS (τα προϊόντα του
   sandbox τα ενεργοποιεί η υποστήριξη — docs «Sandbox Account» βήμα 3). Ο Giorgio έστειλε 2026-11-11 email στο
   `support@everypay.gr` ζητώντας ενεργοποίηση IRIS (Direct) · κάρτας μέσω Payment Notifications · Apple Pay /
   Google Pay — αίτημα υποστήριξης **00128279** (παραλαβή επιβεβαιώθηκε ίδια μέρα). **Αναμονή απάντησης**· μετά: επανάληψη της δοκιμής IRIS, καμία αλλαγή κώδικα αν δεν βγει νέο σφάλμα.
3. 🔴 **Κάθε γνήσιο webhook ⇒ `401 signature-invalid`** (2026-11-12, πληρωμή κάρτας Α-10 12,40 €). Με το `+0000`
   το εύρημα 1 έκλεισε: η ειδοποίηση δημιουργήθηκε, η hosted σελίδα ζήτησε 3DS (δοκιμαστικό) και η Everypay
   **χρέωσε** (`pmt_MAFG2v3iKbk6JYS…`, συναλλαγή 53433). Τα δύο webhooks όμως απορρίφθηκαν (log
   `Payment webhook refused … signature-invalid`) ⇒ το Α-10 έμεινε «Προς πληρωμή». Αιτία: η τεκμηρίωση δίνει
   `base64_encode(hash_hmac('sha256', $payload, $secretKey))` — το `hash_hmac` της PHP επιστρέφει **hex** (64
   χαρακτήρες), άρα η κεφαλίδα είναι base64 **του κειμένου hex**· εμείς κρίναμε base64 των **32 bytes**, και τα
   tests έφτιαχναν την υπογραφή με την **ίδια** λάθος υπόθεση (πράσινα, ενώ η παραγωγή απέρριπτε τα πάντα).
   Διόρθωση **μόνο στον adapter**: `judgeEverypayBodySignature` (`everypay-signature.ts`) αποκωδικοποιεί σε hex·
   τα test helpers ακολουθούν πλέον τον τύπο της τεκμηρίωσης + test που καρφώνει ότι η μορφή «bytes» απορρίπτεται.
   Επίσης: η άρνηση υπογραφής είναι `warn` ⇒ **καμία** ειδοποίηση Telegram — το έπιασαν μόνο τα logs.
   Παρατήρηση §5.8 #4: μετά την πληρωμή η hosted σελίδα **δεν** επιστρέφει στον έμπορο (δείχνει απόδειξη) —
   η νέα καρτέλα ήταν σωστή επιλογή.
   ✅ **Επαληθεύτηκε ζωντανά 2026-11-12** (live `ad82f4b`): νέο τιμολόγιο Α-11 12,40 € (`pnt_cTQMNeplvflFAN6u7kqVPIvU`),
   κάρτα επιτυχίας + 3DS ⇒ η δημόσια σελίδα έδειξε «Εξοφλήθηκε» και η Λογιστική «Εξοφλημένο» **αμέσως**. Απόδειξη
   ότι ήταν το webhook: `syncCheckoutSettlement` καλούν μόνο webhook και συμφιλίωση, και η συμφιλίωση δεν μπορούσε
   (τελευταία εκτέλεση 00:48 UTC πριν από τη συνεδρία, επόμενη 01:09, περιθώριο 10′· έλεγχος 00:58 UTC).
4. **Η αποδοχή webhook ήταν σιωπηλή στα logs** (2026-11-12): το Α-10 εξοφλήθηκε μετά τη διόρθωση, αλλά από τα logs
   δεν φαίνεται αν το έκανε επανάληψη webhook ή η συμφιλίωση — και οι δύο γράφουν με δράστη `provider:everypay`.
   Προστέθηκε `info` «Payment webhook applied» (§5.3). Για το Α-10 η απάντηση υπάρχει μόνο στο
   `payment_provider_events`.
5. **Τι γράφεται στα λογιστικά** (ελέγχθηκε στο Α-11): η είσπραξη ⇒ `payments[]` του τιμολογίου + κατάσταση
   «Εξοφλημένο» + ίχνος λογιστικής (ο ίδιος γραφέας `recordInvoicePayment` με τη χειροκίνητη καταγραφή). Το έσοδο
   στο Βιβλίο Ε-Ε γράφεται ήδη στη **δημιουργία** του τιμολογίου (`createJournalEntryFromInvoice`), όχι στην
   πληρωμή. **Δεν** γράφονται: κίνηση τράπεζας (η Everypay αποδίδει αργότερα, συγκεντρωτικά, μείον προμήθεια ⇒
   έρχεται με το αντίγραφο κίνησης), η προμήθεια Everypay ως έξοδο, απόδειξη είσπραξης — εκτός εμβέλειας (§6).
   Το «Πληρωτέο» της δημόσιας σελίδας = σύνολο εγγράφου − παρακράτηση (`invoicePayableAmount`), **όχι** υπόλοιπο.

6. 🔴 **Επιστροφή χρημάτων δεν καταγράφηκε** (2026-11-12, μερική επιστροφή 5,00 € στο Α-11 από το dashboard,
   11:58 UTC). Το webhook **έφτασε** (`payment_provider_events`: `signal: payment-reference`, `outcome: unchanged`):
   υπογραφή ✅, το σώμα του συμβάντος «Επιστροφή ποσού» είναι η **πληρωμή** (`pmt_…`), η συνεδρία βρέθηκε. Ο
   συγχρονισμός όμως διάβασε **κενή** λίστα επιστροφών. Αιτία: η τεκμηρίωση δίνει τις λίστες ως
   `{ total_count, items }`· ο αναγνώστης δεχόταν μόνο τις **μαντεμένες** μορφές πίνακας / `data` / `refunds` /
   `payments` και σε κάθε άλλη επέστρεφε `[]` ⇒ «καμία επιστροφή» ⇒ `unchanged`, **χωρίς** log. Τα tests έφτιαχναν
   την απάντηση με την **ίδια** μαντεψιά (`{ data }`) — ίδιο σχήμα με το #3. Η ίδια βλάβη έκρυβε και την πληρωμή IRIS
   από τη συμφιλίωση (`GET /payments?merchant_ref=`). Διόρθωση **μόνο στον adapter**: `listItemsOrNull`
   (`everypay-readers.ts`) διαβάζει **μόνο** `items`· άλλη μορφή ⇒ `null` ⇒ `listRequest` (`everypay-adapter.ts`)
   ρίχνει `EverypayApiError(502)` ⇒ το webhook απαντά 503 και ο πάροχος ξαναδοκιμάζει, η συμφιλίωση γράφει `error` —
   ποτέ σιωπηλό «τίποτα». Test καρφώνει ότι η μορφή `{ data }` **απορρίπτεται**.
   Παρατηρήσεις: (α) το `unknown` 00:58 UTC ήταν το «Νέα Πληρωμή (Card)» που προλαβαίνει την εγγραφή του
   `paymentReference` — αβλαβές, το κάλυψε το `paymentNotificationPaid`. (β) Το dashboard δείχνει μετά την επιστροφή
   «Ποσό 12,40 € → 7,40 €»· η τεκμηρίωση **δεν** λέει αν αλλάζει το `amount` του API. Αν αλλάζει, πρώτος συγχρονισμός
   **μετά** από επιστροφή θα κατέγραφε πληρωμή 7,40 € — θα το δείξει η υπάρχουσα προειδοποίηση «Provider charged a
   different amount than the checkout» μετά το deploy. (γ) **Κενό**: η συμφιλίωση κοιτά μόνο `pending` συνεδρίες ⇒
   επιστροφή της οποίας χάθηκε το webhook δεν ανακτάται ποτέ (πρόταση προς απόφαση: πέρασμα `GET /refunds?date_from=`).

   ✅ **Επαληθεύτηκε ζωντανά 2026-11-12** (live `b12482e`, που περιέχει το `0de6dc9e`): νέα μερική επιστροφή **1,00 €**
   στο Α-11 από το dashboard (13:30 UTC) ⇒ webhook 18″ μετά: `payment_provider_events` `signal: payment-reference` ·
   `outcome: recorded` · log `info` «Payment webhook applied … recorded». Το Α-11: `payments[]` = πληρωμή 12,40 +
   επιστροφές 1,00 (`ref_rOhE…`) και 5,00 (`ref_5kc8…`) — **η χαμένη επιστροφή των 5,00 € ανακτήθηκε στον ίδιο
   συγχρονισμό** · `totalPaid` 6,40 · `balanceDue` 6,00 · `partial` · `PAYMENT_REFUNDED` ×2 στο ίχνος. Η πληρωμή
   **δεν** ξαναγράφτηκε (ιδεμποτία). Δημόσια σελίδα: «Προς πληρωμή» 6,00 €. Το «Επιτυχής» του dashboard = `status:
   Captured` στο API (αλλιώς οι επιστροφές θα είχαν φιλτραριστεί).
   **(β) απαντήθηκε**: το `amount` της πληρωμής στο API **δεν** μειώνεται μετά από επιστροφή — καμία προειδοποίηση
   «Provider charged a different amount» στο ίδιο webhook (θα γραφόταν ακριβώς πριν το «applied»). Το «12,40 → 6,40»
   είναι υπολογισμός του dashboard (δίπλα στο σταθερό «Captured Ποσό 12,40»). ⚠️ Συμπέρασμα από ζωντανή συμπεριφορά
   (μερική επιστροφή κάρτας), όχι από την τεκμηρίωση. Καμία αλλαγή κώδικα.
   Παρατήρηση: οι επιστροφές καταγράφονται με τη σειρά της λίστας του παρόχου (νεότερη πρώτη) ⇒ το ενδιάμεσο
   στιγμιότυπο του ίχνους (`balanceDue` 1,00 μετά την 1,00 €) δεν αντιστοιχεί σε πραγματική στιγμή· η τελική
   κατάσταση είναι σωστή.

## 6. Εκτός εμβέλειας

- Επιστροφή χρημάτων **από** την εφαρμογή (το port την υποστηρίζει· οι επιστροφές από το dashboard του παρόχου
  καταγράφονται αυτόματα).
- Κλειδιά ανά εταιρεία με κρυπτογράφηση σε ηρεμία (σήμερα: ένας λογαριασμός εμπόρου από το περιβάλλον).
- PayPal / Revolut Pay · διαβίβαση myDATA · παρακράτηση στο πληρωτέο ποσό (ACC-018 §16).
- Συμφωνία της απόδοσης Everypay με την τράπεζα · προμήθεια παρόχου ως έξοδο · απόδειξη είσπραξης (§5.9 #5).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-11 | Βήμα 1: μοντέλο, ένας γραφέας, server-owned πεδία, ταυτότητες, συλλογές + κανόνες. |
| 2026-11-11 | Βήματα 2–6: port + adapter Everypay · έναρξη πληρωμής · webhook · επιστροφή browser · συμφιλίωση cron · «Πληρωμή τώρα» στη δημόσια σελίδα · `isPayableByLink` και για κάρτα/IRIS. |
| 2026-11-11 | §5.9 ζωντανή επαλήθευση sandbox: ρύθμιση dashboard/κλειδιών· εύρημα 1 `expiration_date` σε μορφή `YYYY-MM-DDTHH:mm:ss+0000` (`everypayDateTime`). |
| 2026-11-11 | §5.9 εύρημα 2: IRIS «Invalid account setup» = ρύθμιση λογαριασμού sandbox· email στην υποστήριξη Everypay για ενεργοποίηση IRIS / κάρτας / Apple Pay / Google Pay. |
| 2026-11-12 | §5.9 εύρημα 3: η κάρτα χρεώθηκε στο sandbox (εύρημα 1 κλειστό) αλλά κάθε webhook `signature-invalid` — η κεφαλίδα είναι base64 του **hex** του HMAC· διόρθωση στο `judgeEverypayBodySignature` + test helpers· §4 πίνακας διορθώθηκε. |
| 2026-11-12 | §5.9 #3 ✅ επαληθεύτηκε ζωντανά με γνήσιο webhook (Α-11)· #4 `info` «Payment webhook applied» στο route (§5.3)· #5 τι γράφεται στα λογιστικά· §6 κενά συμφωνίας απόδοσης / προμήθειας / απόδειξης. |
| 2026-11-12 | §5.9 #6: επιστροφή δεν καταγράφηκε — λίστες Everypay = `{ total_count, items }`· `listItemsOrNull` + `listRequest` (502 σε μορφή εκτός συμβολαίου)· §5.8 #3 κλειστό· §4 πίνακας. |
| 2026-11-12 | §5.9 #6 ✅ επαληθεύτηκε ζωντανά (επιστροφή 1,00 € στο Α-11 ⇒ `recorded`, και οι δύο επιστροφές, υπόλοιπο 6,00 €)· (β) απαντήθηκε: το `amount` πληρωμής του API δεν μειώνεται μετά από επιστροφή. |
