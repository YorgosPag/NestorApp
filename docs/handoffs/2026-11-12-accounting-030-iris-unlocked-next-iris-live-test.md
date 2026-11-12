# Handoff — ADR-ACC-030 «Πληρωμή τώρα»: IRIS ξεκλειδώθηκε ⇒ επόμενο η ζωντανή δοκιμή IRIS

**Ημερομηνία:** 2026-11-12
**Worktree:** `C:\Nestor_Worktrees\accounting-next`
**Κλαδί:** `agent/accounting-next`
**ADR:** `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md`
**Προηγούμενο handoff:** `docs/handoffs/2026-11-12-accounting-030-refund-fix-live-next-verify.md`

## 1. Κατάσταση

- ✅ **§5.9 #6, η διόρθωση επιστροφών, επαληθεύτηκε ζωντανά** στο live `b12482e`. Η καταγραφή είναι στο ADR §5.9 #6 και στο changelog, commit `5e237f9d`.
  - Δοκιμή: επιστροφή 1,00 € στο Α-11. Το webhook καταγράφηκε `recorded`.
  - Ανακτήθηκαν και τα 5,00 € της παλιάς επιστροφής, που είχε χαθεί.
  - Αποτέλεσμα στο Α-11: υπόλοιπο 6,00 €, κατάσταση `partial`, ίχνος `PAYMENT_REFUNDED` ×2. Η δημόσια σελίδα δείχνει «Προς πληρωμή 6,00 €».
  - Απαντήθηκε και το (β): το `amount` της πληρωμής στο API **δεν** μειώνεται μετά από επιστροφή.
- Commits στο κλαδί **χωρίς land**: `1d259b97` (handoff), `5e237f9d` (ADR) και το commit αυτού του handoff. **wt:land και push γίνονται ΜΟΝΟ με εντολή Giorgio.**
- 📧 **Η Everypay απάντησε** στις 12/11 17:35, στο αίτημα **00128279**, νήμα Gmail «Ενεργοποίηση IRIS / Apple Pay / Google Pay στον λογαριασμό sandbox».
  - Η απάντηση λέει: «Έχουν ενεργοποιηθεί οι κάτωθι υπηρεσίες για το sandbox account σας.»
  - ⚠️ Δεν αναφέρει **ποιες**. Ζητήθηκαν τρεις: (1) IRIS Direct (`POST /iris/sessions`, που απαντούσε «Invalid account setup»), (2) κάρτα μέσω Payment Notifications, (3) Apple Pay / Google Pay.
  - Θα φανεί **μόνο με δοκιμή**.

## 2. Επόμενο βήμα (εγκεκριμένο από Giorgio: «ΝΑΙ ΞΕΚΙΝΑ»): ζωντανή δοκιμή IRIS

Ο κανόνας ισχύει: **πρώτα διαβάζεις τον κώδικα και λες στον Giorgio τι αναμένεται, μετά δοκιμή.**

1. **Διάβασε τη ροή IRIS:**
   - `src/server/payments/providers/everypay/everypay-adapter.ts`:
     - γρ. ~83: `POST /iris/sessions`, φόρμα POST στο payform `/api/payment-methods/iris`
     - γρ. ~146: `irisSignalOf`
     - γρ. ~166: `hash` του IRIS
     - `readIrisSettlement`
     - `captureAuthorizedSource`
   - `src/server/payments/providers/everypay/everypay-signature.ts`: `judgeEverypayIrisHash`. ⚠️ Η τεκμηρίωση δεν λέει αν η υπογραφή είναι hex ή base64, γι' αυτό δεχόμαστε και τα δύο.
   - `src/server/payments/providers/everypay/everypay-client.ts`: κωδικός «token ήδη χρησιμοποιημένο».
   - `src/server/accounting/payments/payment-webhook-handler.ts`: σήμα `authorized-source`, δηλαδή **εμείς** χρεώνουμε και μετά συγχρονίζουμε.
   - `src/server/accounting/payments/payment-reconcile.service.ts`: `IRIS_ABANDON_AFTER_MS` 24h.
   - ADR-ACC-030, οι ενότητες για IRIS.
   - Επίσημη πηγή: https://docs.everypay.gr/other-payment-methods/iris-direct/
2. **Πες στον Giorgio τι αναμένεται:** τη συνεδρία, την επιλογή τράπεζας / QR, το callback και webhook, το capture, την καταγραφή, την κατάσταση του τιμολογίου και το ίχνος.
3. **Ετοίμασε τη δοκιμή μέσω Chrome:** νέο δοκιμαστικό τιμολόγιο για τον πελάτη «ΔΟΚΙΜΗ Everypay sandbox» στην εταιρεία `comp_9c7c1a50…`, και σύνδεσμο πληρωμής.
4. **Ο Giorgio πληρώνει με IRIS.** Αν ξαναβγεί «Invalid account setup», το IRIS **δεν** ενεργοποιήθηκε και ξαναγράφουμε στην Everypay.
5. **Επαλήθευση:**
   - Firestore: `payment_provider_events`, το τιμολόγιο (`payments[]`, `balanceDue`, `paymentStatus`), το ίχνος `PAYMENT_RECORDED`, η συνεδρία `paid`.
   - Logs Coolify: τα διαβάζει ο Giorgio.
   - Η δημόσια σελίδα του συνδέσμου.
