# HANDOFF — ADR-929 §6.9 #7: κριτήριο αποδοχής καταγραφής LANDED · επόμενο: tests → νέα δοκιμαστική καταγραφή → διανυσματικό PDF (2026-11-08)

**Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`. Η νέα συνεδρία
συνεχίζει **εδώ**. Commit μόνο στο κλαδί, με ρητή λίστα αρχείων. `wt:land` + push **μόνο με εντολή Giorgio**. Στο `main` κανένα commit.

## 0. Κατάσταση (μετρημένη)
- `wt:land` έγινε (εντολή Giorgio): τοπικό `main` = κλαδί = **`ed216653`** (fast-forward, 7 commits). **Δεν έγινε push**:
  `main` είναι **7 μπροστά από `origin/main`**, η παραγωγή (Netcup) μένει στο `5cf4c4a4`.
- P = `src/subapps/dxf-viewer/bim/plan-recognition`. Πλήρες κείμενο: ADR-929 **§6.9 #4 (διορθωμένο) και §6.9 #7**.

## 1. Τι έγινε (μην το ξανακάνεις)
Commit `ed216653` (11 αρχεία, hook ✅ όλες οι πύλες):
- **Νέο SSoT** `src/lib/statistics/log-binomial-tail.ts`: `logGamma` (Lanczos g=7), `log10BinomialTail` (ακριβές, log-space).
  SSoT audit: μηδέν a-contrario/NFA/log-gamma σε όλο το `src/` πριν.
- **Νέο** `src/lib/geometry/registration/registration-acceptance.ts`: `registerAndAssess` (chamfer → ICP → αξιολόγηση, ένα πεδίο απόστασης) ·
  `assessRegistration(segments, ink, transform, hypotheses, o)` · `inkProbability` · `log10SearchSpace` · `evaluateResiduals`.
  - Δεκτό ⇔ log₁₀NFA ≤ log₁₀ε (ε=1) **και** κάλυψη ανεξάρτητων δειγμάτων ≥ 0,5.
  - p = ποσοστό pixel της ίδιας της εικόνας σε απόσταση ≤ r+√2/2 από μελάνι (άνω φράγμα) · δείγματα με βήμα ≥ 2r.
  - **N_tests = αρχές (υποχρεωτικό όρισμα) × χώρος αναζήτησης ICP** `(2R₀/r)^βε` (affine ≈ 10⁷·²). Αυτό το δεύτερο **δεν ήταν στο
    εγκεκριμένο σχέδιο**: βρέθηκε γράφοντας τα tests (με N=1, ε=1 περνά κάθε P<1, ακόμη και γραμμοσκίαση p=0,99). Δική μας παραγωγή.
  - Υπόλοιπα αξιολόγησης στα 24 px σε όλα τα δείγματα + `nearRadiusShare` (>0,8·ακτίνα ⇒ ακόμη κομμένο).
- `registration-types.ts`: `AcceptanceOptions`/`DEFAULT_ACCEPTANCE`, `RegistrationAssessment`, `AssessedRegistrationResult`, αιτία `no-candidates`.
- `chamfer-register.ts`: `unitNormal` εξάγεται · `pickByChamfer(…, field?)` · το `registerToInk` δηλώνεται «μη αξιολογημένο».
- `src/services/pdf/pdf-rasterize.service.ts`: **`rasterizePdfPageImages`** → `{png, widthPx, heightPx, dpi, pageWidthMm, pageHeightMm}`,
  `dpi = κλίμακα·72/userUnit` με την κλίμακα **μετά** το ταβάνι `maxWidthPx`. 🔴 Το pdfjs **4.5.136** `getViewport` **αγνοεί** το `UserUnit`
  (επαληθεύτηκε, `pdf.mjs` γρ. 16226). Το `rasterizePdfPages` = `.map(png)`, οι καταναλωτές (procurement) αμετάβλητοι.
- Tests **γραμμένα, ΔΕΝ έχουν τρέξει**: `src/lib/statistics/__tests__/log-binomial-tail.test.ts` ·
  `src/lib/geometry/__tests__/registration-acceptance.test.ts` · `src/services/pdf/__tests__/pdf-rasterize-scale.test.ts`.
  Κοινά συνθετικά → `src/lib/geometry/__tests__/registration-fixtures.ts` (το `registration.test.ts` τα εισάγει πλέον).

## 2. Ευρήματα της συνεδρίας (μόνο grep, όχι ζωντανά)
- **Διπλότυπο (δεν αγγίχτηκε):** δύο `InkMask` (`lib/geometry/raster/ink-probe.ts` με `cols/rows` · `registration-types.ts` με `width/height`)·
  το `isInk` του `chamfer-register.ts` αντιγράφει το `inkAt`.
- 🔴 **Το Nestor ΔΕΝ διαβάζει τη γεωμετρία διανυσματικού PDF.** Ακόμη και PDF από CAD ραστεροποιείται και αναγνωρίζεται σαν εικόνα.
  Το `src/services/pdf/pdf-page-structure.ts` διαβάζει γραμμές (`rules`) **μόνο** για πίνακες καταλόγου (ADR-923). Πόσα από τα PDF
  του αρχείου είναι διανυσματικά **δεν μετρήθηκε**.
- **Σύγκριση με βίντεο 4MCAD Professional +AI V.27** (καταγραφή από Gemini, διαφημιστικό 1:34 με μοντάζ, η αναγνώριση δεν φαίνεται):
  το Nestor έχει ήδη τοίχους/διαστάσεις/κλίμακα/βεβαιότητα/έγκριση/3D. **Κενά:** (α) **περιήγηση σε πρώτο πρόσωπο** (WASD, ύψος ματιού,
  σύγκρουση, μίνι χάρτης): **δεν υπάρχει**. Το 3D έχει μόνο orbit/tumble/pan/zoom/roll + view cube (`bim-3d/viewport/`), κινηματογραφική
  διαδρομή με waypoints + MP4 (ADR-366 C.1), και πανοράματα 360° (ADR-884, `lib/spatial-tour`, `TOUR_EYE_HEIGHT_M`). Κανένα ADR δεν
  τη σχεδιάζει. (β) σύμβολο πόρτας με φορά από την εικόνα (δεν βρέθηκε) · (γ) ετικέτες χώρων με διαστάσεις στο 3D.
  **Απόφαση Giorgio: ΟΧΙ νέο παράλληλο σύστημα** — ό,τι μπει, μπαίνει στα υπάρχοντα ADR (366 / 929 / 884).

## 3. Επόμενο (με σειρά προτεραιότητας — όλα με «ναι» Giorgio, Plan Mode + SSoT grep + έρευνα όπου δεν είσαι σίγουρος)
1. **Εκτέλεση tests (ζήτα έγκριση):** `npx jest src/lib/statistics src/lib/geometry/__tests__/registration src/services/pdf` μέσα στο worktree.
   Μεταλλάξεις με επαναφορά στην ίδια εντολή (trap): χωρίς `log10SearchSpace` · p = σταθερό · αξιολόγηση με την τελευταία ακτίνα (3 px).
   Ενημέρωσε ADR §6.9 #7 με τα αποτελέσματα.
2. **Νέα δοκιμαστική καταγραφή** (scripts εκτός repo `C:\Nestor_Worktrees\_adr929-measure\`, `node -r ./swc-register.js …`):
   `pair-register.js` → `rasterizePdfPageImages` αντί για regex `/MediaBox` · `assessRegistration` με hypotheses = πλήθος δοκιμών.
   **Κριτήριο επιτυχίας της διόρθωσης:** οι 11 «επιτυχίες» του §6.9 #6 (κάλυψη 0,045–0,08 και 10 DPI) βγαίνουν **`rejected`**.
   Για ό,τι γίνει δεκτό: `scoreRoles`/`checkSpans` ⇒ **πρώτος πραγματικός αριθμός ακρίβειας ανά ρόλο**.
3. **Μέτρηση πόσα PDF του αρχείου είναι διανυσματικά** (μόνο ανάγνωση, έξοδος μόνο στον ιδιωτικό φάκελο). Αν είναι πολλά ⇒ πρόταση
   νέας φάσης ADR-929 «διανυσματικό PDF ⇒ οντότητες» (ανάγνωση `constructPath` του pdfjs, ίδιος αναγνωριστής ρόλων + ίδια ροή έγκρισης,
   πέφτει στη ραστεροποίηση μόνο όταν δεν είναι διανυσματικό). Η μεγαλύτερη βελτίωση ακρίβειας με το μικρότερο ρίσκο — αφού μετρηθεί.
4. Προτάσεις μίας γραμμής (μόνο με «ναι»): ενοποίηση `InkMask` · test M3 (snooping τελευταίου γύρου) · καταχώριση `lib/geometry/registration`
   + `lib/statistics` στο `.ssot-registry.json` · αναγνώστης παλιάς μορφής TEK v2/v4/v5 (ADR-526, ανοίγει 247 αρχεία αλήθειας) ·
   περιήγηση σε πρώτο πρόσωπο στο ADR-366 · στόχοι ακρίβειας ανά οντότητα (ορίζονται με τον Giorgio πάνω στις πρώτες μετρήσεις).

## 4. Κανόνες
- Plan Mode + σχέδιο στον Giorgio πριν από κώδικα · SSoT audit (grep) πρώτα · έρευνα στο διαδίκτυο όπου δεν είναι σίγουρο.
- Όχι tsc, όχι `--no-verify`, **κανένα test/πύλη χωρίς έγκριση**, **καμία εικόνα σε AI**, κανένα όνομα/διαδρομή από `F:\Shared` σε repo/AI/οθόνη.
- Jest μέσα στο worktree (δικό του `node_modules`). Μεγάλα κείμενα με `Write`· git: `"C:\Program Files\Git\cmd\git.exe"`.
