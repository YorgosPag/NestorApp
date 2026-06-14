# HANDOFF — ADR-449 σοβάς (finish skin): οι ΟΜΟΡΟΙ σοβάδες αλληλοδιεισδύουν στις ενώσεις («δύο γραμμές») → χρειάζεται καθαρή ΜΗ-overlapping ένωση

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-449 (structural finish skin)
**Quality bar:** **FULL ENTERPRISE + FULL SSOT**, Revit-grade. **Plan Mode + recognition ΠΡΩΤΑ**, έγκριση plan ΠΡΙΝ κώδικα.
**Μοντέλο:** Opus (σύνθετη γεωμετρία σοβά — boolean union / clip / silhouette).
**Commit:** **ΜΟΝΟ ο Giorgio** (N.(-1)). **working tree μοιράζεται με άλλον agent → `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`/`--no-verify`.**

---

## 0. ΤΙ ΖΗΤΗΣΕ Ο GIORGIO (ακριβώς)

Μετά το Slice 10 v3 (junction-aware κλείσιμο, βλ. §2), οι ενώσεις σοβά **οπτικά φαίνονται σωστές**, ΑΛΛΑ:
> «ΒΛΕΠΩ ΔΥΟ ΓΡΑΜΜΕΣ ΣΤΙΣ ΕΝΩΣΕΙΣ ΚΑΙ ΑΥΤΟ ΜΕ ΑΝΗΣΥΧΕΙ. ΦΟΒΑΜΑΙ ΜΗΠΩΣ ΟΙ ΟΜΟΡΟΙ ΣΟΒΑΔΕΣ ΜΠΑΙΝΟΥΝ Ο ΕΝΑΣ ΜΕΣΑ ΣΤΟΝ ΑΛΛΟ.»

**Ζητούμενο:** οι σοβάδες γειτονικών στοιχείων (κολόνα↔δοκάρι) να **ενώνονται καθαρά ΧΩΡΙΣ αλληλοδιείσδυση/overlap** και χωρίς διπλή γραμμή. Όχι «μπάλωμα» — **FULL ENTERPRISE + FULL SSOT** λύση.

**Screenshots:**
- `c:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-14 125743.jpg` (2Δ — μία ένωση, διπλή γραμμή)
- `c:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-14 125822.jpg` (2Δ — δύο ενώσεις, διπλές γραμμές)
- `c:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-14 125851.jpg` (3Δ — οι ενώσεις φαίνονται ΟΚ αλλά faint double edge)

---

## 1. Η ΑΙΤΙΑ (αρχική διάγνωση — επιβεβαίωσε στο recognition)

Το **corner-fill** της v3 (§2) δουλεύει μέσω **OVERLAP**: στα junction άκρα κάθε finish band επεκτείνεται (core+outer) κατά ~`thickness` (15mm) **μέσα στη ζώνη του γείτονα** ώστε να γεμίσει η γωνία. Άρα:
- **3Δ:** δύο γειτονικά bands **φυσικά επικαλύπτονται** (penetrate) στη ζώνη ένωσης → διπλή ακμή (`attachEdgesProjection` ανά band) + πιθανό z-fighting. = η «αλληλοδιείσδυση» που φοβάται ο Giorgio. **ΥΠΑΡΚΤΟ** (by design του v3 corner-fill via overlap).
- **2Δ:** το `drawStructuralFinishOutline` (ΔΕΝ αγγίχτηκε στο Slice 10) ζωγραφίζει τον σοβά **ανά στοιχείο ανεξάρτητα**, χωρίς junction-awareness → δύο collinear γείτονες = **δύο παράλληλες offset γραμμές** (καθεμία = το thin band του στοιχείου της). Pre-existing από Slice 3.

**Άρα:** το «δύο γραμμές» έχει 2 πηγές (3Δ overlap + 2Δ per-element independent outline). Η enterprise λύση πρέπει να δίνει **ΕΝΑ συνεχές δέρμα σοβά** στην ένωση, χωρίς επικαλυπτόμενα per-element κομμάτια — **ΚΑΙ στο 2Δ ΚΑΙ στο 3Δ** (κοινό SSoT).

---

## 2. ΚΑΤΑΣΤΑΣΗ Slice 10 (ΟΛΟΚΛΗΡΩΘΗΚΕ, UNCOMMITTED — μην το πετάξεις άσκοπα)

