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
  είναι `card` (7). Τα email πωλήσεων / λογιστηρίου γράφουν την ετικέτα μέσω `paymentMethodLabelIn` (ίδια κλειδιά
  `accounting:common.paymentMethods.*` με την UI, `createBundleTranslate`) — ήταν δύο χειρόγραφοι πίνακες με
  `credit_card` / `debit_card`, χωρίς `card` / `iris`. Ο AI αναλυτής παραστατικών (ACC-005) διαβάζει πλέον και `iris` (2026-11-13· η λίστα του παράγεται
  εξαντλητικά από τον τύπο).
- **Επιλογή στη φόρμα** (2026-11-12): ο κοινός `PaymentMethodSelector` (φόρμα τιμολογίου **και** εγγραφής Βιβλίου
  Ε-Ε) προσφέρει `iris` μετά την κάρτα· ετικέτα i18n `common.paymentMethods.iris`. Οι ετικέτες του PDF
  (`PAYMENT_METHOD_LABELS`) είναι πλέον `Record<PaymentMethod, string>` — εξαντλητικές: νέος τρόπος χωρίς ετικέτα
  δεν μεταγλωττίζεται (πριν: `Record<string, string>` ⇒ το PDF τύπωνε ωμό `iris` / `mixed`).
- Οι online τρόποι του συνδέσμου (`isPayableByLink`) διαβάζονται από τη **μία** ρίζα `ONLINE_PAYMENT_METHODS`
  (`types/online-payment.ts`, `isOnlinePaymentMethod`) — όχι από δεύτερο τοπικό σύνολο.
- `InvoicePayment` + προαιρετικά `kind` (`payment` | `refund`), `provider`, `providerReference`, `checkoutId`. Η
  επιστροφή είναι **νέα κίνηση**· η πληρωμή δεν σβήνεται ποτέ (Stripe charge + refund · Xero payment + refund).
