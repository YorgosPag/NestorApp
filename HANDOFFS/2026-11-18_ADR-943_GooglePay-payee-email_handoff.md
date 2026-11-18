# HANDOFF — Google Pay στη hosted σελίδα EveryPay: λείπει το `payee_email` (ΣΧΕΔΙΟ ΕΓΚΡΙΘΗΚΕ, κώδικας ΟΧΙ)

**Ημερομηνία:** 2026-11-18 · Προηγούμενο: `2026-11-18_ADR-943_F6a-IBAN-verified_L9-vat-mask_handoff.md`
**Worktree:** `C:\Nestor_Worktrees\wt-prune` · **κλαδί:** `agent/wt-prune` · συνέχεια στο ΙΔΙΟ worktree.
**HEAD κλαδιού πριν από αυτό το handoff:** `2c21173f` (Λ-9 μάσκα ΑΦΜ — jest 34/34, πύλες PASS). **ΔΕΝ** έγινε `wt:land`.

## 0. Κανόνες (Giorgio)
- Commit μόνο στο `agent/wt-prune`, ρητή λίστα αρχείων. Ποτέ `main`. `wt:land` / push **μόνο με εντολή του**.
- Ποτέ `--no-verify` · ποτέ `tsc` · jest/checks **μόνο με έγκριση**. Πρωτοβουλίες = πρόταση μίας γραμμής και στάση.
- Ο πράκτορας δεν πληκτρολογεί IBAN/ΑΦΜ/κωδικούς σε σελίδες· **δεν διαβάζει** μυστικά `.env` (το auto mode το αρνείται —
  σωστά). Ό,τι χρειάζεται κλειδί → script που το τρέχει ο Giorgio με `!`.
- Πρότυπο ποιότητας: «όπως οι μεγάλοι παίκτες», full enterprise + full SSoT, **SSoT audit (grep) ΠΡΙΝ από κώδικα**,
  έρευνα στο διαδίκτυο όπου υπάρχει αβεβαιότητα.

## 1. Το εύρημα (ΕΠΑΛΗΘΕΥΜΕΝΟ ζωντανά, sandbox)
- EveryPay (email 18/11 13:00, νήμα «Ενεργοποίηση Apple Pay / Google Pay»): GPay/APay **ενεργά** στο sandbox· «δημιουργήστε
  νέα ειδοποίηση **συμπληρώνοντας email ή κινητό του πελάτη**, ανοίξτε σε Chrome». Webhook retries: **ακόμη αναμένεται**.
- Ο κώδικάς μας (`src/server/payments/providers/everypay/everypay-adapter.ts:66-89`, `startCardCheckout`) στέλνει στο
  `POST /notifications` ΜΟΝΟ amount/description/skip_notify/locale/expiration_date/split — **κανένα email/τηλέφωνο**.
- Δοκιμή: ειδοποίηση `pnt_HeyWH3tmZkRO5HfSz5DnDc6t` (1 €, `payee_email`, `skip_notify=1`, 13:13) ⇒ **κουμπί G Pay ΕΜΦΑΝΙΣΤΗΚΕ**.
  Οι A-13/14/15 (χωρίς email) δεν το έδειχναν. ⇒ **αιτία επιβεβαιωμένη**. (Μην πληρωθεί· λήγει μόνη της.)
- Ονόματα πεδίων (επίσημο https://docs.everypay.gr/api-reference/ «Create a notification»): **`payee_email`** (υποχρ. όταν
  `skip_notify=0`, προαιρ. όταν `=1`) · **`payee_phone`** (διεθνής μορφή) · `payee_name` (υποχρ. μόνο με `create_customer=1`).
- Το dashboard sandbox **δεν** έχει UI δημιουργίας ειδοποίησης (Νέα πληρωμή = MOTO χρέωση κάρτας· Τιμολόγια = Marketplace
  invoices· Πελάτες = αποθηκευμένες κάρτες) ⇒ μόνο API.

## 2. Χαρτογράφηση (grep, ανάγνωση — κανένα αρχείο δεν άλλαξε)
- ΕΝΑ σημείο εκκίνησης: `launchCheckoutAtProvider` (`src/server/payments/payment-checkout-launch.ts`) → `provider.startCheckout(CheckoutRequest)`.
- `CheckoutRequest`: `src/server/payments/payment-provider.ts:31` — **κανένα πεδίο πληρωτή**.
- ΔΥΟ καλούντες:
  | Διαδρομή | Email | Πηγή |
  |---|---|---|
  | Προκαταβολή (ADR-943) `src/server/issuance-invitations/issuance-advance-checkout.ts:172` | ✅ πάντα | `invitation.recipient.email` (υποχρ., `src/types/issuance-invitation.ts:245`· η πρόσκληση δεν φεύγει χωρίς email, `issuance-advance-link.ts:155`) |
  | Τιμολόγιο share link (ADR-ACC-030) `src/server/accounting/payments/invoice-payment-checkout.ts:95` | ⚠️ όχι πάντα | `invoice.customer.email: string \| null` (`src/subapps/accounting/types/invoice.ts:204`) |
- UI τιμολογίου: `src/components/shared/pages/invoice-payment/useInvoiceCheckout.ts` · route `src/app/api/shares/[shareId]/invoice-payment/checkout/route.ts`.
- IRIS (`/iris/sessions`) **δεν** είναι ειδοποίηση ⇒ δεν χρειάζεται email.

