# HANDOFF — ADR-943 Προκαταβολή ανάθεσης με κράτηση: Φ4β (πληρωμή → κράτηση) → Φ6

**Ημερομηνία:** 2026-11-17 · Προηγούμενο: `2026-11-17_ADR-943_advance-escrow_F4-F6_handoff.md` (η Φ4α ΕΚΛΕΙΣΕ)

## 0. Κανόνες Giorgio (ισχύουν)
- **Worktree:** `C:\Nestor_Worktrees\wt-prune` · **κλαδί:** `agent/wt-prune`. Η νέα συνεδρία συνεχίζει **στο ίδιο worktree** (`EnterWorktree` με `path`), όχι `wt:new`.
- Commit **μόνο** στο `agent/wt-prune`, με ρητή λίστα αρχείων. **Ποτέ** στο `main`. **`wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio** (υπερισχύει του αυτόματου «commit ⇒ land»).
- `tsc` ποτέ (N.17). Καμία πρωτοβουλία εκτός εντολής: πρόταση σε 1 γραμμή και στάση.
- **Tests**: τα στοχευμένα jest (πληρωμές + τομέας ανάθεσης) έχουν εγκριθεί. Για νέα είδη ελέγχων (emulator κανόνων, e2e, audits) **ρώτα**.
- N.14: δήλωσε μοντέλο (Opus) και περίμενε «ok».
- **Οδηγία Giorgio (2026-11-17):** «όπως οι μεγάλοι παίκτες, χωρίς εκπτώσεις· ό,τι δεν ξέρεις ⇒ έρευνα στο διαδίκτυο· κι αν μπορείς, εξυπνότερα από αυτούς». Για ερωτήματα πρακτικής **αποφασίζεις εσύ με έρευνα + πηγές στο ADR**, δεν ρωτάς επιλογές.
- **Πριν από κώδικα: πραγματικό SSoT audit με grep.** Δουλεύεις ο ίδιος — όχι υποπράκτορες.
- Μεγάλο περιεχόμενο ⇒ `Write`/`Edit` (N.19)· εντολή Bash > 6.000 χαρ. μπλοκάρεται. Το worktree-guard αρνείται σύνθετες εντολές με `git` ή `python - <<heredoc` ⇒ script στο scratchpad + απλή εντολή, και `git` σε **ξεχωριστή** απλή εντολή. Commit με `git commit -F`.
- ⚠️ Ο `git grep`/`Grep` σε όλο το `src` μπορεί να κολλήσει (timeout) ⇒ στένευε τη διαδρομή ή `timeout 60 git grep -- <φάκελος>`.

## 1. Διάβασε ΠΡΩΤΑ
1. `docs/centralized-systems/reference/adrs/ADR-943-issuance-advance-escrow.md` — ιδίως **§5.6** (Φ2 πληρωτέο αντικείμενο), **§5.7** (Φ3 marketplace), **§5.8** (Φ4α + αποφάσεις Δ-1…Δ-4), §8 ανοιχτά.
2. `C:\Users\user\.claude\plans\whimsical-inventing-giraffe.md` — εγκεκριμένο σχέδιο (Β · Γ · Δ).
3. `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md` §2–§5 (checkout, webhook, συμφιλίωση).
4. ADR-915 §45.20 (πράξη μηχανικού από τον χώρο — πρότυπο συναλλαγής με συμμετοχή).

## 2. Αποφάσεις — ΜΗΝ ξανασυζητηθούν
- (β) αίτημα πληρωμής, όχι τιμολόγιο · κράτηση σε EveryPay Marketplace · αποδέσμευση στην έναρξη (αυτοψία + 48ω) · πολιτικές `flexible`/`moderate`/`strict` (0/50/100 μετά την έναρξη) · προμήθεια 0.
- **Δ-1** όριο προκαταβολής **50%** του συνόλου (`ADVANCE_POLICY.maxPercentOfTotal`).
- **Δ-2** μεταφορά **κατά την πληρωμή, κρατημένη** (`ensureTransfer({ hold: true })`), όχι κατά την αποδέσμευση (EveryPay: «όχι επ' αόριστον αμεταβίβαστα»).
- **Δ-3** πλαφόν υπαναχώρησης για **κάθε** ιδιοκτήτη (καμία κατάταξη αγοραστή).
- **Δ-4** αξία αυτοψίας υποχρεωτική με προκαταβολή.
- Νόμος: ν.2251/1994 **3ι §3** (αναλογικό ποσό) · **3ι §4 α ii** (τίποτα χωρίς ρητή συγκατάθεση) · **3ιβ (α)** (καμία υπαναχώρηση μετά την πλήρη παροχή με ρητή συγκατάθεση **και αναγνώριση**) ⇒ το checkbox Κ-6 πρέπει να λέει **και** τα δύο: «ζητώ να ξεκινήσει μέσα στις 14 ημέρες» + «αναγνωρίζω ότι χάνω το δικαίωμα υπαναχώρησης όταν η υπηρεσία παρασχεθεί πλήρως».

## 3. Κατάσταση
| Commit | Τι |
|---|---|
| `d732eee4` · `7ff1d1d7` | Φ0 ADR · Φ1 τομέας |
| `389f7474` | Φ2 — checkout με «πληρωτέο αντικείμενο» (`server/payments/payable-subject.ts` · `payable-subject-registry.ts`) |
| `2230b472` | Φ3 — `payment-marketplace.ts` · EveryPay Marketplace adapter · `payment_payees` · `registerMarketplacePayee` (δεν καλείται ακόμη) |
| `22241bc6` | **Φ4α** — όριο 50% · αξία αυτοψίας · `refundDueOnCancelOf(facts, atIso)` με υπαναχώρηση · `cancellationScheduleOf` · πεδία ιστορικού χρημάτων · πεδία προκαταβολής στη φόρμα (`IssuanceAdvanceFields` · `IssuanceAdvanceSchedule` · `issuance-advance-labels.ts`) · ο ιδιοκτήτης βλέπει προκαταβολή + πίνακα ακύρωσης · σφράγιση slice `/document-request` 15282 |

`advanceStateText` (`issuance-advance-labels.ts`) είναι **εξαγόμενη αλλά αχρησιμοποίητη** — τη χρειάζεται η κάρτα της ανάθεσης στο γραφείο / στον χώρο (Φ4β). Αν δεν χρησιμοποιηθεί, θα τη δει το knip (3.22).

## 4. Φ4β — τι υλοποιείς (με τη σειρά)
**SSoT audit πρώτα** (grep): `IssuanceWriter` / `stageIssuanceAction` / `actorOf` (`services/document-registry/issuance-assignments.server.ts`) · `readHostedIssuanceAssignment` + `readDocumentRegistry` (πρότυπο στο `issuance-delivery-change.service.ts` — ετικέτα ακινήτου + `latestIssuedOn`) · `startInvoicePaymentCheckout` (`server/accounting/payments/invoice-payment-checkout.ts`) · `syncCheckoutSettlement` · `handlePaymentSignal` · `readInvoicePaymentAttempt` · `NOTIFICATION_EVENT_TYPES` (`config/notification-events.ts`) · `dispatchNotification` · `registerMarketplacePayee` · `(me)/profile`.

1. **Γραφέας συστήματος**: `IssuanceWriter` + `{ kind: 'system'; source: 'payments' }` (καμία CAS — η δέσμευση είναι η αναφορά του παρόχου, την κρίνει ο μειωτής)· `actorOf` → actor `system`· `performerOf` στο ιστορικό (`provider:everypay`). Το `issuance-assignment.ts` είναι ~493 γρ. — **καμία** νέα λογική εκεί.
2. **Πληρωτέο είδος `issuance-advance`** στο `payable-subject.ts`: `{ kind, companyId, assignmentId }` · στη βάση `subjectKind: 'issuance-advance'` + `assignmentId` · διαδρομή επιστροφής `^/document-request$` (χωρίς διαπιστευτήριο — η σελίδα κρατά τον σύνδεσμο στο `sessionStorage`, `DOCUMENT_REQUEST_STORAGE_KEY`) · `sameAttemptScope` = ίδιο `assignmentId` · `attemptScopeDocsOf` = ρητό `where('assignmentId','==',…)` (+ `companyId` για CHECK 3.10/3.35· έλεγξε δείκτη 3.15/3.91). Handler στο μητρώο ⇒ `advance-funded` μέσω του γραφέα συστήματος (ποσό = κίνηση `payment`· `withdrawalWaiverAt` από τη **συνεδρία**). Η κίνηση `refund` ⇒ `advance-refunded`. Ο compiler δείχνει κάθε κενό (εξαντλητικά `switch`/πίνακες).
3. **`split=1`**: πεδίο `split: boolean` στο `CheckoutRequest` και στη συνεδρία· κάρτα `POST /notifications split=1` · IRIS `POST /payments split=1` στο `captureSource` (split με IRIS = §8 #2, ανεπαλήθευτο — γράψ' το).
4. **Έναρξη πληρωμής προκαταβολής**: νέα πόρτα `POST /api/issuance-link/advance-checkout` (Bearer σύνδεσμος του **υπευθύνου**, `Idempotency-Key`, CHECK 3.92) — προϋποθέσεις: `advanceStateOf` = `awaiting-payment` · δικαιούχος του μηχανικού `authorized` (`readPayee` από API) · `marketplace !== null` · checkbox Κ-6 (στιγμή ⇒ `withdrawalWaiverAt` στη συνεδρία). Ποσό **από τον διακομιστή**. Έκβαση απόπειρας για τη σελίδα (πρότυπο `readInvoicePaymentAttempt`).
5. **Κράτηση μετά την είσπραξη**: μετά το `advance-funded` ⇒ `ensureTransfer({ paymentReference, payeeReference, amountMinor, commissionMinor: 0, hold: true })`. **Σειριοποίηση με lease** στο έγγραφο της ανάθεσης (οι δηλωτικές πράξεις δεν προστατεύουν από ταυτόχρονους καλούντες: webhook + cron + επιστροφή browser). Η αναφορά της μεταφοράς γράφεται στην εγγραφή (νέο πεδίο ή γεγονός — αποφάσισε με τον τομέα).
6. **UI σελίδας έγκρισης**: μετά το «Εγκρίνω» με προκαταβολή ⇒ βήμα «Πληρωμή προκαταβολής» (κάρτα/IRIS) με το checkbox Κ-6 (§2) · επιστροφή από τον πάροχο ⇒ «σε κράτηση». Email με σύνδεσμο πληρωμής.
7. **«Λήψη πληρωμών» (KYC)** στο `(me)/profile` → route που καλεί `registerMarketplacePayee`· άνοιγμα `kycProcessUrl` του παρόχου· κατάσταση από το API. Χωρίς `authorized` ο μηχανικός δεν μπορεί να ζητήσει προκαταβολή (ή η πληρωμή περιμένει — αποφάσισε με έρευνα: Airbnb/Upwork απαιτούν payout method πριν).
8. **Ειδοποιήσεις**: `…_ADVANCE_FUNDED` (μηχανικός: «μπορείτε να ξεκινήσετε») · `…_PAYEE_KYC` κ.λπ. μέσω `dispatchNotification`· κλειδιά el+en (N.11, CHECK 3.8).
9. **ADR-943 §5.9 + changelog · ACC-030 changelog** στο ίδιο commit. Ξαναγέννα `generate-i18n-types.js` / `generate-i18n-shell-slice.js` (σφράγιση με `why` αν μεγαλώσει διαδρομή).

## 5. Μετά
- **Φ5** «έγινε η αυτοψία» (`EngagedIssuanceContent`) · αντίρρηση 48ω · cron αυτόματης αποδέσμευσης + ανάγνωση μεταφορών · ακύρωση με `reconcileTransferReversal` / `reconcilePaymentRefund` κατά `refundDueOnCancelOf` · ΜΑΡΚ προκαταβολής.
- **Φ6** sandbox (Giorgio ζητά από την EveryPay ενεργοποίηση Marketplace) — κλείνουν §8 #1–#4, #9.

## 6. Μην κάνεις
- Commit στο `main` · `wt:land` · push χωρίς εντολή.
- Μην αγγίξεις τον φάκελο αρχείων της κατοικίας / μοίρασμα (άλλος πράκτορας) ούτε το `C:\Nestor_Worktrees\adr-915-f6c-review-fixes`.
- Μην ισχυριστείς νομικό/φορολογικό κανόνα χωρίς πηγή· μην μαντέψεις συμπεριφορά του EveryPay — γράψ' τη στα ανοιχτά §8.
