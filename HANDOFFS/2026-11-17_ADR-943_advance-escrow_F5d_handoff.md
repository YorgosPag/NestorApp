# HANDOFF — ADR-943 Προκαταβολή με κράτηση: Φ5δ → Φ6

**Ημερομηνία:** 2026-11-17 · Προηγούμενο: `2026-11-17_ADR-943_advance-escrow_F5c_handoff.md` (η Φ5γ ΕΚΛΕΙΣΕ, `2b8d116e`)

## 0. Κανόνες Giorgio (ισχύουν)
- Worktree `C:\Nestor_Worktrees\wt-prune` · κλαδί `agent/wt-prune` · συνέχεια στο ΙΔΙΟ worktree (όχι `wt:new`).
- Commit μόνο στο `agent/wt-prune`, ρητή λίστα αρχείων, `git commit -F <αρχείο>` (μήνυμα με `Write` στο scratchpad).
  **Ποτέ commit στο `main`. `wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio.**
- `tsc` ποτέ (N.17). Tests/jscpd: **ρώτα πριν τρέξεις** (N.(-2)).
- N.14: δήλωσε μοντέλο (Opus) και περίμενε «ok». N.8: 5+ αρχεία/2+ πεδία ⇒ ρώτα Plan Mode ή Orchestrator.
- Καμία πρωτοβουλία εκτός εντολής· ό,τι αξίζει ⇒ πρόταση σε μία γραμμή (ή, αν είναι κενό ασφαλείας χρημάτων της ίδιας
  φάσης, κλείσ' το και **ανέφερέ το ρητά**).
- Οδηγία: «όπως οι μεγάλοι (Stripe/Airbnb/Upwork, Revit/ArchiCAD/Figma, Zillow/Idealista), χωρίς εκπτώσεις, και
  εξυπνότερα· ό,τι δεν ξέρεις ⇒ έρευνα στο διαδίκτυο· αποφάσεις με πηγές στο ADR». **ΠΡΙΝ από κώδικα: πραγματικό SSoT
  audit με grep** — κανένα δίδυμο.

### Παγίδες εργαλείων (μετρημένες σε αυτή τη συνεδρία)
- Worktree-guard: κάθε `git …` σε **χωριστή, απλή** εντολή (όχι `;`, `&&`, `>` ανακατεύθυνση με git, όχι `--` pathspec μαζί με άλλα).
- Bash > 6000 χαρακτήρες αρνείται ⇒ `Edit`/`Write`, ή python script στο scratchpad (`python -I <script>`).
- Ο pre-commit hook κρατά **> 10 λεπτά** ⇒ τρέξε το commit με timeout 600000· αν πάει background, περίμενε την ειδοποίηση.
- **CHECK 3.7** μπλοκάρει `new Date().toISOString()` σε νέο κώδικα ⇒ `nowISO()` από `@/lib/date-local`.
- Locale JSON ⇒ `node scripts/generate-i18n-types.js` + `node scripts/generate-i18n-shell-slice.js`. Αν μια διαδρομή
  ξεπεράσει τη σφράγιση (CHECK 3.34 Κ2): `node scripts/generate-i18n-shell-slice.js --measure` → ενημέρωσε `sealed` +
  νέα γραμμή `history` με `why` στο `.i18n-shell-slice.json` → ξανά ο γεννήτορας.
- Μετάλλαξη σε **μη δεσμευμένο** αρχείο: `cp` σε αντίγραφο → αλλαγή → jest → `cp` πίσω + `cmp` (ποτέ `git checkout`).

## 1. Διάβασε ΠΡΩΤΑ
`docs/centralized-systems/reference/adrs/ADR-943-issuance-advance-escrow.md` — **§5.10** (Ζ-1…Ζ-8) · **§5.11** (Η-1…Η-8) ·
**§5.12** (Θ-1…Θ-8, Φ5γ) · §8 (ανοιχτά).

## 2. Κατάσταση κλαδιού (όλα **μόνο τοπικά**, κανένα push· `origin/main` = `51c480d3` Φ4β)
| Commit | Τι |
|---|---|
| `948d1dc0` | Φ5α — αυτοψία → αυτόματη αποδέσμευση |
| `bacd8ca8` · `f89ff00e` · `1037ce94` | Φ5β — σελίδα προκαταβολής ιδιοκτήτη · «Αίτημα πληρωμής» γραφείου · σουίτα |
| `2b8d116e` | **Φ5γ** — ακύρωση με χρήματα · απόφαση διαφοράς · άρνηση είσπραξης (jest 25/310, μετάλλαξη 2/2) |

## 3. SSoT που ΥΠΑΡΧΟΥΝ — χρησιμοποίησέ τα, μην ξαναγράψεις
**Τομέας** `src/lib/document-validity/`:
- `issuance-advance.ts`: `advanceStateOf` (`disputed` φέρει `resolution` + `refundedMinor`) · `advanceGlanceOf` ·
  `advanceCollectedMinor` · `advanceFundedMinor` · `advanceMovedMinor` · `advanceResolutionOf` · `refundDueOnCancelOf` ·
  `cancellationRefundTotalOf` · `cancellationScheduleOf` · **`advanceTimelineOf`** (χρονολόγιο χωρίς αιτιολογίες — η πηγή
  του πίνακα γραφείου) · `advanceSettledAtOf` · `ADVANCE_POLICY` · `ADVANCE_RELEASE_BASES`.
- `issuance-advance-settlement.ts`: **`advanceSettlementDueOf`** (η ΜΙΑ κρίση «ποια κίνηση οφείλεται») ·
  `cancellationPreviewOf` · `hasLiveAdvanceMoney`.
- `issuance-advance-reducer.ts`: `ACTORS_OF`/`STAGES_OF` — **ήδη** δέχεται `record-advance-receipt` από `engagement` και
  `office` (`receipted()`: ΜΑΡΚ 15 ψηφία, ποσό = εισπραχθέν, ιδεμποτικό στον ίδιο ΜΑΡΚ) και `object-start` από `office`.
**Χρήματα** `src/server/payments/`: `payment-settlement.ts` (ο ΕΝΑΣ εκτελεστής) · `payment-settlement-order.ts`
(`scheduleSettlement`) · `payment-checkout-store.ts` (`SETTLEMENT_BASES` · `sameSettlementOrder`) · `payable-subject-registry.ts`.
**Ανάθεση** `src/services/document-registry/`: `issuance-advance-settlement-order.server.ts` (`ensureAdvanceSettlement` ·
`settleAdvanceNow`) · `issuance-advance-office-money.server.ts` (Θ-3 πράξεις γραφείου που κινούν χρήματα) ·
`issuance-assignment.service.ts` (η ΜΙΑ πόρτα πράξεων γραφείου, PUT `api/document-registry/issuance-assignments`) ·
`issuance-engagement-action.server.ts` (ο ΕΝΑΣ δρόμος πράξης μηχανικού) · `api/engagements/_shared/issuance-action-response.ts`.
**Ιδιοκτήτης** `src/server/issuance-invitations/`: `issuance-advance-objection.ts` (αντίρρηση με σύνδεσμο — πρότυπο για τη
διαδρομή γραφείου) · `issuance-advance-link.ts` (`issueAdvanceLink`, στιγμές `work-started` · `payment-request` ·
`settlement`) · `issuance-advance-notifier.ts` (`announceAdvanceMilestone`).
**Οθόνες**: `RegistryIssuanceAdvanceLine.tsx` (γραμμή στην κάρτα — δέχεται `record`) · `RegistryIssuanceAdvanceDispute.tsx` ·
`RegistryIssuanceDialogs.tsx` (`IssuanceDialogShell` εξαγόμενο) · `EngagedAdvance.tsx` (μηχανικός) ·
`DocumentRequestAdvanceTimeline.tsx` (ιδιοκτήτης) · `issuance-advance-labels.ts` · `issuance-labels.ts` ·
`issuance-quote-draft.ts` (`amountMinorOf` — η ΜΙΑ ανάγνωση ποσού) · `ReceiptForm` (στο `RegistryIssuanceQuoteForms.tsx`,
ΜΑΡΚ του **τελικού** παραστατικού — πρότυπο για τον ΜΑΡΚ προκαταβολής).

## 4. ΤΟ ΕΠΟΜΕΝΟ: Φ5δ
1. **ΜΑΡΚ προκαταβολής (Κ-7)**: ο μειωτής ήδη κρίνει `record-advance-receipt`. Λείπουν: σώμα στο `issuanceAssignmentBody`
   (γραφείο) + route μηχανικού (μέσω `issuance-engagement-action.server.ts`, όπως η αυτοψία) + φόρμα (επαναχρήση του
   `ReceiptForm`, όχι δίδυμο) + εμφάνιση στις τρεις όψεις. Ποσό = εισπραχθέν (`advanceCollectedMinor`). Έρευνα: τύπος
   παραστατικού myDATA για προκαταβολή + συμψηφισμός στο τελικό (§8 #5 — αν δεν βρεθεί επίσημη πηγή, γράψ' το ανοιχτό).
   Και το `receiptMatchesQuote` του τελικού ΜΑΡΚ αφαιρεί ήδη την προκαταβολή — επαλήθευσε ότι μένει συνεπές.
2. **Πίνακας «Προκαταβολή» στο γραφείο**: κατάσταση · ποσά (εισπράχθηκε / επεστράφη / αποδεσμεύτηκε) · `advanceTimelineOf` ·
   εκκρεμής κίνηση (`advanceSettlementDueOf`) · ΜΑΡΚ. Επέκταση της `RegistryIssuanceAdvanceLine` (ή διάλογος λεπτομερειών
   από αυτήν) — όχι νέα ξεχωριστή αλήθεια. Πρότυπο Stripe Dashboard «payment timeline».
3. **Αντίρρηση από το γραφείο για λογαριασμό του ιδιοκτήτη** (Ζ-3): ο μειωτής δέχεται `object-start` από `office` — λείπει
   πόρτα (σώμα στο `issuanceAssignmentBody`) + κουμπί στην κάρτα (μόνο `release-pending`, `canObjectToStart`) με αιτιολογία,
   και η ίδια ειδοποίηση με του συνδέσμου (`start-objected`).
- ADR-943 §5.13 + changelog στο ίδιο commit. Σουίτα στο πρότυπο `issuance-advance-settlement.test.ts` /
  `issuance-advance-owner-page.test.ts` (κοινή ψεύτικη βάση `src/server/payments/__tests__/checkout-fake-firestore.fixture.ts`).
- Κενό κάλυψης από τη Φ5γ (πρόταση, όχι εντολή): test διακομιστή για την πόρτα γραφείου Θ-3 και τον handler άρνησης
  είσπραξης (Θ-6/Θ-7) — ο τομέας και ο εκτελεστής είναι ήδη καλυμμένοι.

## 5. Μετά: Φ6 — sandbox EveryPay Marketplace
- **Το αίτημα δεν έχει σταλεί ποτέ** (έλεγχος Gmail 2026-11-17). Τα δύο νήματα αφορούν IRIS / Apple Pay / Google Pay
  (ενεργά στο sandbox). Εκκρεμούν απαντήσεις της EveryPay στο email της 13/11 προς info@everypay.gr (Google Pay δεν
  εμφανίζεται · επαναλήψεις webhook).
- Ετοίμασε **πρόχειρο** Gmail (όχι αποστολή) προς info@everypay.gr: ενεργοποίηση Marketplace στο sandbox + ερωτήματα §8 #1
  (merchant of record) · #2 (split με IRIS) · #4 (επιστροφή μετά από αντιλογισμό) · #9 (`is_c2c`/`on_hold` · `kyc_process_url` ·
  υπογραφή webhook KYC) + υπενθύμιση επαναλήψεων webhook. Ο Giorgio το ελέγχει και το στέλνει.
- Μετά την ενεργοποίηση: ζωντανή επαλήθευση + αντιλογισμός μετά από `paidOut`.

## 6. Μην κάνεις
Commit στο `main` · `wt:land`/push χωρίς εντολή · τον φάκελο αρχείων κατοικίας (άλλος πράκτορας) ή το
`C:\Nestor_Worktrees\adr-915-f6c-review-fixes` · ισχυρισμούς για EveryPay/myDATA χωρίς πηγή (γράψ' τους στο §8) ·
αποστολή email χωρίς έγκριση.
