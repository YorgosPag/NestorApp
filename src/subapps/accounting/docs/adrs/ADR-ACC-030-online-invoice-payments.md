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
| Webhooks | `X-Signature-SHA256` = base64(HMAC-SHA256(raw body, secret key)) · IRIS: πεδίο `hash` = base64(«υπογραφή\|JSON») με HMAC-SHA256 του JSON · **κανένα event id**, **κανένα idempotency header** |
| Πληρωμές / επιστροφές | `GET /payments/{id}` · `GET /payments?merchant_ref=` · `POST /refunds {payment, amount?}` (μερικές) · `GET /refunds?payment=` |

⚠️ **Ανοιχτό προς επαλήθευση στο sandbox**: η κωδικοποίηση της υπογραφής πριν από το `|` στο IRIS `hash` (hex ή
base64) δεν δηλώνεται ρητά. Ο έλεγχος δέχεται και τις δύο κωδικοποιήσεις του **ίδιου** HMAC. Αυτό δεν χαλαρώνει την
ασφάλεια: η πληρωμή γίνεται μόνο όταν πετύχει το `POST /payments` με το **δικό μας** μυστικό κλειδί και το ποσό της
συνεδρίας.

## 5. Ροή (Βήματα 2–6)

_Συμπληρώνεται ανά βήμα._

## 6. Εκτός εμβέλειας

- Επιστροφή χρημάτων **από** την εφαρμογή (το port την υποστηρίζει· οι επιστροφές από το dashboard του παρόχου
  καταγράφονται αυτόματα).
- Κλειδιά ανά εταιρεία με κρυπτογράφηση σε ηρεμία (σήμερα: ένας λογαριασμός εμπόρου από το περιβάλλον).
- PayPal / Revolut Pay · διαβίβαση myDATA · παρακράτηση στο πληρωτέο ποσό (ACC-018 §16).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-11 | Βήμα 1: μοντέλο, ένας γραφέας, server-owned πεδία, ταυτότητες, συλλογές + κανόνες. |