- `services/payments/invoice-payment-settlement.ts`: `settleInvoicePayments(totalGross, payments)` ·
  `initialInvoicePaymentState` · `hasInvoicePayment`. Υπερπληρωμή ⇒ `paid`, υπόλοιπο ≥ 0.
  Η επιστροφή **δεν** ξανανοίγει την οφειλή (§5.10): `totalPaid` = μόνο πληρωμές, `totalRefunded` = μόνο επιστροφές.
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
| Πληρωμές / επιστροφές | `GET /payments/{id}` · `GET /payments?merchant_ref=` · `POST /refunds {payment, amount?}` (μερικές) · `GET /refunds?payment=` · λίστες = `{ total_count, items: [...] }` (§5.9 #6), σελιδοποίηση `count` 1–20 (**προεπιλογή 10**) + `offset` (§5.9 #8) · `GET /refunds?date_from=YYYY-MM-DD` · επιστροφή: `ref_…`, `status` `Captured`/`Failed`, `payment` = `pmt_…` |

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
Το `[WARN] [AUTH_CONTEXT] DENY` που συνόδευε **κάθε** webhook (2026-11-12) ήταν θόρυβος, όχι άρνηση: το
`buildRequestContext` το έγραφε πριν το `withAuth` εφαρμόσει το `allowUnauthenticated`. Από 2026-11-13 η δημόσια
διαδρομή γράφει `debug` (ADR-821 changelog)· η απόφαση δεν άλλαξε.

🔴 Η καταγραφή **δεν** κοιτά την κατάσταση της συνεδρίας: IRIS που ολοκληρώθηκε σε `canceled`/`expired` συνεδρία
**είναι** χρήματα που μπήκαν. Απόκλιση ποσού ⇒ καταγράφεται η αλήθεια του παρόχου + προειδοποίηση.

**Αρνημένη απόπειρα** (2026-11-12, §5.9 #7): σήμα `authorization-failed { checkoutId, providerCode, signedFields }`.
Όλα διαβάζονται **μόνο** από το υπογεγραμμένο JSON του `hash`. Το `md` φτάνει και ως **ανυπόγραφο** εξωτερικό πεδίο
(docs «IRIS Direct») και **απορρίπτεται** — αλλιώς μια έγκυρη υπογραφή άλλης συνεδρίας θα σημάδευε ξένη. Ο
`notePaymentAttemptFailure` (`payment-webhook-handler.ts`) ⇒ `recordCheckoutFailure` (`payment-checkout-store.ts`):
σε **συναλλαγή**, γράφει `lastFailure { code: 'authorization-failed', providerCode, at }` **μόνο** σε `pending`
συνεδρία του ίδιου παρόχου· **καμία** χρέωση, κανένας συγχρονισμός, **καμία** αλλαγή κατάστασης· ίδια αποτυχία ξανά ⇒
`unchanged`. Αποτελέσματα: `failure-noted` · `unchanged` · `unknown`.
🔴 **ΟΧΙ `status: 'failed'`** (πρότυπο Stripe: το PaymentIntent μένει `requires_payment_method` με
`last_payment_error`): η συμφιλίωση και το κλείσιμο κοιτούν **μόνο** `pending` ⇒ με `failed`, μια μεταγενέστερη
πληρωμή της ίδιας συνεδρίας με χαμένο webhook θα ήταν **μη ανακτήσιμη**. Το `failed` του `PAYMENT_CHECKOUT_STATUSES`
σημαίνει μόνο «ο πάροχος αρνήθηκε την **έναρξη**» (`invoice-payment-checkout.ts`).
Ίχνη: το «Payment webhook applied» και το `payment_provider_events` γράφουν πλέον και τον **λόγο** του σήματος
(`webhookSignalDiagnostics`, ένας ορισμός): `reason` = λόγος του `ignored` ή `provider-code:<κωδικός>` · `signedFields`
= τα **ονόματα** των υπογεγραμμένων πεδίων, όταν λείπει υπογεγραμμένη συνεδρία — ποτέ τιμές.

### 5.4 Επιστροφή browser — `GET|POST /api/payments/return/[provider]`

**Ποτέ χρήματα.** 303 (σχετικό `Location` — ποτέ `request.url`, πίσω από τον proxy είναι το εσωτερικό host) στη
διαδρομή του cookie με `?payment=<checkoutId>`. Η σελίδα ρωτά την **έκβαση της απόπειρας** (§5.6).

**Μία εξαίρεση εγγραφής** (απόφαση Giorgio 2026-11-12): υπογεγραμμένη **αρνημένη** απόπειρα ⇒ `lastFailure`, από τον
**ίδιο** δρόμο με το webhook (`notePaymentAttemptFailure`). Ο λόγος: η Everypay εγγυάται webhook **μόνο** για τις
επιτυχίες («guaranteed for successful IRIS payments»)· το webhook αποτυχίας το είδαμε στο §5.9 #7, χωρίς εγγύηση.
Γράφει μόνο όταν η υπογεγραμμένη συνεδρία **ταυτίζεται** με το `?checkout=` της δικής μας διεύθυνσης (αλλιώς
`checkout-mismatch`). Σφάλμα εγγραφής δεν εμποδίζει την επιστροφή. Ίδια εμπιστοσύνη με το webhook (ίδια υπογραφή
παρόχου), μηδέν χρήματα, ιδεμποτικό. Το «πληρώθηκε» **ποτέ** δεν αποφασίζεται εδώ.

### 5.5 Συμφιλίωση — cron `payment-reconcile` (`9,28,48 * * * *`)

Ανοιχτές συνεδρίες > 10′ ⇒ ο **ίδιος** `syncCheckoutSettlement`. Ανοιχτή πολύ μετά τη λήξη ⇒ `expired`: κάρτα μόνο
αν ο πάροχος εγγυηθεί την ακύρωση· IRIS μετά από 24 ώρες. Δείκτης `(status, createdAt)`.

**Λήξη = η λήξη του παρόχου** (2026-11-13, §5.8 #6, πρότυπο Stripe `expires_at`: η συνεδρία δεν υπόσχεται ζωή που ο
πάροχος δεν τηρεί). Ζητάμε 30′ (`CHECKOUT_LIFETIME_MS`)· όταν ο πάροχος δηλώσει δική του λήξη
(`StartedCheckout.providerExpiresAt`), αυτή γράφεται στο `expiresAt` μαζί με το `providerReference`
(`startedCheckoutPatch`). Η Everypay: κάρτα ⇒ επιστρέφει τη λήξη που ζητήσαμε· **IRIS ⇒ καμία παράμετρος λήξης**,
η απάντηση του `POST /iris/sessions` φέρει `expiration_date` (παράδειγμα API reference: 15′ μετά το `date_created`).
**Μετρημένο ζωντανά (2026-11-13, sandbox): 35′** (`providerLifetimeSeconds: 2100`, §5.8 #6) — όχι τα 15′ του
παραδείγματος· πριν, η εγγραφή έλεγε τα δικά μας 30′. Οι **24 ώρες** του IRIS μένουν, αλλά είναι **παράθυρο
ανάκτησης** μετρημένο από την πραγματική λήξη, όχι ζωή συνεδρίας: η Everypay εγγυάται webhook για τις επιτυχίες
χωρίς δηλωμένη πολιτική επαναλήψεων (§5.8 #7), και όσο η συνεδρία είναι `pending` η συμφιλίωση ρωτά τον πάροχο
(`GET /payments?merchant_ref=`) — δεν υπάρχει GET συνεδρίας IRIS. Η αναμονή της σελίδας (§5.6) τελειώνει στη λήξη του
παρόχου + 1′ (`expiresInMs` από τον διακομιστή) — **όχι** σε σταθερό χρονόμετρο.

**Επιστροφές με χαμένο webhook** (2026-11-13, πρότυπο Stripe / Adyen: συμφιλίωση από τη λίστα κινήσεων του παρόχου, όχι
από τη δική μας κατάσταση): το πέρασμα των `pending` **δεν** βλέπει ποτέ επιστροφή — η συνεδρία της είναι ήδη `paid`.
Δεύτερο πέρασμα (`payment-refund-reconcile.service.ts`): `provider.listRecentlyRefundedPayments(τώρα − 3 μέρες)`
(Everypay: `GET /refunds?date_from=`, ημέρα UTC — λίγο περισσότερα, ποτέ λιγότερα) ⇒ `findPaymentCheckoutBy
('paymentReference')` ⇒ ο **ίδιος** `syncCheckoutSettlement`, ιδεμποτικά. Πληρωμή χωρίς δική μας συνεδρία ⇒
`unmatched`, δεν αγγίζεται· σφάλμα ⇒ `failed`, το επόμενο πέρασμα ξαναδοκιμάζει· > 100 ανά πέρασμα ⇒ `TRUNCATED`. Το
cron εκπέμπει `refunds checked · recorded · unmatched · failed`. Οι κινήσεις γράφονται **χρονολογικά**
(`chronologicalMovements`, η πληρωμή πριν από τις επιστροφές σε ισοπαλία): ο πάροχος τις δίνει νεότερες πρώτες και
το ίχνος ακολουθούσε εκείνη τη σειρά.

### 5.6 Δημόσια σελίδα

«Πληρωμή τώρα» (`InvoicePayNowSection`): καρτέλες ανά τρόπο — Κάρτα · IRIS · Τραπεζική μεταφορά (οι υπάρχουσες
οδηγίες + EPC QR, αμετάβλητες). Ποιοι τρόποι φαίνονται το λέει ο διακομιστής (`view.onlineMethods`). Κανένα
λογότυπο τράπεζας από εμάς. Χωρίς ρυθμισμένο πάροχο η σελίδα είναι ακριβώς όπως πριν.

**Έκβαση απόπειρας** (2026-11-12, πρότυπο Stripe: η σελίδα επιστροφής ρωτά τον διακομιστή, δεν μαντεύει από τη
διεύθυνση): `GET /api/shares/[shareId]/invoice-payment/checkout?checkout=pchk_…` ⇒ `{ status: 'ok', attempt }`, με
`attempt` ∈ `PAYMENT_ATTEMPT_OUTCOMES`: `pending` · `failed` (= `pending` + `lastFailure`) · `paid` · `closed` (έληξε /
ακυρώθηκε / δεν ξεκίνησε). Υπολογίζεται στο `paymentAttemptOutcomeOf` (`invoice-payment-attempt.ts`)· η κατάσταση
νικά πάντα την άρνηση. Ίδιο κουπόνι επίσκεψης και όριο STANDARD με την όψη· GET χωρίς εγγραφή. Ξένη **ή** ανύπαρκτη
απόπειρα ⇒ η **ίδια** άρνηση `unknown-attempt` (κανένα μαντείο ύπαρξης). Η απάντηση δεν φέρει τίποτα άλλο (ούτε ποσό,
ούτε κωδικό παρόχου). Συμβόλαιο και ονόματα παραμέτρων (`PAYMENT_PAGE_ATTEMPT_PARAM` · `INVOICE_CHECKOUT_ATTEMPT_PARAM`
· `PAYMENT_ATTEMPT_ID_PATTERN`) ζουν στο `types/online-payment.ts` — ένας ορισμός για σελίδα, return route και API.
Η **πόρτα** έχει δική της σουίτα (`checkout/__tests__/checkout-attempt-route.test.ts`, 2026-11-13): χωρίς κουπόνι ή
με αναγνωριστικό εκτός σχήματος η βάση **δεν** ρωτιέται· `shareId` αποκωδικοποιημένο· 200 + `no-store`/`noindex`
σε κάθε απάντηση.

`usePaymentConfirmationWatch({ shareId, checkoutId, active, refresh })`: ο πρώτος γύρος γίνεται **αμέσως**, μετά κάθε
3″ ως το 1′, μετά κάθε 15″, ως τη **λήξη της συνεδρίας + 1′** (2026-11-13, πρότυπο Stripe: η αναμονή ακολουθεί το
`expires_at`). Η απάντηση της έκβασης φέρει `expiresInMs` = υπόλοιπο ως το `expiresAt` με το ρολόι του **διακομιστή**
(`attemptExpiresInMs`, `0` μετά τη λήξη)· η σελίδα δεν συγκρίνει ποτέ στιγμή με το ρολόι του browser. Το 1′
(`SETTLEMENT_GRACE_MS`) καλύπτει webhook + χρέωση εξουσιοδότησης της τελευταίας στιγμής· πριν από την πρώτη απάντηση
ισχύουν 15′ (`UNANSWERED_GIVE_UP_MS`). Πριν, σταθερά 15′ ενώ η IRIS ζει 35′ ⇒ πληρωμή στο 16′–35′ έδειχνε «χωρίς
έκβαση». Κάθε γύρος ρωτά έκβαση **και** όψη. Φάσεις: `waiting` · `slow` («μην πληρώσετε
ξανά») · `failed` («Η πληρωμή δεν ολοκληρώθηκε — δοκιμάστε ξανά ή επιλέξτε άλλο τρόπο») · `timed-out` (ουδέτερο
μήνυμα, **ρητό τέλος** — πριν, το μήνυμα έμενε για πάντα). Η κάρτα (νέα καρτέλα) παρακολουθεί κι αυτή τη **δική** της
απόπειρα (το `launched` κρατά το `checkoutId`). Σε κάθε τέλος (εξόφληση · αποτυχία · λήξη) η σελίδα σβήνει το
`?payment=` (`replaceUrlSearchParams` του `lib/url-query-state` — ο ΕΝΑΣ γραφέας query state, CHECK 3.7), ώστε η ανανέωση να μην ξαναρχίζει κλειστή αναμονή. Το μήνυμα αποτυχίας **δεν**
υπόσχεται «καμία χρέωση» (σπάνιος αγώνας, §5.3)· λέει ότι μια χρέωση, αν υπάρξει, θα εμφανιστεί αυτόματα.

**Επιλεξιμότητα συνδέσμου**: `isPayableByLink` = εισπρακτέο ∧ (μεταφορά ∨ κάρτα ∨ IRIS). Οι λογαριασμοί στο PDF
μένουν στο `showsPaymentInstructions` (όχι IBAN σε τιμολόγιο «κάρτα»).

### 5.7 Ρύθμιση από τον άνθρωπο (ποτέ από πράκτορα)

`EVERYPAY_SECRET_KEY` · `EVERYPAY_PUBLIC_KEY` · `PAYMENTS_PROVIDER_MODE=sandbox` (δηλωμένα στο
`environment-contract.ts` + `.env.example`). Στο dashboard της Everypay: webhooks «Notification paid» ·
«Notification expired» · «Refund» · «New Payment (IRIS)» ⇒ `https://<domain>/api/payments/webhooks/everypay`.
Ενεργοποίηση IRIS / Apple Pay / Google Pay στον λογαριασμό εμπόρου.

### 5.8 Ανοιχτά προς επαλήθευση στο sandbox

1. Κωδικοποίηση υπογραφής IRIS `hash` (hex / base64 — δεκτά και τα δύο). Η τεκμηρίωση ξαναελέγχθηκε 2026-11-13:
   μόνο ψευδοκώδικας `Hmacsha256(json, sk)`, καμία κωδικοποίηση εξόδου. Τα Α-12 / Α-13 πέρασαν χωρίς να καταγραφεί
   **ποια** ταίριαξε. Από 2026-11-13 ο έλεγχος **λέει** τη μορφή (`AcceptedVerdict.signatureScheme`: `iris-hash-hex`
   · `iris-hash-base64` · `webhook-header`) στο «Payment webhook applied», στην επιστροφή browser και στο
   `payment_provider_events.signatureScheme`. **Επόμενο βήμα**: με το πρώτο ζωντανό IRIS, ο έλεγχος στενεύει στη μία
   μορφή που είδαμε.
2. Η ακριβής μορφή του σώματος κάθε webhook (η τεκμηρίωση δίνει λίστα πεδίων, όχι παράδειγμα ανά συμβάν): ο adapter
   ταξινομεί με το πρόθεμα του `token` (`pnt_` / `pmt_`)· άγνωστη μορφή ⇒ `ignored` + ίχνος, και η συμφιλίωση καλύπτει.
3. ~~Η μορφή απάντησης λίστας~~ — **έκλεισε** (§5.9 #6): `{ total_count, items }`, μόνο αυτή· άλλη μορφή ⇒ 502.
4. Αν η hosted σελίδα της ειδοποίησης επιστρέφει στον έμπορο (δεν τεκμηριώνεται πεδίο) — γι' αυτό νέα καρτέλα.
5. ~~**Είναι το `md` μέσα στο υπογεγραμμένο JSON της αποτυχίας IRIS;**~~ — **έκλεισε** (§5.9 #7, 2026-11-13): **ναι**
   (`signedFields: null` και στις δύο διαδρομές). Ιστορικό: η τεκμηρίωση το δείχνει υπογεγραμμένο μόνο στην
   επιτυχία· στην αποτυχία το δείχνει ως εξωτερικό πεδίο. Αν **δεν** είναι υπογεγραμμένο ⇒ `checkoutId: null` ⇒
   `unknown`, και η σελίδα πέφτει στο μήνυμα των 15′. Θα το δείξει το πρώτο log μετά το deploy (`signedFields`).
6. ~~Λήξη συνεδρίας IRIS 15′ έναντι 24 ωρών~~ — **έκλεισε** (2026-11-13, §5.5): η λήξη του παρόχου γίνεται το
   `expiresAt`· οι 24 ώρες = παράθυρο ανάκτησης από εκεί. Μένει ατεκμηρίωτη η επανάληψη της **ίδιας** συνεδρίας
   IRIS μετά από αποτυχία (ούτε GET συνεδρίας IRIS)· η σελίδα προτείνει νέα απόπειρα, που ανοίγει νέα συνεδρία.
   ✅ **35′ ή 15′; — έκλεισε (2026-11-13): 35′, ζώνη ώρας σωστή.** Log `pchk_1745098c…`: `providerCreatedAtRaw`
   `2026-11-13T12:49:36+0200` · `providerExpiresAtRaw` `…13:24:36+0200` · `providerLifetimeSeconds` **2100** ·
   `providerClockSkewSeconds` **−1**. Η Everypay στέλνει μετατόπιση, ο αναγνώστης τη σέβεται. Συνέπεια: η αναμονή της
   σελίδας (§5.6) ακολουθεί πλέον τη λήξη. Η παραγωγή της Everypay μπορεί να διαφέρει — το ίδιο log θα το δείξει.
   Ιστορικό: ζωντανά (Α-13 `pchk_0ed36c2b…`) η λήξη βγήκε **35′** μετά τη δική μας `createdAt`, ενώ το
   παράδειγμα του API reference δείχνει 15′. Η διάρκεια **δεν** τεκμηριώνεται ρητά. Διάγνωση (2026-11-13): ο adapter
   επιστρέφει τις **ωμές** τιμές (`StartedCheckout.providerClock` ← `date_created` / `expiration_date`, `providerClockOf`)
   και η έναρξη γράφει `Checkout started at provider` με `startedCheckoutDiagnostics` (ένας ορισμός, πρότυπο
   `webhookSignalDiagnostics`): `providerLifetimeSeconds` = λήξη − δημιουργία **με το ρολόι του παρόχου** (λάθος ζώνης
   αλληλοαναιρείται) · `providerClockSkewSeconds` = δημιουργία παρόχου − δική μας `createdAt` (±ακέραιες ώρες ⇒ λάθος
   ζώνη ώρας). Η επόμενη ζωντανή απόπειρα κλείνει το ερώτημα.
7. Πολιτική επαναλήψεων webhook: δεν τεκμηριώνεται (docs «Webhooks»).

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

   ✅ **Επαληθεύτηκε ζωντανά 2026-11-12** (η Everypay απάντησε στο 00128279 «ενεργοποιήθηκαν οι υπηρεσίες», χωρίς
   να πει ποιες): νέο τιμολόγιο Α-12 12,40 € (τρόπος «Κάρτα» — η φόρμα τιμολογίου **δεν** προσφέρει IRIS· η δημόσια
   σελίδα δείχνει πάντως Κάρτα + IRIS), συνεδρία `pchk_23d2493a-d769-4432-af5c-cfa8d0e37d08`. Το `POST
   /iris/sessions` πέτυχε ⇒ η φόρμα POST οδήγησε στον **προσομοιωτή IRIS** του sandbox
   (`sandbox-dashboard.everypay.gr/iris-emulator`: «Δημιουργία QR» ή «Επιλέξτε τράπεζα» ⇒ «Επιτυχής / Αποτυχία
   Ταυτοποίησης»). «Επιλέξτε τράπεζα» ⇒ «Επιτυχής Ταυτοποίηση» ⇒ η δημόσια σελίδα «Εξοφλήθηκε», η Λογιστική
   «Εξοφλημένο». Logs (με τη σειρά τους):
   - `PaymentReturnRoute` «Browser returned from payment provider» `signal: authorized-source` — το `hash` του
     callback **επαληθεύτηκε**.
   - `PaymentWebhookRoute` «Payment webhook applied» `signal: authorized-source` · `outcome: recorded` — το webhook
     IRIS (`hash`, JSON) ⇒ `POST /payments {token, amount, merchant_ref}` ⇒ `GET /payments?merchant_ref=` ⇒
     `recordInvoicePayment`.
   - `PaymentWebhookRoute` «Payment webhook applied» `signal: payment-reference` · `outcome: unchanged` — **δεύτερο**
     webhook, σε **άλλη** μορφή: σώμα πληρωμής (`pmt_…`) με κεφαλίδα `X-Signature-SHA256`, όχι `hash`. Βρήκε τη
     συνεδρία από το `paymentReference` και δεν ξαναέγραψε (ιδεμποτία). ⚠️ Συμπέρασμα (όχι τεκμηρίωση): το πρώτο
     ήρθε από το `webhook_url` της συνεδρίας, το δεύτερο από το συμβάν «Νέα Πληρωμή (IRIS)» του dashboard.
   - Συμφιλίωση στο επόμενο πέρασμα: `pending 0` — η συνεδρία ήταν ήδη `paid`.

   Ο φόβος «δεύτερη χρέωση της ίδιας πηγής» (`41001` έναντι σφάλματος διπλού `merchant_ref`) **δεν** εμφανίστηκε: το
   δεύτερο webhook δεν είναι `authorized-source`, άρα δεν χρεώνει. Μένει θεωρητικός μόνο για **επανάληψη** του webhook
   `hash` από τον πάροχο (πολιτική επαναλήψεων: ανεπιβεβαίωτη, §5.3). Ανοιχτό ακόμη: §5.8 #1 (hex ή base64 πριν από
   το `|`) — πέρασε, αλλά τα logs δεν λένε ποια μορφή. Καμία αλλαγή κώδικα.
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

7. **IRIS «Αποτυχία Ταυτοποίησης»** (2026-11-12, ~21:51 ώρα Ελλάδας): νέο τιμολόγιο Α-13 12,40 €
   (`inv_e1e9d257-5e03-4e78-87bb-d57c65f6d306`), συνεδρία `pchk_ba607a61-4f3e-40aa-97fd-4d8c7aaff7a1`, προσομοιωτής
   ⇒ «Επιλέξτε τράπεζα» ⇒ «Αποτυχία Ταυτοποίησης». Logs:
   - `PaymentReturnRoute` «Browser returned from payment provider» `signal: ignored` — ο browser επιστρέφει **και**
     σε αποτυχία, με έγκυρο `hash`.
   - `PaymentWebhookRoute` «Payment webhook applied» `signal: ignored` · `outcome: ignored` — ✅ **η Everypay στέλνει
     webhook IRIS και σε αποτυχία** (άγνωστο ως τώρα). Καμία χρέωση πηγής. ⚠️ Το log δεν γράφει τον **λόγο**
     (`iris-authorization-failed` ή `iris-payload-incomplete`)· δεν ελέγχθηκε το `payment_provider_events`.
   - Το Α-13 έμεινε «Απλήρωτο» (Λογιστική), η συνεδρία `pending` (κλείνει `expired` 24 ώρες μετά τη λήξη, §5.5).
   - 🔴 **Η δημόσια σελίδα λέει ψέματα**: με `?payment=` δείχνει «Η πληρωμή σας καταχωρείται … Συνήθως διαρκεί λίγα
     δευτερόλεπτα» και μετά από 1′ «… μην πληρώσετε ξανά», ενώ η ταυτοποίηση **απέτυχε**. Η σελίδα δεν ξέρει την
     έκβαση της συνεδρίας — ρωτά μόνο «εξοφλήθηκε;» (`usePaymentConfirmationWatch`, 3″/15″ ως 15′· μετά το μήνυμα
     **μένει**, και η ανανέωση το ξαναρχίζει γιατί το `?payment=` μένει στη διεύθυνση). **Διορθώθηκε 2026-11-12**
     (§5.3 `lastFailure` · §5.4 επιστροφή · §5.6 έκβαση απόπειρας).

   ✅ **Επαληθεύτηκε ζωντανά 2026-11-13** (live `d04b7e1`, περιέχει το `3a1e7c0a`): Α-13, νέος σύνδεσμος «Δοκιμή
   έκβασης αποτυχίας IRIS Α-13», συνεδρία `pchk_59a3be71-fd7a-427f-b318-64f27ff7f50b`, προσομοιωτής ⇒ «Αποτυχία
   Ταυτοποίησης». Logs (με τη σειρά τους):
   - `PaymentReturnRoute` «Browser returned from payment provider» `signal: authorization-failed` · `reason:
     provider-code:104000` · `signedFields: null` · **`failure: failure-noted`** — η επιστροφή έγραψε **πρώτη**.
   - `PaymentWebhookRoute` «Payment webhook applied» `signal: authorization-failed` · ίδιος κωδικός · **`outcome:
     unchanged`** — το webhook ήρθε δεύτερο και δεν ξανάγραψε (ιδεμποτία).
   - Δημόσια σελίδα: «Η πληρωμή δεν ολοκληρώθηκε», το `?payment=` σβήστηκε, «Πληρωμή τώρα» διαθέσιμο ξανά.
   Συμπεράσματα: το `md` **είναι** υπογεγραμμένο και στην αποτυχία (§5.8 #5 κλειστό) · η επιστροφή browser
   προλαβαίνει το webhook, άρα η απόφαση §5.4 απέδωσε · ο κωδικός «Αποτυχίας Ταυτοποίησης» του sandbox είναι
   `104000` (όχι από τεκμηρίωση). Καμία αλλαγή κώδικα.
   - Παρατήρηση: η συμφιλίωση **πριν** από τη δοκιμή έγραψε `pending 1 · still-open 1` — ανοιχτή συνεδρία που δεν
     είναι του Α-13 (δεν διερευνήθηκε ποια).
8. 🔴 **Οι λίστες διάβαζαν μόνο την πρώτη σελίδα** (εύρημα κώδικα, 2026-11-13 — όχι ζωντανό περιστατικό): η
   τεκμηρίωση («List all payments / refunds») δίνει `count` 1–20 με **προεπιλογή 10** και `offset`. Το `listRequest`
   δεν έστελνε κανένα από τα δύο ⇒ πληρωμή με 11 επιστροφές θα κατέγραφε σιωπηλά τις 10 (`GET /refunds?payment=`),
   και το ίδιο το `GET /payments?merchant_ref=`. Διόρθωση: `everypay-list.ts` (`everypayListAll`) — σελίδα 20 ως το
   `total_count` ή κενή σελίδα, αποδιπλασιασμός κατά `token` (μετατόπιση σελίδων), όριο 50 σελίδων ⇒ **502**, ποτέ
   σιωπηλή αποκοπή· το `total_count` είναι πλέον υποχρεωτικό (`listPageOrNull`), αλλιώς 502.

### 5.10 Επιστροφή χρημάτων και οφειλή (2026-11-13)

**Απόφαση:** η επιστροφή χρημάτων **δεν ξανανοίγει** το τιμολόγιο. Πρακτική: Stripe — μετά από refund το τιμολόγιο
μένει `paid` με `amount_remaining = 0`, και την οφειλή τη μειώνει μόνο το πιστωτικό (`pre_payment_amount` /
`post_payment_amount`)· Xero / Zoho — η επιστροφή πάει σε πιστωτικό ή υπερπληρωμή, δεν αναιρεί την είσπραξη.
Ελληνικό πλαίσιο: η επιστροφή λόγω ακύρωσης / έκπτωσης θέλει **πιστωτικό στοιχείο** (myDATA 5.1/5.2), που ήδη
συμψηφίζεται με το τιμολόγιό του στο καθολικό απαιτήσεων (`relatedInvoiceId`).

| Πεδίο | Πριν | Τώρα |
|---|---|---|
| `totalPaid` | πληρωμές − επιστροφές | **μόνο** πληρωμές (Stripe `amount_paid`) |
| `totalRefunded` | — | **μόνο** επιστροφές (νέο παράγωγο, server-owned) |
| `balanceDue` / `paymentStatus` | ξανάνοιγαν με την επιστροφή | από τις πληρωμές· τα μειώνει πληρωμή ή πιστωτικό |
| Καθολικό απαιτήσεων `paidAsOf` | 🔴 μετρούσε την επιστροφή **ως πληρωμή** (αντίθετο πρόσημο από την εξόφληση) | αγνοεί τις επιστροφές |

🔴 Τι διόρθωσε: (α) μετά από πλήρη επιστροφή το τιμολόγιο γινόταν «απλήρωτο» και η **δημόσια σελίδα ξαναζητούσε
πληρωμή** από τον πελάτη που μόλις αποζημιώθηκε (το ίδιο για τη μερική)· (β) η ίδια επιστροφή μετρούσε με αντίθετο
πρόσημο σε εξόφληση και καθολικό. Ένα κριτήριο: `isRefundMovement` (εξόφληση · καθολικό · ίχνος του γραφέα).
Η σελίδα μετά από επιστροφή δείχνει «εξοφλήθηκε» (το `standing` διαβάζει το `paymentStatus`).

⚠️ Αποθηκευμένα παράγωγα: τα έγγραφα με επιστροφή **πριν** από την αλλαγή (δοκιμαστικό Α-11: `partial`, υπόλοιπο
6,00 €) κρατούν τα παλιά παράγωγα ώσπου να ξαναγραφτεί κίνηση ή να κληθεί το `resettleInvoicePayments`.

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
| 2026-11-12 | §5.9 #2 ✅ IRIS ενεργό στο sandbox και επαληθευμένο ζωντανά (Α-12): callback `authorized-source` · webhook `hash` ⇒ χρέωση πηγής ⇒ `recorded` · δεύτερο webhook `pmt_` ⇒ `unchanged` (ιδεμποτία)· καμία αλλαγή κώδικα. |
| 2026-11-12 | §3: IRIS στον `PaymentMethodSelector` (τιμολόγιο + Βιβλίο Ε-Ε)· `PAYMENT_METHOD_LABELS` εξαντλητικό (`iris`, `mixed`, `non_cash`)· `isPayableByLink` διαβάζει το `isOnlinePaymentMethod` (διπλότυπο `ONLINE_LINK_PAYMENT_METHODS` αφαιρέθηκε). |
| 2026-11-12 | §5.9 #7: IRIS «Αποτυχία Ταυτοποίησης» (Α-13) ⇒ επιστροφή + webhook `ignored`, καμία χρέωση, «Απλήρωτο»· η Everypay στέλνει webhook και σε αποτυχία· 🔴 η δημόσια σελίδα δείχνει «καταχωρείται» μετά από αποτυχία (ανοιχτό). |
| 2026-11-12 | §5.9 #7 διόρθωση: σήμα `authorization-failed` (μόνο υπογεγραμμένο `md`) · `lastFailure` σε `pending` συνεδρία (ΟΧΙ `status: 'failed'`), σε συναλλαγή, από webhook **και** επιστροφή browser (απόφαση Giorgio — η Everypay εγγυάται webhook μόνο για επιτυχίες) · `GET …/checkout?checkout=` έκβαση απόπειρας · η σελίδα δείχνει «δεν ολοκληρώθηκε», τέλος αναμονής στα 15′, σβήνει το `?payment=` · λόγος σήματος σε log + `payment_provider_events` · §5.8 #5–#7 νέα ανοιχτά. |
| 2026-11-13 | §5.9 #7 ✅ επαληθεύτηκε ζωντανά (Α-13, `pchk_59a3be71…`): επιστροφή `failure-noted` · webhook `unchanged` · σελίδα «δεν ολοκληρώθηκε»· κωδικός sandbox `104000`· §5.8 #5 κλειστό (το `md` υπογράφεται και στην αποτυχία). |
| 2026-11-13 | §5.5 / §5.8 #6: η λήξη που δηλώνει ο πάροχος (`StartedCheckout.providerExpiresAt`, Everypay `expiration_date`) γίνεται το `expiresAt` της συνεδρίας — IRIS 15′ αντί για τα 30′ που ζητούσαμε· οι 24 ώρες του IRIS = παράθυρο ανάκτησης από την πραγματική λήξη· `instantField` στους αναγνώστες· 3 tests `startCheckout`· jest των 3 σουιτών 30/30. |
| 2026-11-13 | §5.6: σουίτα για την πόρτα `GET …/checkout?checkout=` (9 tests — κουπόνι, σχήμα αναγνωριστικού, αποκωδικοποίηση `shareId`, ιδιωτικές κεφαλίδες). |
| 2026-11-13 | §5.5 / §5.9 #8: σελιδοποίηση όλων των λιστών Everypay (`everypayListAll`, `count=20` + `offset`, αποδιπλασιασμός, όριο ⇒ 502)· port `listRecentlyRefundedPayments` + πέρασμα επιστροφών στο cron (`payment-refund-reconcile.service.ts`)· `chronologicalMovements` στον συγχρονισμό· §4 πίνακας· 3 νέες σουίτες (list · refund reconcile · chronology). |
| 2026-11-13 | §5.10: η επιστροφή δεν ξανανοίγει την οφειλή (πρότυπο Stripe) — `totalPaid` μόνο πληρωμές, νέο παράγωγο `totalRefunded` (server-owned), `paidAsOf` του καθολικού απαιτήσεων αγνοεί τις επιστροφές (πριν τις μετρούσε ως πληρωμή), `isRefundMovement` ένα κριτήριο· tests εξόφλησης ενημερωμένα + ένα καθολικού. |
| 2026-11-13 | §5.3: το `[WARN] [AUTH_CONTEXT] DENY` σε κάθε webhook = καταγραφή ανώνυμου σε **δημόσια** διαδρομή, όχι άρνηση ⇒ `debug` όταν `allowUnauthenticated` (ADR-821), απόφαση αμετάβλητη. |
| 2026-11-13 | §5.8 #1: η μορφή υπογραφής που ταίριαξε καταγράφεται (`AcceptedVerdict.signatureScheme` → `webhookSignalDiagnostics` → logs webhook/επιστροφής + `payment_provider_events.signatureScheme`) ώστε το επόμενο ζωντανό IRIS να κλείσει το hex/base64· σουίτα `webhook-signal-diagnostics` (4). |
| 2026-11-13 | §3: το enum `paymentMethod` του AI αναλυτή (`document-analyzer.schemas.ts`) χωρίς `iris` ⇒ παράγεται εξαντλητικά από τον `PaymentMethod` (ACC-005 changelog). |
| 2026-11-13 | §3: `paymentMethodLabelIn` (`payment-method-label-bundle.ts`) — οι δύο χειρόγραφοι πίνακες ετικετών των email (`base-email-template.ts` · `notification-helpers.ts`, κλειδιά εκτός `PaymentMethod`, χωρίς `card`/`iris`) αντικαταστάθηκαν από τα κλειδιά i18n της UI· test (10). |
| 2026-11-13 | §5.8 #6 διάγνωση 35′ vs 15′: `StartedCheckout.providerClock` (ωμά `date_created` / `expiration_date`, `providerClockOf`) · `startedCheckoutDiagnostics` (διάρκεια ζωής με το ρολόι του παρόχου + απόκλιση από το δικό μας) · log `Checkout started at provider` στην έναρξη· σουίτα `started-checkout-diagnostics` (3) + 2 έλεγχοι στο `everypay-adapter`· jest 18/18. Ανακλήθηκαν οι 10 δοκιμαστικοί σύνδεσμοι πληρωμής (Α-13 ×3 · Α-12 · Α-11 ×2 · Α-10 ×3 · Α-7). |
| 2026-11-13 | §5.8 #6 ✅ έκλεισε ζωντανά: IRIS sandbox = **35′** (`providerLifetimeSeconds` 2100), ζώνη ώρας σωστή (`providerClockSkewSeconds` −1). §5.6: η αναμονή της σελίδας τελειώνει στη λήξη της συνεδρίας + 1′ αντί για σταθερά 15′ — `expiresInMs` στην απάντηση έκβασης (`attemptExpiresInMs`, ρολόι διακομιστή), `deadlineAfter` στο `usePaymentConfirmationWatch`· §5.5 διορθώθηκε. Tests: `invoice-payment-attempt` (+1) · `checkout-attempt-route`. |
