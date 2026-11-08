# Handoff — ADR-929 §6.9 #21: κριτής με W = p90 στην τελική θέση · tests + επαναβαθμονόμηση εκκρεμούν

**Ημερομηνία:** 2026-11-08 · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
(βάση `b541fd62`) · η δουλειά του #21 είναι **commit στο κλαδί** (εντολή Giorgio, 2026-11-08) — **όχι** στο `main` ·
`wt:land` + push ΜΟΝΟ με εντολή Giorgio. Η νέα συνεδρία συνεχίζει στο **ίδιο** worktree.

## Κανόνες βημάτων
Κάθε βήμα (tests · scripts · μεταλλάξεις · commit) **μόνο με ρητό «ναι»** του Giorgio, ένα ανά βήμα. Πριν από κώδικα:
SSoT audit με grep (π.χ. υπάρχει ήδη `quantile` στο `lib/market/market-statistics`· **μην** γράψεις δεύτερο).

## Πώς τρέχουν τα scripts μέτρησης
`cd C:\Nestor_Worktrees\_adr929-measure && node -r ./swc-register.js <script>` — τρέχουν **ακριβώς** τον κώδικα του `src` του
worktree. Ο φάκελος δεδομένων είναι η σταθερά `OUT` του `pair-register.js` — **ποτέ** όνομα/διαδρομή του στην οθόνη.
⚠️ Το `pair-positives-noisy.js` **δεν** έχει φρουρό `require.main` ⇒ μην το κάνεις `require` (ξαναγράφει τον πίνακα)· οι
βοηθοί του υπάρχουν αντιγραμμένοι στο `pair-positives-noisy-lib.js`. Το pdf-lib γράφει ημερομηνία ⇒ το sha ενός PDF που
ξαναφτιάχνεται αλλάζει· για σύγκριση διάβαζε τα **αποθηκευμένα** PDF με το sha της γραμμής του πίνακα.
Το μηχάνημα έμεινε μία φορά χωρίς μνήμη (τρέξιμο κόπηκε στο 88/91)· τα μεγάλα τρεξίματα στο παρασκήνιο, ένα τη φορά.

## Κατάσταση
- **Διάγνωση (Β) ΕΚΛΕΙΣΕ** — πλήρη ευρήματα στο ADR-929 §6.9 #21. Σύνοψη: οι αποτυχίες σε σωστή θέση είναι `too-long`/`clipped`
  (φαρδύ μελάνι)· η υπόθεση «φουσκωμένο W» διαψεύστηκε· ρίζα = όριο μήκους στον **διάμεσο**· όριο ανάλυσης ≤ 42 dpi (ενωμένες παρειές).
- **Αντιπαράδειγμα 91/91:** W = p90 στην τελική θέση ⇒ θετικά 26/26 + 32/32 (κάλυψη ≥ 0,771), λάθος ζεύγη 0/33 όλα `not-meaningful`.
- **Υλοποίηση (απόφαση Giorgio «α→β→γ»), commit στο κλαδί μαζί με αυτό το handoff:**
  - `src/lib/geometry/registration/chamfer-register.ts` — `strokeWidthsAt` (κοινή μέτρηση) · `estimateStrokeWidthPx` (διάμεσος, ICP) · νέο `judgeStrokeWidthPx` (p90).
  - `registration-types.ts` — `acceptance.strokeWidthQuantile: 0.9`.
  - `registration-acceptance.ts` — προεπιλογή του κριτή = `judgeStrokeWidthPx`· το `registerAndAssess` δεν περνά πια το W του ICP.
  - `src/lib/geometry/__tests__/registration-acceptance.test.ts` — ενημερωμένο assert W + νέο σενάριο «1/3 παρειές 5 px».
  - ADR-929 §6.9 #21 + changelog.
  - Εκτός repo: `_adr929-measure/calibrate-core.js` δεν περνά πια `strokeWidthPx` (ίδιο με την παραγωγή).

## Επόμενο (κάθε βήμα με «ναι»)
1. ✅ jest `registration-acceptance` + `registration`: **47/47** (2026-11-08). Άλλος καταναλωτής του κριτή στο `src/`: κανένας (grep).
2. Επαναβαθμονόμηση: `calibrate-15.js` + `pair-positives-noisy.js` (~15′ το καθένα). Η υλοποίηση παρεμβάλλει (Hyndman–Fan 7) ενώ το
   αντιπαράδειγμα μέτρησε `floor(q·n)` ⇒ οι αριθμοί πρέπει να ξαναμετρηθούν.
3. Μεταλλάξεις (π.χ. `strokeWidthQuantile` → 0,5) με επαναφορά στο ίδιο tool call.
   Κριτήριο (ίδιο με το #19): σωστά ≥ 95% δεκτά **και** λάθος ζεύγη ≤ 1/33. Σύγκριση με τον πίνακα του #21.
4. Ενημέρωση ADR-929 §6.9 #21 + changelog με τους πραγματικούς αριθμούς · commit στο κλαδί με ρητή λίστα αρχείων.

## Μόνο αναφορά (προτάσεις, όχι εντολή)
- Σκόρπια ποσοστημόρια: `lib/market/market-statistics.quantile` · `monte-carlo-engine.percentile` · `dxf-viewer/utils/sample-distribution.percentileOfSorted` — υποψήφιο SSoT στο `lib/statistics`.
- Το W του ICP μένει διάμεσος — δεν μετρήθηκε αντιπαράδειγμα εκεί.
- Το τρέξιμο του `cf-stroke-cap.js` κόπηκε μία φορά από χαμηλή μνήμη (88/91)· συμπληρώθηκε με `MIN_IDX = 89`.

## Κανόνες
N.(-2) · όχι tsc · καμία εικόνα σε AI · κανένα όνομα/διαδρομή του `F:\Shared` σε repo/AI/οθόνη.
