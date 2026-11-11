# HANDOFF — 2026-11-11 — Λογιστική: ADR-ACC-030 «Πληρωμή τώρα» — ζωντανή επαλήθευση sandbox ΣΕ ΕΞΕΛΙΞΗ

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Διάβασε πρώτα αυτό + ADR-ACC-030 (§5.8, **§5.9**).

## Κανόνες (ισχύουν ακέραιοι)
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς έγκριση (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί με ρητή λίστα αρχείων.
- Κανένα κλειδί/διαπιστευτήριο παρόχου από τον πράκτορα (τα έβαλε ο Giorgio). Κανένα live mode.
- **Αριθμούς κάρτας (ακόμη και δοκιμαστικούς) πληκτρολογεί ο Giorgio**, όχι ο πράκτορας (η σελίδα είναι παραγωγή).
- Εγγραφές δοκιμής στην παραγωγή: **εγκεκριμένες ελεύθερα** (Giorgio: «δοκιμαστική περίοδος»).
- Πριν από κάθε κώδικα: πραγματικό SSoT audit (grep). Ό,τι δεν ξέρεις σίγουρα: επίσημες πηγές (docs.everypay.gr).
- Ισχύουν τα §ΜΗΝ του `2026-11-11-accounting-030-pay-now-landed-next-live-sandbox-verification.md`.

## 1. Κατάσταση
- `main` = **`4fede2ac`** — land (squash) + **push έγινε** με εντολή Giorgio (11/11). Περιέχει: fix `expiration_date` σε μορφή Everypay (`everypayDateTime()` στο `everypay-client.ts`, UTC `+0000`) + ADR §5.9 (ευρήματα 1–2, αίτημα 00128279). Firebase κανόνες + δείκτες **ανεπτυγμένα** (run 43039664994).
- ⏳ **Η ανάπτυξη του push (Netcup) έτρεχε στο κλείσιμο της συνεδρίας.** Ο Giorgio θα ενημερώσει όταν ολοκληρωθεί — **μην ξεκινήσεις τη δοκιμή κάρτας πριν από αυτό.**
- **Ρύθμιση (έγινε από Giorgio, επαληθευμένη):**
  - Λογαριασμός sandbox Everypay (`sandbox-dashboard.everypay.gr`, ΑΦΜ Giorgio).
  - Coolify (Runtime μόνο): `EVERYPAY_SECRET_KEY` (= «Ιδιωτικό Κλειδί») · `EVERYPAY_PUBLIC_KEY` · `PAYMENTS_PROVIDER_MODE=sandbox`. Restart έγινε.
  - Απόδειξη: πλαστό webhook ⇒ `401 signature-invalid` (πριν `503 provider-not-configured`).
  - Webhook (ένα, ενεργό) → `https://nestorconstruct.gr/api/payments/webhooks/everypay` με: Νέα Πληρωμή (Card) · Επιστροφή ποσού (Card) · Νέα Πληρωμή (IRIS) · paymentNotificationPaid · paymentNotificationExpired.
- **Δοκιμαστικό τιμολόγιο**: **Α-10** (`inv_31583e65-6da4-4b68-84c7-835d5fdb3964`), «ΔΟΚΙΜΗ Everypay sandbox», 10,00 € + 24% = **12,40 €**, τραπεζική μεταφορά, πρόχειρο (myDATA δεν συνδέεται — καμία κλήση SendInvoices στον κώδικα).
  - Σύνδεσμος: `https://nestorconstruct.gr/shared/VHLSsIQ1ac8Ro4uJNo603-gkDup7OGTvtYINZRsfPZs`
  - Η σελίδα δείχνει σωστά «Πληρωμή τώρα» (Κάρτα · IRIS · Τραπεζική μεταφορά).

## 2. Ευρήματα (λεπτομέρειες: ADR-ACC-030 §5.9)
1. 🔧 Κάρτα: `POST /notifications` ⇒ «Invalid expiration date» (στέλναμε `….123Z`). Διορθώθηκε (στο `main` `4fede2ac`). **Δεν έχει επαληθευτεί** ότι η Everypay δέχεται `+0000` (το παράδειγμά της: `+0300`).
2. ⏳ IRIS: «Invalid account setup. Please contact customer support» = ρύθμιση λογαριασμού, όχι κώδικας. Ο Giorgio έστειλε email στο `support@everypay.gr` (11/11) για ενεργοποίηση IRIS · κάρτας (Payment Notifications) · Apple/Google Pay. Αίτημα **00128279** (παραλαβή επιβεβαιώθηκε 11/11). Αναμονή.

## 3. ΕΠΟΜΕΝΟ
1. Περίμενε τον Giorgio να πει ότι ολοκληρώθηκε η ανάπτυξη. Επιβεβαίωσε ότι το live commit περιέχει το `4fede2ac` (`git merge-base --is-ancestor 4fede2ac <live>`).
2. **Κάρτα** (Giorgio πληκτρολογεί): σύνδεσμος Α-10 → Κάρτα → «Πληρωμή 12,40 €» → δοκιμαστική Visa επιτυχίας `4556390755719395` (docs.everypay.gr/tools/test-cases/), λήξη μελλοντική, CVV τυχαίο.
   - Αναμενόμενο: σελίδα ⇒ «Εξοφλήθηκε» · στο Α-10 `payments[]` + υπόλοιπο 0 + `PAYMENT_RECORDED` στο ίχνος.
   - Αν «Invalid expiration date» ξανά ⇒ δοκίμασε ζώνη `+0300`/Europe/Athens στο `everypayDateTime()` (μόνο adapter) — έρευνα στο API reference πρώτα.
   - Αν υπάρξει σφάλμα: ο Giorgio στέλνει το μήνυμα Telegram «🚨 InvoicePaymentCheckout» (πεδίο `error`).
3. Υπόλοιπα σενάρια (handoff §3 προηγούμενου): διπλό webhook ⇒ μία κίνηση · πλαστή υπογραφή ⇒ 401 (✅ ήδη) · επιστροφή από dashboard ⇒ `PAYMENT_REFUNDED` · cron συμφιλίωσης · μερική πληρωμή · κάρτα αποτυχίας `4853451426120387` (insufficient funds).
4. **IRIS** όταν απαντήσει η Everypay. Ανοιχτά §5.8 (μορφή webhook, `hash` IRIS, λίστες, επιστροφή hosted σελίδας) — κάθε απόκλιση ⇒ μόνο adapter.
5. Μετά: **δοκιμαστικό myDATA** (ΑΑΔΕ dev περιβάλλον, ADR-ACC-003) — ο Giorgio είπε ΝΑΙ. Επιβεβαίωσε URLs από επίσημη τεκμηρίωση ΑΑΔΕ.

## 4. Προτάσεις προς απόφαση (όχι εντολή)
- **Κλειδιά ανά εταιρεία πριν από live** (σήμερα ένας έμπορος για όλες τις εταιρείες ⇒ στο live τα χρήματα της Β θα πήγαιναν στην Α). Ο Giorgio δεν έχει απαντήσει στο να καταγραφεί ως προϋπόθεση live στο ADR.
- Όροι Everypay: στο live απαιτούν λογότυπο + ενημερωτικό κείμενο Everypay στον ιστότοπο εμπόρου (ΙΙΙ.Α.4γ) — σύγκρουση με «κανένα λογότυπο» (εκείνο αφορούσε τράπεζες). Απόφαση στο live.

## 5. Δεν έτρεξαν
- Τα tests του προηγούμενου handoff §4 (δεν ζητήθηκε έγκριση). Το pre-commit hook έτρεξε μόνο του τη ζώνη Accounting (101 σουίτες ✅) στο commit του fix.