6. **Καταγραφή στο ADR-ACC-030** + changelog, σε commit στο κλαδί.
7. **Apple Pay / Google Pay:** τα δοκιμάζει ο Giorgio από κινητό με πραγματικό πορτοφόλι.

## 3. Εκκρεμότητες που περιμένουν απόφαση Giorgio (μην τις υλοποιήσεις χωρίς «ναι»)

- **§2.3, κενό συμφιλίωσης.** Το cron `payment-reconcile` εξετάζει μόνο `pending` συνεδρίες, άρα μια επιστροφή με χαμένο webhook δεν ανακτάται ποτέ. Η πρόταση έχει δοθεί, η απόφαση εκκρεμεί:
  - **(α) Να γίνουν όλα ή μόνο το 1;** Τα τέσσερα σημεία της πρότασης:
    1. Σελιδοποίηση (`count=20` + `offset` μέχρι το `total_count`) στο `listRequest` του `everypay-adapter.ts`. 🔴 **Πραγματική βλάβη:** το `settledMovements` καλεί `GET /refunds?payment=` χωρίς σελιδοποίηση και διαβάζει μόνο την 1η σελίδα. Το ίδιο κάνει και το `GET /payments?merchant_ref=`.
    2. Πέρασμα στο cron: `GET /refunds?date_from=<σήμερα−2>` ⇒ `findPaymentCheckoutBy('paymentReference')` ⇒ `syncCheckoutSettlement`, ιδεμποτικά.
    3. Ταξινόμηση των κινήσεων κατά `occurredAt` πριν την καταγραφή. Σήμερα το ίχνος ακολουθεί τη σειρά του παρόχου, νεότερα πρώτα.
    4. Νέα μέθοδος στη διεπαφή `PaymentProvider`, π.χ. `listRecentRefundPaymentReferences(since)`.
  - **(β)** Να ρωτηθεί η Everypay για την **πολιτική επαναλήψεων webhook**. Δεν τεκμηριώνεται, δεν έχει ρωτηθεί ακόμη, και το ADR §5.3 την υποθέτει ανεπαλήθευτα.
- **§2.4:** τι δείχνει η δημόσια σελίδα μετά από **πλήρη** επιστροφή. Χρειάζεται έρευνα πρακτικής: το Stripe κρατά το τιμολόγιο `paid` και εκδίδει πιστωτικό.
- **§2.5, υπόλοιπα σενάρια:**
  - διπλό webhook: επαναποστολή μόνο αν την προσφέρει το dashboard, **ποτέ** πλαστό;
  - κάρτα αποτυχίας `4853451426120387` σε νέο τιμολόγιο;
  - μερική πληρωμή: **ρώτα πρώτα**;
  - μετά, myDATA dev.
- **Ερωτήσεις χωρίς απάντηση:**
  - Ανάκληση του δοκιμαστικού συνδέσμου «Δοκιμή επιστροφής Α-11»;
  - Διερεύνηση του `[WARN] [AUTH_CONTEXT] DENY` που εμφανίστηκε αμέσως μετά το webhook;
  - Έγκριση για `npx jest src/server/payments/providers/everypay/__tests__/everypay-adapter.test.ts`;
- **Άσχετο με εμάς:** το deploy `95dd26b` (ADR-929 OCR) είναι από το `agent/raster-plan-recognition`. Η επαλήθευσή του ανήκει σε εκείνη τη συνεδρία.

## 4. Κανόνες (από τον Giorgio)

- Απαντάς **πάντα στα ελληνικά**.
- **Στο main ΔΕΝ κάνεις commit.** Τα **wt:land και push γίνονται ΜΟΝΟ με εντολή Giorgio.**
- Κανένα test, scan, jscpd ή tsc χωρίς έγκριση.
- Κανένα κλειδί παρόχου από τον πράκτορα. Κανένα live mode. Μόνο sandbox.
- Εγγραφές δοκιμής στην παραγωγή είναι εγκεκριμένες.
- **Μοιρασιά εργασιών:**
  - Κάρτες και dashboard της Everypay: ο Giorgio, που σου στέλνει screenshots.
  - Τιμολόγια, σύνδεσμοι και Firebase console: εσύ, μέσω Chrome.
- Πριν από κώδικα: πραγματικό SSoT audit (`git grep`). Ό,τι δεν ξέρεις σίγουρα το ψάχνεις σε επίσημες πηγές (docs.everypay.gr).
- Ποιότητα full enterprise και full SSoT, με την πρακτική των μεγάλων παικτών.
- Το handoff μπαίνει σε δικό του commit, μόνο με το δικό του αρχείο.
