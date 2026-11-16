# HANDOFF — ADR-943 Προκαταβολή ανάθεσης με κράτηση: Φ2 → Φ6

**Ημερομηνία:** 2026-11-16 · Προηγούμενο: `2026-11-16_engineer-advance-payment_handoff.md` (Φ0+Φ1 ΚΛΕΙΣΤΑ)

## 0. Κανόνες Giorgio (ισχύουν)
- **Worktree:** `C:\Nestor_Worktrees\wt-prune` · **κλαδί:** `agent/wt-prune` (όνομα ιστορικό). Η νέα συνεδρία συνεχίζει **στο ίδιο worktree** (`EnterWorktree` με `path`), όχι `wt:new`.
- Commit **μόνο** στο `agent/wt-prune`, με ρητή λίστα αρχείων. **Ποτέ** στο `main`. **`wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio** (υπερισχύει του αυτόματου «commit ⇒ land»).
- Tests/audits μόνο με έγκριση· `tsc` ποτέ (N.17). Καμία πρωτοβουλία εκτός εντολής: πρόταση σε 1 γραμμή και στάση.
- N.14: δήλωσε μοντέλο (Opus) και περίμενε «ok».
- Ποιότητα μεγάλων παικτών χωρίς εκπτώσεις· ό,τι δεν ξέρεις ⇒ έρευνα στο διαδίκτυο. **Πριν από κώδικα: πραγματικό SSoT audit με grep.**
- Μεγάλο περιεχόμενο αρχείου/μηνύματος commit ⇒ `Write` (N.19), commit με `git commit -F`.
- ⚠️ Το hook έπεσε μία φορά με `Segmentation fault` (node, `run-checks-parallel.js`) — η επανάληψη πέρασε. Αν ξανασυμβεί: επανάληψη μία φορά, μετά αναφορά.

## 1. Διάβασε ΠΡΩΤΑ
1. `docs/centralized-systems/reference/adrs/ADR-943-issuance-advance-escrow.md` — **ολόκληρο** (έρευνα, Κ-1…Κ-8, σχέδιο §5, Φ1 §5.5, ανοιχτά §8).
2. `C:\Users\user\.claude\plans\whimsical-inventing-giraffe.md` — το εγκεκριμένο σχέδιο (αρχιτεκτονική Α/Β/Γ/Δ, φάσεις).
3. `src/subapps/accounting/docs/adrs/ADR-ACC-030-online-invoice-payments.md` §2–§5 (port, checkout, webhook, συμφιλίωση).
4. ADR-915 §42 (προσφορά) · §45.20 (πράξη μηχανικού από τον χώρο — πρότυπο για `start-work`).

## 2. Αποφάσεις Giorgio (2026-11-16) — ΜΗΝ ξανασυζητηθούν
- **(β)**: αίτημα πληρωμής, όχι τιμολόγιο εκ των προτέρων (ΚΦΑ 16 §2β). Παραστατικό με την είσπραξη, συμψηφισμός στο τελικό.
- Κράτηση σε **EveryPay Marketplace** (PSD2: ποτέ χρήματα τρίτου στον λογαριασμό εμπόρου της πλατφόρμας).
- Αποδέσμευση **στην έναρξη**: «έγινε η αυτοψία» ⇒ **48ω** αντίρρησης ⇒ αυτόματα.
- **Τυποποιημένες πολιτικές** `flexible`/`moderate`/`strict`· πριν την έναρξη πάντα πλήρης επιστροφή.
- **Προμήθεια 0** (ρύθμιση `commission_amount`, όχι κώδικας).
- Plan Mode (όχι Orchestrator).

## 3. Κατάσταση
| Commit | Τι |
|---|---|
| `d732eee4` | Φ0 — ADR-943, δείκτης ADR-915 §46, changelog ACC-030, adr-index |
| `7ff1d1d7` | Φ1 — τομέας: `src/lib/document-validity/issuance-advance.ts` (όροι, πολιτικές, `AdvanceEvent`, **`advanceStateOf`**, `refundDueOnCancelOf`, `advanceCollectedMinor`, `isAdvanceReleaseDue`, `canObjectToStart`) · `issuance-advance-reducer.ts` (`reduceIssuanceAdvance`, actor ανά πράξη, ιδεμποτία από αναφορά) · actor **`system`** στο `issuance-actor.ts` · `advanceEvents`/`advanceReceipt` στην εγγραφή + σχήματα με defaults · `QuoteTerms.advance` · τελικός ΜΑΡΚ = σύνολο − εισπραχθέν. Jest 21 σουίτες 386/386. |

- Απόκλιση: `advanceReceipt` (δεύτερη ονομασμένη θέση) αντί για `receipts[]` — τεκμηριωμένη στο ADR §5.5.
- ⚠️ **Εκκρεμεί επιβεβαίωση Giorgio**: παρακράτηση μετά την έναρξη 0% / 50% / 100% (`RETAINED_AFTER_START_PERCENT`).
- `issuance-assignment.ts` = **493 γρ.** (όριο 500) — **καμία** νέα λογική εκεί· σε νέα αρχεία.

## 4. Επόμενο βήμα — Φ2: γενίκευση checkout σε «πληρωτέο αντικείμενο» (χωρίς marketplace)
Στόχος: η πληρωμή τιμολογίου **αμετάβλητη στη συμπεριφορά**, και το checkout να δέχεται δεύτερο είδος.
- `src/server/payments/payment-checkout-store.ts`: `invoiceId/shareId` → `subject: {kind:'invoice', invoiceId, shareId} | {kind:'issuance-advance', companyId, assignmentId}`· παλιά έγγραφα διαβάζονται ως `invoice` (καμία μετάπτωση).
- **νέο** `src/server/payments/payable-subjects.ts`: μητρώο handler ανά `kind` (καταγραφή κίνησης · επιτρεπτό return path · εκκρεμείς συνεδρίες).
- `invoice-payment-settlement-sync.ts` · `payment-webhook-handler.ts` · `payment-reconcile.service.ts` · `payment-return-cookie.ts` (`SHARED_PAGE_PATH` σκληρό) ρωτούν το μητρώο αντί για `recordInvoicePayment` απευθείας.
- Πριν από κώδικα: grep όλων των αναγνωστών `invoiceId`/`shareId` του checkout και `listPendingCheckoutsOfShare`.
- Υπάρχουσες σουίτες ACC-030 (`invoice-payment-attempt`, `payment-refund-reconcile`, `everypay-*`, `payment-checkout-store-failure`) πρέπει να μείνουν πράσινες (τρέξιμο **με έγκριση**).
- ADR-943 changelog + §5.x «Φ2 υλοποίηση» + ACC-030 changelog στο ίδιο commit.

## 5. Μετά
- **Φ3** marketplace port (`PaymentProvider.marketplace?`: payee/KYC · split · held transfer · release · reversal · refund) + `providers/everypay/everypay-marketplace.ts` + συλλογή `payment_payees` (deny-all, σουίτα κανόνων CHECK 3.16) + νέα prefixes στο `enterprise-id-prefixes.ts` (N.6) + webhook `SELLER_KYC.STATUS`.
- **Φ4** προσφορά (πεδία προκαταβολής/πολιτικής στο `IssuanceQuoteFields`, `issuance-link-view.ts`) → έγκριση → πληρωμή (σελίδα έγκρισης + email, checkbox υπαναχώρησης Κ-6, προϋπόθεση KYC μηχανικού) → κράτηση· γραφέας server με actor `system` (`issuance-assignments.server.ts`: `IssuanceWriter` + `performedBy`)· πεδία ίχνους ADR-195· ειδοποιήσεις· i18n el+en.
- **Φ5** «έγινε η αυτοψία» στον χώρο (`EngagedIssuanceContent`) · αντίρρηση · cron αυτόματης αποδέσμευσης · ακύρωση με refund/reversal κατά πολιτική · ΜΑΡΚ προκαταβολής από τον μηχανικό.
- **Φ6** ζωντανή επαλήθευση sandbox — Giorgio ζητά από την EveryPay ενεργοποίηση Marketplace στο sandbox.

## 6. Ανοιχτά (ADR-943 §8)
Merchant of record · split με IRIS · webhooks transfer/payout · refund με κρατημένο transfer · τύπος myDATA προκαταβολής (λογιστής) · ν.2251/1994 άρθρο 3ε.

## 7. Μην κάνεις
- Commit στο `main` · `wt:land` · push χωρίς εντολή.
- Μην αγγίξεις τον φάκελο αρχείων της κατοικίας / μοίρασμα (άλλος πράκτορας) ούτε το `C:\Nestor_Worktrees\adr-915-f6c-review-fixes`.
- Μην ισχυριστείς νομικό/φορολογικό κανόνα χωρίς πηγή· μην μαντέψεις συμπεριφορά του EveryPay — γράψ' τη στα ανοιχτά.
