# Handoff — ADR-ACC-030 «Πληρωμή τώρα»: αποτυχία IRIS επαληθεύτηκε ⇒ επόμενο η σελίδα να ξέρει την έκβαση της απόπειρας

**Ημερομηνία:** 2026-11-12
**Worktree:** `C:\Nestor_Worktrees\accounting-next`
**Κλαδί:** `agent/accounting-next`
**ADR:** `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md` (§5.9 #7 = το εύρημα)
**Προηγούμενο handoff:** `docs/handoffs/2026-11-12-accounting-030-iris-verified-next-iris-form-and-failure.md`

## 1. Κατάσταση

- ✅ **IRIS στη φόρμα τιμολογίου** — commit `b41be7d6` (ΟΧΙ ακόμη στην παραγωγή — θέλει land + push):
  `PaymentMethodSelector` + `'iris'` (τιμολόγιο **και** Βιβλίο Ε-Ε, απόφαση Giorgio) · `PAYMENT_METHOD_LABELS`
  (`services/pdf/invoice-pdf-constants.ts`) = `Readonly<Record<PaymentMethod, string>>` εξαντλητικό (+`iris`, `mixed`,
  `non_cash`), αφαιρέθηκε το νεκρό `?? invoice.paymentMethod` στο `invoice-pdf-sections.ts` · `isPayableByLink`
  διαβάζει `isOnlinePaymentMethod` (σβήστηκε το διπλότυπο `ONLINE_LINK_PAYMENT_METHODS`). ADR §3 + changelog.
- ✅ **Σενάριο «Αποτυχία Ταυτοποίησης» IRIS** — commit `212f4671` (ADR §5.9 #7). Α-13
  (`inv_e1e9d257-5e03-4e78-87bb-d57c65f6d306`, 12,40 €, τρόπος «Κάρτα» γιατί η παραγωγή δεν έχει ακόμη το IRIS στη
  φόρμα), σύνδεσμος «Δοκιμή αποτυχίας IRIS Α-13» (`share_24831ea3-1150-4b1f-820d-53a8f44abefd`), συνεδρία
  `pchk_ba607a61-4f3e-40aa-97fd-4d8c7aaff7a1`. Logs: επιστροφή `signal: ignored` · **webhook ΚΑΙ σε αποτυχία**
  `signal: ignored · outcome: ignored` · καμία χρέωση · Α-13 «Απλήρωτο».
  - 🔴 Η δημόσια σελίδα δείχνει «Η πληρωμή σας καταχωρείται» (και στο 1′ «μην πληρώσετε ξανά») ενώ η ταυτοποίηση
    απέτυχε. **Αυτό είναι το επόμενο βήμα — εγκεκριμένο από τον Giorgio («ΝΑΙ»).**
  - Συμφιλίωση **πριν** τη δοκιμή: `pending 1 · still-open 1` — άλλη ανοιχτή συνεδρία, άγνωστο ποια (δεν διερευνήθηκε).
- Commits στο κλαδί **χωρίς land**: `1d259b97` `5e237f9d` `ece9074e` `ca55360b` `c1b3c169` `b41be7d6` `212f4671` +
  το commit αυτού του handoff. **wt:land και push ΜΟΝΟ με εντολή Giorgio.**

## 2. Επόμενο βήμα — η σελίδα μαθαίνει την έκβαση της απόπειρας (Stripe `last_payment_error`)

Εγκεκριμένο σχέδιο. Τρόπος εκτέλεσης: **ένας πράκτορας σε Plan Mode, Opus** (N.8: ~12 αρχεία / 2 περιοχές — ο
Giorgio το είδε). **Πρώτα** πραγματικό SSoT audit (git grep) ξανά, πες στον Giorgio τη λίστα, **μετά** κώδικας.

### 2.1 Κρίσιμη απόφαση σχεδίου (μην την αλλάξεις χωρίς Giorgio)

**ΟΧΙ `status: 'failed'` σε αποτυχία IRIS.** Η συμφιλίωση και το κλείσιμο συνεδριών κοιτούν **μόνο** `pending`
(`payment-checkout-store.ts:114,122`). `failed` ⇒ αν η ίδια συνεδρία πληρωθεί αργότερα και χαθεί το webhook, η
πληρωμή **δεν ανακτάται ποτέ**. Πρακτική Stripe: το PaymentIntent μένει ανοιχτό (`requires_payment_method`) με
`last_payment_error`. ⇒ Η συνεδρία μένει `pending` + νέο πεδίο **`lastFailure { reason, at }`**.
(Το `failed` υπάρχει ήδη στο `PAYMENT_CHECKOUT_STATUSES` και το γράφει μόνο το `invoice-payment-checkout.ts:108`
όταν ο πάροχος αρνηθεί την έναρξη — άλλη σημασία, μην το επαναχρησιμοποιήσεις.)

### 2.2 Αλλαγές (λίστα από το audit της 2026-11-12 — επαλήθευσέ τη)

| # | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `src/server/payments/payment-provider.ts` (`WebhookSignal`, γρ. 82) | νέο σήμα `authorization-failed { checkoutId: string \| null; reason }` |
| 2 | `src/server/payments/providers/everypay/everypay-adapter.ts` (`irisSignalOf`, γρ. 146) | σε `error_status`/`error_code` εκπέμπει το νέο σήμα με το `md` (αν υπάρχει) |
| 3 | `src/server/payments/payment-checkout-store.ts` | πεδίο `lastFailure` (ανάγνωση με φρουρό, στο `PaymentCheckoutPatch`) |
| 4 | `src/server/accounting/payments/payment-webhook-handler.ts` | γράφει `lastFailure` **μόνο αν `pending`** — καμία χρέωση, καμία αλλαγή κατάστασης· ιδεμποτικό |
| 5 | `src/app/api/payments/webhooks/[provider]/route.ts` | ο **λόγος** του σήματος στο log «Payment webhook applied» (σήμερα μόνο `signal.kind`) |
| 6 | `src/app/api/shares/[shareId]/invoice-payment/checkout/route.ts` (σήμερα μόνο POST) | `GET ?checkout=pchk_…` ⇒ `{ attempt: 'pending' \| 'failed' \| 'paid' \| 'closed' }`, **μόνο** αν η συνεδρία ανήκει στον ίδιο σύνδεσμο (κουπόνι επίσκεψης όπως η όψη)· γραμμή ορίου ρυθμού (CHECK 3.78) |
| 7 | `src/subapps/accounting/types/online-payment.ts` | τύπος απάντησης (ένας ορισμός client + server) |
| 8 | `src/components/shared/pages/invoice-payment/usePaymentConfirmationWatch.ts` | ρωτά και την έκβαση· κατάσταση «έληξε η αναμονή» πέρα από 15′ (σήμερα το μήνυμα μένει για πάντα) |
| 9 | `src/components/shared/pages/invoice-payment/SharedInvoicePaymentPageContent.tsx` | `failed` ⇒ «Η πληρωμή δεν ολοκληρώθηκε — δοκιμάστε ξανά ή επιλέξτε άλλο τρόπο», σταματά να ρωτά, σβήνει `?payment=` (`history.replaceState`)· 15′ ⇒ ουδέτερο μήνυμα |
| 10 | `src/i18n/locales/{el,en}/accounting-public-payment.json` | νέα κλειδιά `payNow.*` |
| 11 | tests | adapter (σήμα αποτυχίας με/χωρίς `md`), handler (`lastFailure` μόνο σε `pending`), GET (ξένος σύνδεσμος ⇒ άρνηση) — **jest μόνο με έγκριση Giorgio** (ο hook τρέχει τις σουίτες Λογιστικής μόνος του) |
| 12 | ADR-ACC-030 | §5.3 · §5.4 · §5.6 + changelog |

Αρχές που μένουν: η επιστροφή browser **δεν γράφει** (§5.4) · η καταγραφή χρημάτων δεν κοιτά κατάσταση συνεδρίας
(§5.3) · η απάντηση του GET δεν αποκαλύπτει τίποτα πέρα από την έκβαση.

### 2.3 Άγνωστα (έρευνα docs.everypay.gr πριν από κώδικα· αλλιώς «δεν ξέρω»)

- Περιέχει το υπογεγραμμένο JSON της **αποτυχίας** IRIS το `md`; Δεν το αποθηκεύουμε (μόνο αποτύπωμα). Αν όχι ⇒ η
  σελίδα πέφτει στο ουδέτερο μήνυμα των 15′ — θα φανεί στην πρώτη δοκιμή μετά το deploy (το log θα γράφει τον λόγο).
- Μπορεί η **ίδια** συνεδρία IRIS να ξαναδοκιμαστεί στον πάροχο μετά από αποτυχία; (γι' αυτό μένει `pending`.)
- Πώς εμφανίζεται αποτυχία **κάρτας** (hosted σελίδα σε νέα καρτέλα) — εκτός εμβέλειας, μόνο σημείωσε.

## 3. Εκκρεμότητες που περιμένουν απόφαση Giorgio (μην τις υλοποιήσεις χωρίς «ναι»)

Αμετάβλητες: §2.3 κενό συμφιλίωσης + σελιδοποίηση (`listRequest`) · (β) πολιτική επαναλήψεων webhook · §2.4 δημόσια
σελίδα μετά από πλήρη επιστροφή · §2.5 υπόλοιπα σενάρια (διπλό webhook, κάρτα αποτυχίας, μερική πληρωμή, myDATA dev) ·
ανάκληση δοκιμαστικών συνδέσμων · `[WARN] [AUTH_CONTEXT] DENY` (ξανά στα logs) · έγκριση jest του adapter · §5.8 #1
(hex/base64 στο `hash`). Νέα: η ανοιχτή συνεδρία `pending 1` της συμφιλίωσης · το enum του AI αναλυτή
(`document-analyzer.schemas.ts:116`) χωρίς `iris` · `services/sales-accounting/notification-helpers.ts` έχει δικό του
`PAYMENT_METHOD_LABELS` (άλλο λεξιλόγιο πωλήσεων — μόνο ενημέρωση).

## 4. Κανόνες (από τον Giorgio)

- Απαντάς **πάντα στα ελληνικά**.
- **Στο main ΔΕΝ κάνεις commit.** **wt:land και push ΜΟΝΟ με εντολή Giorgio.**
- Κανένα test, scan, jscpd ή tsc χωρίς έγκριση.
- Κανένα κλειδί παρόχου από τον πράκτορα. Κανένα live mode. Μόνο sandbox.
- Εγγραφές δοκιμής στην παραγωγή + πλασματικός ΑΦΜ: εγκεκριμένα. Κάρτες / προσομοιωτής IRIS / dashboard Everypay /
  logs Coolify: ο Giorgio. Τιμολόγια, σύνδεσμοι, Firebase console: εσύ μέσω Chrome.
- Πριν από κώδικα: πραγματικό SSoT audit (`git grep`). Ό,τι δεν ξέρεις: έρευνα σε επίσημες πηγές (docs.everypay.gr).
- Full enterprise + full SSoT, πρακτική Stripe/Adyen — και αν γίνεται, καλύτερη. Καμία έκπτωση ποιότητας.
- Handoff σε δικό του commit, μόνο με το αρχείο του (`git add -- <διαδρομή>`). Ο φάκελος `HANDOFFS/` είναι
  εξαιρεμένος από το git ⇒ τα handoffs αυτής της εργασίας ζουν στο `docs/handoffs/`.
