# Handoff — ADR-929 §6.9 #15–#17: νέος κριτής καταγραφής + βαθμονόμηση · επόμενο: σωστό N_tests + Lowe ως πύλη

**Ημερομηνία:** 2026-11-08 · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` (μόνο μέσω EnterWorktree) ·
**Κλαδί:** `agent/raster-plan-recognition` · land/push ΜΟΝΟ με εντολή Giorgio. Main = `bf6cf684` + docs (χωρίς τα #10–#17).

## Commits στο κλαδί (αυτή η συνεδρία)
- `9349ca85` docs §6.9 #14 · `f8594015` **κώδικας §6.9 #15** · `a2cd3143` docs §6.9 #16 · `29dc0600` docs §6.9 #17 ·
  + το commit αυτού του handoff. Δέντρο καθαρό, καμία εκκρεμής αλλαγή.

## Κατάσταση (λεπτομέρειες: ADR-929 §6.9 #15, #16, #17)
- **#15 (κώδικας, tests 46/46, μεταλλάξεις 3/3):** probe κατά πάχος (W μετρημένο στο αποτύπωμα, ένα W παντού) · τοπική H0 με
  μετατόπιση όλου του σχεδίου (`registration-shift-null.ts`: z/PSR, εμπειρική p, deff Kish, ουρά Poisson-binomial / deff) ·
  Lowe (`pickByChamfer.runnerUpScore`, `ambiguityRatioOf`) · `positionSigmaPx` (σ₀²·Q_xx) = νέα πύλη `unresolvable` ·
  `lib/statistics/median.ts` SSoT. Νέα κατώφλια (`minShiftZ`, `maxAmbiguity`, `maxPositionSigmaPx`) = `null`.
- **#16 βαθμονόμηση** (`_adr929-measure/calibrate-15.js`, έξοδος `calibrate-15.jsonl` στο ιδιωτικό `pairs/`): λάθος **0/33** ✅ ·
  θετικά **15/26** ❌ (10 `not-meaningful` σε 41–60 dpi, deff 22–48). **Μόνο ο Lowe έχει κενό:** θετικά ≤ 0,357 · λάθος ≥ 0,683
  ⇒ Lowe ≤ 0,52 μόνο: 26/26 και 0/33.
- **#17 πείραμα ουράς HMMER/BLAST:** θετικά 5/26 ⇒ απορρίφθηκε, κώδικας επανήλθε. Εύρημα: τα NFA των λάθος ≈ ο όρος χώρου
  αναζήτησης ⇒ **το εμπόδιο είναι το N_tests** (μετάθεση μετρημένη και στο πλέγμα χονδρού και στο (2R₀/r)^βε του ICP).

## Επόμενο (κάθε ένα με «ναι» Giorgio — εντολή του: «όπως οι μεγάλοι, χωρίς εκπτώσεις, έρευνα όπου δεν είσαι σίγουρος»)
1. **Σωστό N_tests** (σαν το m·n του BLAST: χώρος **μία** φορά). Πρώτα αποθήκευσε `hypotheses` στο jsonl για επιβεβαίωση ανά
   περίπτωση. Αλλαγή στο `log10SearchSpace` ⇒ Plan Mode + tests + ξανά `calibrate-15.js`.
2. **Lowe ως πύλη** (`maxAmbiguity` = 0,52 από το μετρημένο κενό) — ratio test όπως SIFT/template matching.
3. Θετικά με κείμενα/θόρυβο/κλίση (το clutter των θετικών είναι 0 ⇒ δεν βαθμονομείται) πριν εμπιστευτούμε το κενό.
4. Ανοιχτά: clutter με ακτίνα r + W/2 · ενοποίηση `median` (axis-bands, dxf-viewer) · δύο `InkMask` · 1001 px.

## Αρχεία-κλειδιά (`src/lib/geometry/registration/`)
- `registration-acceptance.ts` → `log10SearchSpace` (ο ύποπτος του N_tests), `assessRegistration`, `verdictOf`, `ambiguityRatioOf`
- `registration-shift-null.ts` (τοπική H0) · `chamfer-register.ts` (`pickByChamfer`, probe, `estimateStrokeWidthPx`)
- `registration-types.ts` (`DEFAULT_ACCEPTANCE`: `maxAmbiguity` κ.λπ. = `null`) · tests: `src/lib/geometry/__tests__/registration*.test.ts`

## Κανόνες
- **Πριν από κώδικα: πραγματικό SSoT audit (grep)** για υπάρχοντα κώδικα (π.χ. μέτρηση χώρου αναζήτησης, E-value, ratio test) —
  χρήση του υπάρχοντος, κανένα διπλότυπο. Plan Mode + σχέδιο στον Giorgio. Έρευνα στο διαδίκτυο όπου δεν είσαι σίγουρος.
- Ποιότητα «όπως οι μεγάλοι (Revit/ArchiCAD/Figma…), χωρίς εκπτώσεις»· αν οι μεγάλοι δεν το προτείνουν, ακολουθούμε την πρακτική τους.
- Commit μόνο στο κλαδί, με ρητή λίστα αρχείων · στο `main` κανένα commit · `wt:land` + push ΜΟΝΟ με εντολή Giorgio.
- Κανένα όνομα/διαδρομή από `F:\Shared` σε repo/AI/οθόνη · καμία εικόνα σε AI · N.(-2): tests/πύλες μόνο με έγκριση · όχι tsc.
- Scripts: `cd C:/Nestor_Worktrees/_adr929-measure && node -r ./swc-register.js calibrate-15.js` (~20′).
