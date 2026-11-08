# Handoff — ADR-929 §6.9 #18: N_tests + n_eff (E4) επικυρώθηκαν · επόμενο: ευθυγράμμιση κλίσης στη βαθμονόμηση, μετά `src/`

**Ημερομηνία:** 2026-11-08 · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` (η νέα συνεδρία συνεχίζει στο ΙΔΙΟ) ·
**Κλαδί:** `agent/raster-plan-recognition` · commit μόνο στο κλαδί με ρητή λίστα αρχείων · στο `main` κανένα commit ·
`wt:land` + push ΜΟΝΟ με εντολή Giorgio.

## Κατάσταση (λεπτομέρειες: ADR-929 §6.9 #18)
- **Στο `src/` δεν άλλαξε τίποτα.** Όλη η δουλειά είναι μέτρηση με scripts εκτός repo (`C:\Nestor_Worktrees\_adr929-measure\`).
- **Διπλομέτρηση της μετάθεσης επιβεβαιώθηκε** ανά περίπτωση: `log10SearchSpace` = 6·log₁₀16 πάνω σε θέσεις χονδρού βήματος K = 8
  ⇒ υπερμέτρηση (2R₀/K)². Σωστός κανόνας: ανά βαθμό που απαριθμεί ο χονδρός με βήμα s ⇒ min(s, 2R₀)/r· αλλιώς 2R₀/r.
- **Το πραγματικό εμπόδιο ήταν το deff** (`registration-shift-null.ts`: `log10Tail = tail / designEffect`). Νικητής της
  προκαθορισμένης σύγκρισης: **E4 = ομαδοποίηση παράλληλων τμημάτων** (|sin| < sin 5°, απόσταση καθέτως < 2r + W, επικάλυψη
  προβολών· μονάδα πέτυχε ⇔ ≥ ½ μήκους· p μονάδας από τις ίδιες μετατοπίσεις· ουρά χωρίς deff). Υλοποίηση αναφοράς:
  `_adr929-measure/analyze-18.js` → `clusters()` + `evaluate()`.
  - 59 του #16: NFA ≤ 0 σε 26/26 σωστά, 1/33 λάθος. Με Lowe + κάλυψη: 24/26, 0/33 (λείπουν κάλυψη 0,499 / 0,492).
  - Νέα θετικά (32): NFA ≤ 0 σε **20/20** σωστά ✅. Αλλά Lowe ≤ 0,52 ❌ (σωστά με κλίση 0,60–0,78) · κάλυψη ως 0,37 ⇒ 14/20.
- Κλίση 1,5° ⇒ 0/8 σωστή θέση, 0,7° ⇒ 4/8: ο χονδρός ψάχνει μόνο 90°, και η βαθμονόμηση **δεν** ισιώνει όπως η παραγωγή (Φ1).

## Επόμενο (με τη σειρά, κάθε ένα με «ναι» Giorgio)
1. **Ευθυγράμμιση κλίσης της παραγωγής μέσα στη ροή της βαθμονόμησης** (`calibrate-core.js` → `assessCase`), ΠΡΙΝ το `inkOf`:
   SSoT audit πρώτα — πώς το κάνει η Φ1 (`src/lib/geometry/raster/skew-estimate.ts` `estimateSkew`, `raster-warp.ts`
   `straighteningRotation`/`warpHomography`, και ο Worker ευθυγράμμισης της Φ1, ADR-929 §6.2). Ίδια σειρά με την παραγωγή, καμία
   δική μας εκδοχή. Η αλήθεια (`placementError`) πρέπει να συνθέσει και τη στροφή ισιώματος.
2. Ξανά `calibrate-15.js` + `pair-positives-noisy.js` + `analyze-18.js` (και στα δύο αρχεία πίνακα) ⇒ κατανομές Lowe/κάλυψης σε
   **όλα** τα δεδομένα. Τα όρια Lowe και κάλυψης τα αποφασίζει ο Giorgio πάνω στη μετρημένη κατανομή — όχι ρύθμιση για «να περάσει».
3. **Μία αλλαγή στο `src/`** (Plan Mode + σχέδιο πρώτα): `SearchDeclaration { hypotheses, translationStepPx }` στο
   `registration-types.ts` · `log10SearchSpace(o, step)` στο `registration-acceptance.ts` · E4 στη θέση του deff στο
   `registration-shift-null.ts` · `DEFAULT_ACCEPTANCE.maxAmbiguity` / `minCoverage` από το βήμα 2 · tests + 3 μεταλλάξεις · ADR §6.9 #19.

## Αρχεία μέτρησης (εκτός repo, `C:\Nestor_Worktrees\_adr929-measure\`)
- `calibrate-core.js` — **ο κοινός πυρήνας** (χονδρός → ICP → αξιολόγηση → πίνακας «τμήμα × μετατόπιση», `deffOf` έλεγχος).
- `calibrate-15.js` — 26 σωστά + 33 λάθος ⇒ `calibrate-15.jsonl` + `calibrate-18-matrix.jsonl` (ιδιωτικό `pairs/`). Αντίγραφο πριν
  την αναδιάρθρωση: `calibrate-15.js.bak-6.9-18`.
- `pair-positives-noisy.js` — κείμενα/θόρυβος/κλίση ⇒ `calibrate-18-noisy-matrix.jsonl` + PDF στο ιδιωτικό `pairs/positives-noisy/`.
- `analyze-18.js [αρχείο πίνακα]` — οι 5 εκτιμητές (E0–E4) με προκαθορισμένους κανόνες.
- `@pdf-lib/fontkit` 1.1.1 (MIT) + `pako` 1.0.11 (MIT AND Zlib, εγκεκριμένο από Giorgio) **μόνο** σε αυτόν τον φάκελο.
- Εντολές: `cd C:/Nestor_Worktrees/_adr929-measure && node -r ./swc-register.js <script>` (calibrate ~20′, noisy ~15′).

## Κανόνες
- Πριν από κώδικα: **πραγματικό SSoT audit (grep)**, χρήση του υπάρχοντος, κανένα διπλότυπο. Plan Mode + σχέδιο στον Giorgio.
- «Όπως οι μεγάλοι, χωρίς εκπτώσεις»· έρευνα στο διαδίκτυο όπου δεν είσαι σίγουρος.
- N.(-2): tests/πύλες/scripts μέτρησης μόνο με έγκριση · όχι tsc · καμία εικόνα σε AI · κανένα όνομα/διαδρομή από `F:\Shared`
  σε repo/AI/οθόνη (στην οθόνη μόνο αριθμοί).