Slice 10 = **junction-aware κλείσιμο** σοβά στις flush «από κάναβο» συμβολές (ADR-441). Iterative με τον Giorgio:
- **v1 (square):** junction άκρο → απλό τετράγωνο → «ορθογώνιος αλλά δεν κλείνει» (εξωτερικό τριγωνάκι ανοιχτό).
- **v2 (outer-only EXTEND):** έκλεινε αλλά **λοξό end-cap (miter) που διεισδύει** στο σώμα του διπλανού.
- **v3 (core+outer EXTEND) — ΤΡΕΧΟΥΣΑ:** core ΚΑΙ outer επεκτείνονται μαζί κατά τον άξονα → **κάθετο/ορθογωνικό end-cap** flush. Corner-fill **μέσω overlap** → εξ ου το §1 «δύο γραμμές».

**Μηχανισμός (3Δ μόνο):**
- `bim/finishes/structural-finish-types.ts` — `FinishFaceSegment += aJunction?/bJunction?`.
- `bim/finishes/structural-finish-resolver.ts` — `resolveStructuralFinishFaces` annotates per-endpoint junction = `pointNearObstacle(endpoint, obstacles, tol)` (tol=`JUNCTION_TOL_MM=10`×scale, **παράγεται από `unitToMeters`** → μηδέν αλλαγή στο scene που είναι @500-line cap N.7.1).
- `bim-3d/converters/structural-finish-3d.ts` — `closeOpenOuterEnds` (πρώην `chamferOpenOuterEnds`): junction → core+outer extend· free → 45° chamfer (outer-only). `computeMiteredOuter` επιστρέφει ΚΑΙ `aCore/bCore` (το quad τα διαβάζει αντί raw `seg.a/b`).
- **2Δ ΔΕΝ αγγίχτηκε** (ήδη square· αλλά per-element → §1 double line).

**Tests:** 86/86 jest (suite §6). **tsc ΔΕΝ τρέχτηκε** (N.17 — running-tsc check θέλει PowerShell που είναι denied· ζήτα από Giorgio `! npx tsc --noEmit`).
**Επίσης UNCOMMITTED:** Slice 9 (chamfer-both + directional dilation). Όλα τα ADR docs/MEMORY/ΕΚΚΡΕΜΟΤΗΤΕΣ ενημερωμένα.

**Δικά μου αρχεία (git add ΜΟΝΟ αυτά, MIXED με Slice 9):** `structural-finish-types.ts`, `structural-finish-resolver.ts`+`__tests__/structural-finish-resolver.test.ts`, `structural-finish-3d.ts`, `bim-3d/converters/__tests__/structural-finish-3d-beam.test.ts`, `ADR-449.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

> **ΑΠΟΦΑΣΗ ΓΙΑ ΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ:** αν η enterprise λύση είναι «ΕΝΑ συνεχές δέρμα» (union/silhouette), ίσως το v3 corner-fill-via-overlap να **αντικατασταθεί** (όχι να επεκταθεί). Κράτα ό,τι παραμένει χρήσιμο (junction flags στον resolver = πιθανώς reusable).

---

## 3. ΥΠΟΨΗΦΙΑ ΑΡΧΕΙΑ (RECOGNITION — διάβασέ τα ΠΡΩΤΑ, code = SoT)

- `bim-3d/converters/structural-finish-3d.ts` — `closeOpenOuterEnds`, `computeMiteredOuter`, `buildFinishSkinFromFaces`, `addFinishPrism` (το v3 overlap ζει εδώ).
- `bim/finishes/structural-finish-resolver.ts` — pure SSoT (segments + junction flags).
- `bim/finishes/structural-finish-scene.ts` — obstacles (walls/beams/columns), `computeColumnFinishBands`/`computeBeamFinishFaces`. **@499 γραμμές — ΟΡΙΑΚΟ (N.7.1 500 cap)· μη βάλεις logic εδώ, χρησιμοποίησε νέο module.**
- `bim/renderers/structural-finish-outline-2d.ts` — **2Δ `drawStructuralFinishOutline`** (per-element, double-line πηγή· κοινό από ColumnRenderer+BeamRenderer).
- `bim/finishes/structural-finish-scene-silhouette.ts` + `bim-3d/converters/structural-finish-silhouette-3d.ts` — **Slice 7 merged silhouette (DORMANT, `STRUCTURAL_SILHOUETTE_ENABLED=false`)**: `safeUnion` δομικών cores ανά height-band → ΕΝΑ outline → resolver. Είχε bug «μία όψη σε ανοιχτή τοπολογία» → reverted· **ΑΛΛΑ σε ΚΛΕΙΣΤΟ πλαίσιο (η σκηνή του Giorgio ΕΙΝΑΙ κλειστός κάναβος) δούλευε σωστά** (διαγνωστικό). Ίσως αναβιώσιμο/προσαρμόσιμο.
- `bim/geometry/shared/polygon-dilate.ts` (`dilatePolygonAlongAxis`/`dilatePolygonOutward`), `bim/geometry/shared/polygon-utils.ts` (`pointInPolygon`, S-H `clipPolygonBySH`, `polygonArea`), `safeUnion` (polygon-clipping).

**Σχετικό MEMORY:** `project_adr449_structural_finish_skin.md` (πλήρες ιστορικό Slices 1-10· **ΔΙΑΒΑΣΕ ΤΟ** — ιδίως Slice 7 silhouette + winding lessons «polygon-clipping winding-sensitive, normalize CCW»).

**Firestore σκηνή (verified):** project `proj_1d45b55b-…`, floorplan `file_f6b1782f-…`, level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`· κάναβος 3×3 κολόνες 400×400 + 12 δοκάρια 250 edge-justified (collinear παρειές). Διάβασέ τα με firestore MCP (`floorplan_columns/_beams/_walls`) για ακριβή coords.