## 3. Έρευνα «μεγάλος παίκτης» — Stripe Checkout (docs.stripe.com/api/checkout/sessions/create)
`customer_email`: «If provided … used … **If not provided, customers will be asked to enter their email address.** Use this
parameter to prefill customer data if you already have an email on file.» ⇒ γνωστό → prefill· άγνωστο → **υποχρεωτική** συλλογή.
Η σελίδα EveryPay **δεν** συλλέγει email ⇒ τη συλλογή την κάνουμε **εμείς** πριν από το redirect.

## 4. ΑΠΟΦΑΣΕΙΣ GIORGIO (2026-11-18)
1. Τιμολόγιο χωρίς γνωστό email + **κάρτα** ⇒ πεδίο email **ΥΠΟΧΡΕΩΤΙΚΟ** (πρακτική Stripe). IRIS ⇒ καμία ερώτηση.
2. Γνωστό email ⇒ το περνά ο **server**, και **ΔΕΝ εμφανίζεται ποτέ** στη σελίδα του κοινόχρηστου συνδέσμου (απόρρητο —
   όποιος κρατά τον σύνδεσμο δεν μαθαίνει το email του πελάτη· εδώ ξεπερνάμε το Stripe που το δείχνει κλειδωμένο).
3. Προκαταβολή ⇒ αυτόματα από `invitation.recipient.email`.
4. Τρόπος εκτέλεσης: **Plan Mode** (~10 αρχεία, 2 domains — N.8: αν η νέα συνεδρία κρίνει orchestrator, ΡΩΤΑ πρώτα).

## 5. ΣΧΕΔΙΟ (για τη νέα συνεδρία)
**Φάση 0 — SSoT audit (grep) ΠΡΙΝ από κώδικα:** υπάρχει ήδη επικυρωτής email (π.χ. `src/lib/validation/*`, zod schemas
στο body του checkout), κοινό component πεδίου email (`src/components/ui/*`), κανονικοποίηση τηλεφώνου σε E.164; Χρήση
των υπαρχόντων — μηδέν διπλότυπα. Έλεγχος ADR-ACC-030 + ADR-943 vs κώδικα (N.0.1 Φάση 1).
1. `payment-provider.ts`: `CheckoutRequest.payer: { readonly email: string | null; readonly phone: string | null }` —
   **ρητό** (όπως το `split`), όχι προαιρετικό: κάθε καλών απαντά τι ξέρει.
2. `everypay-adapter.ts` `startCardCheckout`: `payee_email` / `payee_phone` όταν μη-null (helper τύπου `splitField`).
3. `payment-checkout-launch.ts`: `CheckoutLaunchInput.payer` → περνά αυτούσιο (καμία λογική).
4. `issuance-advance-checkout.ts`: `payer: { email: invitation.recipient.email, phone: null }` (ή τηλέφωνο αν υπάρχει SSoT).
5. Τιμολόγιο: server = `invoice.customer.email ?? body.payerEmail`· body schema + validation server-side· αν κάρτα και
   κανένα email ⇒ ονομασμένη άρνηση (π.χ. `payer-email-required`), όχι 500. Η απάντηση της σελίδας λέει μόνο **αν**
   χρειάζεται email (boolean), ποτέ το ίδιο το email.
6. UI σελίδας πληρωμής τιμολογίου: υποχρεωτικό πεδίο email μόνο για κάρτα όταν ο server λέει ότι λείπει· έλεγχος
   εγκυρότητας και στη σελίδα· i18n κλειδιά el+en (N.11, πρώτα στα locales, μετά `generate:i18n-types` /
   `generate:i18n-shell-slice`)· semantic HTML, κανένα inline style.
7. Tests (με έγκριση): adapter (`payee_email` στο form· απουσία όταν null) · invoice checkout (γνωστό/άγνωστο/λείπει+κάρτα/IRIS) ·
   advance checkout.
8. ADR-ACC-030 + ADR-943: εύρημα 18/11 + changelog (ίδιο commit με τον κώδικα).
9. Μετά: πρόχειρο απάντησης προς EveryPay («επιβεβαιώθηκε· αναμένουμε webhook retries») — αποστολή ΜΟΝΟ με έγκριση.

## 6. Ανοιχτά από πριν (ισχύουν)
- Ζωντανός έλεγχος κάρτας ΑΦΜ `•••••• 783` μετά το deploy (Λ-9) — θέλει land+push με εντολή.
- Φ6: γραφείο → ανάθεση με προκαταβολή → πληρωμή ιδιοκτήτη → `on_hold`.
- Προτάσεις προηγούμενου handoff §4 (κενά λίστας «Τι εκκρεμεί», ειδοποίηση μηχανικού, ορφανός πωλητής, EveryPay 00128788, δικηγόροι).

## 7. Μην κάνεις
`--no-verify` · γυμνό `git stash` · commit στο `main` · land/push χωρίς εντολή · jest/tsc/checks χωρίς έγκριση ·
ανάγνωση μυστικών `.env` · πληκτρολόγηση IBAN/ΑΦΜ/κωδικού · αποστολή email χωρίς έγκριση · Coolify · διαγραφή webhook EveryPay.
