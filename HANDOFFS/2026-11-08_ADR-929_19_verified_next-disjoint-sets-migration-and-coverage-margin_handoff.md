# Handoff — ADR-929 §6.9 #19 επαληθεύτηκε · επόμενο: Α) μεταφορά union-find στο SSoT · Β) περιθώριο κάλυψης 0,331

**Ημερομηνία:** 2026-11-08 · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` (η νέα συνεδρία συνεχίζει στο ΙΔΙΟ) ·
**Κλαδί:** `agent/raster-plan-recognition` · commit μόνο στο κλαδί με ρητή λίστα αρχείων · στο `main` κανένα commit ·
`wt:land` + push ΜΟΝΟ με εντολή Giorgio.

## Κατάσταση (λεπτομέρειες: ADR-929 §6.9 #19 + changelog)
- Ο κριτής καταγραφής CAD → μελάνι στο `src/lib/geometry/registration/` είναι **επαληθευμένος** (commit `80593b98`):
  - tests ✅ 126/126 σε 6 σουίτες · μεταλλάξεις 4/4 (μετάθεση χωρίς βήμα · ουρά ανά τμήμα · Lowe `null` · χωρίς `low-coverage`).
  - νέα μέτρηση με τον κριτή του `src/`: σωστά **58/58** δεκτά (26 calibrate-15 + 32 με κείμενα/θόρυβο/κλίση), λάθος **0/33**.
  - εύρημα: η πύλη `low-coverage` δεν φυλασσόταν από test → νέο σενάριο ορόφου 3×3 (`tiledPlan()` + `TILED` στο
    `src/lib/geometry/__tests__/registration-fixtures.ts`)· το «μόνο πλαίσιο» είναι πλέον χαρακτηρισμός (`not-meaningful`).
- Όρια (απόφαση Giorgio): `maxAmbiguity` 0,60 · `minCoverage` 0,30. **Δεν αλλάζουν** χωρίς νέα απόφαση.

## Επόμενο — δύο ανεξάρτητες εργασίες (σειρά: πρώτα Α, μετά Β, εκτός αν πει άλλο ο Giorgio)

### Α) Μεταφορά των τοπικών union-find στο SSoT `src/lib/algorithms/disjoint-sets.ts` (Plan Mode)
- Το SSoT υπάρχει ήδη: `createDisjointSets(n)` → `find` / `union` / `groups()` (ένωση κατά μέγεθος + path halving).
  Ήδη μεταφερμένα: `src/lib/pdf-tables/ruled-grid.ts`, `src/lib/spatial-tour/space-detect/separation-suggest.ts`.
- **Υποψήφια (από πρόχειρο grep, ΜΗ επαληθευμένα — το «find/union» είναι κοινά ονόματα):**
  `bim/mep-systems/mep-pipe-junctions.ts` · `bim/mep-systems/mep-pipe-network-derive.ts` ·
  `bim/model-from-drawing/opening-host-runs.ts` · `wall-trims-corner-resolve.ts` (από το προηγούμενο handoff) ·
  `bim/structural/analytical/analytical-node-merge.ts` + `analytical-model-builder.ts` · `bim/foundations/auto-foundation-layout.ts` ·
  `bim/table/table-range-merge-snap.ts` · `utils/connected-components.ts` (όλα κάτω από `src/subapps/dxf-viewer/`) ·
  `src/lib/owner-property/listing-permissions.ts` · `stores/LayerFiltersStore.ts` (πιθανότατα ψευδώς θετικά).
- **Πρώτο βήμα = πραγματικό SSoT audit:** ανάγνωση κάθε υποψηφίου· ποια είναι πράγματι union-find, ποια **εξαρτώνται από
  την ταυτότητα της ρίζας** (π.χ. `NodeUnionFind` με προτεραιότητα — ποιος κόμβος μένει ρίζα) — αυτά θέλουν απόφαση: επέκταση
  του SSoT (π.χ. `union` με επιλογή νικητή) ή εξαίρεση με λόγο. Το `utils/connected-components.ts` ίσως είναι ήδη δεύτερο SSoT
  → σύγκριση και πρόταση **ενός**.
- Το `disjoint-sets` **δεν** είναι στο `.ssot-registry.json` → πρόταση εγγραφής (module + `forbiddenPatterns`), ώστε το
  CHECK 3.7 να μπλοκάρει νέα τοπικά union-find.
- dxf-viewer: πριν αγγίξεις αρχείο, έλεγξε αν είναι στον πίνακα του ADR-040 / CHECK 6B/6D (τα BIM αρχεία πιθανότατα όχι).
  Κάθε μεταφορά = ίδια συμπεριφορά· tests των αρχείων που αγγίζεις + μετάλλαξη στο SSoT (με έγκριση).
- Πιθανότατα 5+ αρχεία → κανόνας N.8: ενημέρωσε τον Giorgio (Plan Mode ή orchestrator).

### Β) Περιθώριο κάλυψης στα σωστά: 0,331 έναντι κατωφλίου 0,30
- Χειρότερη σωστή περίπτωση στο `pair-positives-noisy` (με θόρυβο/κλίση). Ανάλυση **ανά περίπτωση**: ποια τμήματα αποτυγχάνουν
  (κείμενα πάνω σε τοίχους; θόρυβος; ρόλοι διάστασης/επέκτασης που μετρούν ως τοίχοι;), ώστε να φανεί αν το μέτρο κάλυψης
  μετρά το σωστό πράγμα. **Όχι** αλλαγή ορίου — μόνο διάγνωση και πρόταση.
- Δεδομένα: ο πίνακας του noisy έχει πλέον `verdict` + `nfa` ανά γραμμή (αντίγραφο του script πριν την αλλαγή:
  `pair-positives-noisy.js.bak-6.9-19-verdict`). Scripts: `C:\Nestor_Worktrees\_adr929-measure\` (τρέχουν με
  `node -r ./swc-register.js <script>`· calibrate-15 ~20′, noisy ~15′). Στην οθόνη **μόνο αριθμοί**.

## Ανοιχτά (μόνο αναφορά)
- Τα παλιά scripts `pair-register.js` (`assessOf`) και `probe-width-counterfactual.js` καλούν παλιά υπογραφή του
  `assessRegistration` → RangeError αν ξανατρέξουν.
- Το χειρότερο σωστό στον Lowe ανέβηκε 0,357 → 0,52 με την ευθυγράμμιση· η αιτία ανά περίπτωση δεν εξετάστηκε.

## Κανόνες
- Πριν από κώδικα: πραγματικό SSoT audit (grep), χρήση του υπάρχοντος· Plan Mode + σχέδιο σε Giorgio πριν από κώδικα.
- N.(-2): tests/πύλες/scripts μέτρησης μόνο με έγκριση, ένα «ναι» ανά βήμα · όχι tsc · καμία εικόνα σε AI · κανένα
  όνομα/διαδρομή από `F:\Shared` σε repo/AI/οθόνη.
- Μεταλλάξεις: επαναφορά στο ίδιο tool call (`git checkout -- <αρχείο>`) και `git status` καθαρό μετά.