---

## 4. PLAN SKELETON (ραφινάρισέ το σε Plan Mode — recognition + Firestore ΠΡΩΤΑ)

Στόχος: **ΕΝΑ συνεχές δέρμα σοβά στις ενώσεις, μηδέν overlap/penetration, μηδέν διπλή γραμμή, 2Δ+3Δ κοινό SSoT.** Υποψήφιες προσεγγίσεις (αξιολόγησε):

- **Α (προτεινόμενη, πιο SSoT): boolean UNION των finish bands ανά height-band & ανά classification.** Μετά τα per-element bands (plan quads), `safeUnion` (REUSE) ανά κατηγορία (interior/exterior ξεχωριστά για χρώμα) → merged outline(s) → mesh + 2Δ outline από το ΙΔΙΟ. Σβήνει το overlap/double-line **διατηρώντας** την per-face resolution (ποιες παρειές εκτεθειμένες). **ΠΡΟΣΟΧΗ winding** (polygon-clipping CCW-normalize — γνωστό μάθημα Slice 7).
- **Β: revive/adapt Slice 7 merged silhouette** (union δομικών cores → resolver). Πιο καθαρό αλλά είχε open-topology bug· η σκηνή είναι κλειστή → δοκίμασέ το, αλλά γενίκευσε για ανοιχτή τοπολογία (per-element fallback).
- **Γ: trim-to-neighbor αντί extend-with-overlap** (ownership rule: ένα band επεκτείνεται, το όμορο κόβεται ακριβώς → butt χωρίς overlap). Λιγότερο SSoT (cross-element coordination), πιο εύθραυστο.

**Slice X1:** επιλογή προσέγγισης + 3Δ non-overlapping join. **Slice X2:** 2Δ `drawStructuralFinishOutline` να μοιράζεται το ΙΔΙΟ merged geometry (μηδέν per-element double line). **Slice X3:** tests (jest mirror· Firestore-verify) + ADR-449 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY (N.15).

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά πάντα. **FULL ENTERPRISE + FULL SSOT** (grep centralized ΠΡΙΝ γράψεις· reuse `safeUnion`/`polygon-utils`/resolver· μηδέν duplicate· N.0/N.12). **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)). **working tree shared → `git add` ΜΟΝΟ δικά σου**, ΠΟΤΕ `-A`/`--no-verify`. N.7.1 (40γρ/func, 500γρ/file — `structural-finish-scene.ts` @499, χρησιμοποίησε νέο module). No `any`/`as any`/`@ts-ignore`. N.11 (i18n — εδώ μηδέν user-facing strings). **ΕΝΑ tsc τη φορά (N.17)** — running-tsc check θέλει PowerShell (denied) → ζήτα από Giorgio. **ADR-449 finish skin = ΕΚΤΟΣ ADR-040** (όχι micro-leaf)· αλλά αν αγγίξεις 2Δ canvas drawing files (DxfRenderer/ColumnRenderer/BeamRenderer) → CHECK 6D θέλει staged ADR/doc. **Plan Mode → έγκριση ΠΡΙΝ κώδικα.** Firestore-first verify (η μέθοδος που έλυσε Slices 8b/9/10).

## 6. Tests (ADR-449)
`npx jest src/subapps/dxf-viewer/bim-3d/converters/__tests__/structural-finish src/subapps/dxf-viewer/bim/finishes src/subapps/dxf-viewer/bim/geometry/shared/__tests__/polygon-dilate`
(86/86 πριν ξεκινήσεις. Renderer 2Δ: `…/bim/renderers/__tests__/ColumnRenderer-finish` + `BeamRenderer-finish`.)
