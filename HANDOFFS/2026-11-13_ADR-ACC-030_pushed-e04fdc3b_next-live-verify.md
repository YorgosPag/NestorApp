# Handoff — ADR-ACC-030: push `e04fdc3b` σε εξέλιξη → ζωντανή επαλήθευση, μετά ενέργειες με τον Giorgio

**Ημερομηνία:** 2026-11-13
**Worktree:** `C:\Nestor_Worktrees\accounting-next` · **Κλαδί:** `agent/accounting-next` (η νέα συνεδρία συνεχίζει **στο ίδιο** worktree)
**ADR:** `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md` (§5.5 · §5.6 · §5.8 #1/#6/#7/#8)
**Προηγούμενο handoff:** `docs/handoffs/2026-11-13-accounting-030-pending-closed-live-next-user-actions.md`

## 1. Κατάσταση

✅ **Push έγινε** (`c18226b9..e04fdc3b`, 2026-11-13) — το deploy στο Netcup **τρέχει**. Ο Giorgio θα στείλει μήνυμα όταν
τελειώσει. Ανέβηκαν και 9 commits άλλων πρακτόρων (ADR-923 / 929 / 939 / 816) που ήταν ήδη στο τοπικό `main`.

Δικά μας σε αυτό το push:

| Commit | Τι | ADR |
|---|---|---|
| `3f245ec0` | Η σελίδα πληρωμής περιμένει ως τη **λήξη της συνεδρίας του παρόχου** + 1′, όχι σταθερά 15′. Ο server δίνει `expiresInMs` (σχετικό, ρολόι server — πρότυπο Stripe `expires_at`) στο `GET …/checkout?checkout=pchk_…`· χωρίς απάντηση ⇒ 15′ | §5.5 · §5.6 |
| `38d81aa9` | Καταγραφή email προς Everypay (Apple Pay / Google Pay + πολιτική επαναλήψεων webhook) | §5.8 #7 · #8 |

Αρχεία του `3f245ec0`: `src/subapps/accounting/types/online-payment.ts` (`InvoiceCheckoutAttemptResponse.expiresInMs`) ·
`src/server/accounting/payments/invoice-payment-attempt.ts` (`attemptExpiresInMs`) ·
`src/app/api/shares/[shareId]/invoice-payment/checkout/route.ts` (`nowMs: Date.now()`) ·
`src/components/shared/pages/invoice-payment/usePaymentConfirmationWatch.ts` (`deadlineAfter`, `SETTLEMENT_GRACE_MS`,
`UNANSWERED_GIVE_UP_MS`) + tests.

Κλειστά νωρίτερα σήμερα (live): ανάκληση 10 δοκιμαστικών συνδέσμων · log ωμού `expiration_date`
(«Checkout started at provider», `startedCheckoutDiagnostics`) ⇒ **IRIS sandbox = 35′, ζώνη ώρας σωστή** (skew −1 s).

## 2. Επόμενο βήμα — ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ (μόλις ο Giorgio πει ότι τελείωσε το deploy)

1. Επιβεβαίωσε ότι το live τρέχει `e04fdc3b` (ό,τι δείχνει η σελίδα έκδοσης / το μήνυμα του Giorgio).
2. Νέα απόπειρα **IRIS** σε δοκιμαστικό τιμολόγιο (sandbox· εγγραφές δοκιμής στην παραγωγή εγκεκριμένες), **χωρίς** να
   ολοκληρωθεί η πληρωμή. Στο DevTools/Network της σελίδας `/shared/<token>?payment=pchk_…`:
   - το `GET /api/shares/<shareId>/invoice-payment/checkout?checkout=pchk_…` επιστρέφει `{status:'ok', attempt:'pending', expiresInMs:≈2_100_000}` και το `expiresInMs` **μειώνεται** ανά γύρο·
   - ρυθμός: 3″ το πρώτο λεπτό, μετά 15″·
   - μετά τα **15′** η σελίδα **συνεχίζει** να ρωτά (πριν: «timed-out» στα 15′)· `timed-out` μόνο ≈ λήξη + 1′ (~36′).
   Για να μη χρειαστούν 36′ ζωντανά: αρκεί να φανεί ότι στο 16ο λεπτό ακόμη ρωτά — ρώτα τον Giorgio αν θέλει το πλήρες.
3. Ανάκληση του δοκιμαστικού συνδέσμου που θα φτιαχτεί (διάλογος «Σύνδεσμος πληρωμής» → Ανάκληση).
4. Αν όλα σωστά ⇒ πρότεινε (μην κάνεις χωρίς «ναι») σημείωση «επαληθεύτηκε ζωντανά» στο ADR §5.6 + changelog.

## 3. Μετά — ενέργειες με τον Giorgio (από το προηγούμενο handoff, ανοιχτές)

1. **Logs Coolify** (ο Giorgio): σύνοψη cron με `refunds checked …` · απουσία `WARN DENY` στα webhooks.
2. **Μία IRIS ως το τέλος** ⇒ `signatureScheme` στο `payment_provider_events` ⇒ στένεμα του `matchingIrisScheme`
   (`everypay-signature.ts`) στη μία μορφή + ADR §5.8 #1.
3. **§2.5 σενάρια**: διπλό webhook (μόνο με επαναποστολή από dashboard — ποτέ πλαστό) · κάρτα αποτυχίας
   `4853451426120387` · μερική πληρωμή (**απόφαση πρώτα**) · myDATA dev.
4. **Απάντηση Everypay** (Gmail thread `1a1d4b10d6f17741`, προς info@everypay.gr): μετά ⇒ δοκιμή «Κάρτα» σε Chrome
   (Google Pay) και Safari/iPhone (Apple Pay) · κλείσιμο §5.8 #7 και #8. Ο κώδικας **δεν** χρειάζεται αλλαγή για τα
   πορτοφόλια (είναι `card`, τα δείχνει η hosted σελίδα).
5. Προαιρετικά (προτάθηκαν, **όχι** εγκεκριμένα): fake-timer test για `usePaymentConfirmationWatch` · έλεγχος κωδικού
   IRIS στο myDATA v1.0.12 και απαίτησης tid/υπογραφής παρόχου e-POS.

## 4. Κανόνες (από τον Giorgio)

- Πάντα ελληνικά. Στο `main` **κανένα** commit. Commit **μόνο** στο `agent/accounting-next` με ρητή λίστα αρχείων.
  **wt:land και push ΜΟΝΟ με εντολή Giorgio.**
- Πριν από κώδικα: πραγματικό SSoT audit (`git grep`) + επίσημες πηγές (docs.everypay.gr). Πρακτική Stripe/Adyen,
  full enterprise + full SSoT, χωρίς εκπτώσεις· αν δεν είσαι σίγουρος ⇒ έρευνα στο διαδίκτυο.
- Tests: μόνο με έγκριση (στοχευμένα jest). Ποτέ tsc / scans / jscpd χωρίς έγκριση.
- Μόνο sandbox Everypay — κανένα κλειδί παρόχου, κανένα live mode.
- Bash < 6.000 χαρακτήρες (N.19)· `cd` + `git` σε απλές εντολές.
- Firebase console: για `accounting_payment_checkouts` χρησιμοποίησε **Query Builder** (η προβολή πίνακα αποτυγχάνει).
- Φρένο βαριών εργασιών: `C:\Users\user\.claude\heavy-task.lock` — αν υπάρχει (< 20′), περίμενε πριν από jest.
