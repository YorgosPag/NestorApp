# 🧠 HANDOFF — ADR-363 Φ1G.5 Slice 2h: Temporary/Listening Dimensions για ΜΕΤΑΚΙΝΗΣΗ ΤΟΙΧΟΥ
## NEXT: γενίκευση του opening temp-dimension overlay → wall move (Revit «μετακινείς τοίχο → ζωντανές διαστάσεις»)

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** Recognition → Plan Mode → έγκριση Giorgio → υλοποίηση. **FULL ENTERPRISE + FULL SSOT, «όπως η Revit».** Καθαρό context.

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι — διάβασέ τους ΠΡΩΤΑ)
- **Ελληνικά** όλες οι απαντήσεις στον Giorgio.
- **FULL ENTERPRISE + FULL SSOT** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· **καμία διπλή υλοποίηση** (reuse τα SSoT του §4· ΜΗΝ ξαναγράψεις dimension renderer / junction math / reference math).
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα ΜΟΝΟ έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED working tree** με ΑΛΛΟΝ agent (κάνει commits μόνος του). `git add` **ΜΟΝΟ** τα δικά σου αρχεία (§3)· **ΠΟΤΕ** `git add -A`. Έλεγχε `git log`/`git status` συχνά (αρχεία μπορεί να αλλάζουν κάτω από τα πόδια σου → Read-before-Edit).
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit. **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά — process-check ΠΡΩΤΑ (`Get-CimInstance Win32_Process | Where-Object CommandLine -like '*--noEmit*'`). Σήμερα έτρεχαν 10-11 tsc άλλων agents → ΠΕΡΙΜΕΝΕ, ΜΗΝ ξεκινήσεις δεύτερο, ΜΗΝ σκοτώσεις άλλου.
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]).
- **ADR-040:** το overlay είναι **scene-leaf** (μπαίνει στο `manager.scene`, ΟΧΙ στο `bimLayer.group`) → ΕΚΤΟΣ micro-leaf. ΑΛΛΑ αν αγγίξεις canvas/3D-edit αρχεία → CHECK 6B/6D θέλουν staged ADR (ADR-363).

---

## 0) ΤΟ ΑΙΤΗΜΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ (Giorgio)

«Όταν μετακινώ ένα **κούφωμα** βλέπω ζωντανές γραμμές/βέλη/κείμενα/διαστάσεις. Η Revit κάνει το ίδιο όταν μετακινείς **τοίχο**. **Θέλω να το υλοποιήσεις και για τη μετακίνηση τοίχου**, όπως οι μεγάλοι παίκτες (Revit). FULL ENTERPRISE + FULL SSOT.»

### Τι κάνει η Revit όταν μετακινείς ΤΟΙΧΟ (η κρίση μου, Revit-grounded — επιβεβαιώθηκε στον Giorgio):
- **ΝΑΙ**, εμφανίζει temporary/listening dimensions (ίδιο paradigm με τα κουφώματα: live + numeric input).
- **Σημείο εκκίνησης** = ο μετακινούμενος τοίχος, από **άξονα (centerline)** Ή **παρειά (face)** — project ρύθμιση (Revit: Manage → Additional Settings → Temporary Dimensions· επιλογές: Wall centerlines / Wall faces / Faces of core / Center of core).
- **Στόχος** = τα **πλησιέστερα reference εκατέρωθεν** (τυπικά ≤2 διαστάσεις, μία ανά πλευρά): γειτονικοί **παράλληλοι** τοίχοι (κάθετη απόσταση), **grid lines**, **reference planes**· στα άκρα και **κάθετοι** τοίχοι.
- Ο χρήστης σύρει τα μπλε grips / **Tab** για αλλαγή witness point (centerline↔face). (Phase 2+, όχι τώρα.)

**ΠΡΟΣΟΧΗ — ΓΕΩΜΕΤΡΙΚΗ ΔΙΑΦΟΡΑ από το κούφωμα:** το κούφωμα μετράει **1D κατά μήκος του host άξονα**. Ο τοίχος μετακινείται **πλευρικά** → οι διαστάσεις είναι **κάθετη απόσταση** προς **παράλληλους** reference (διαφορετική μηχανή references· βλ. §5). Το **rendering** + το **junction-face concept** ΕΙΝΑΙ reusable· η **reference-resolution** ΟΧΙ άμεσα.

---

## 1) ΠΟΥ ΕΙΜΑΣΤΕ — τι ΗΔΗ έγινε (μη το ξαναφτιάξεις)

**ADR-363 Φ1G.5 temporary dimensions για ΚΟΥΦΩΜΑΤΑ — DONE (Slice 2f) + live moving hole (Slice 2g):**
- **Slice 2f Phase 1:** 3Δ drag κουφώματος → ≤2 μπλε witness lines (παρειά→πλησιέστερη αναφορά) + ζωντανός αριθμός· transient read-model. `TempOpeningDimOverlay` (scene-leaf, reuse `createDimension3DRenderer`). Visual: 48px screen-constant label, μαύρο text outline (halo), axis-centred layout, always-on-top.
- **Slice 2f junction-aware:** όταν η αναφορά είναι «άκρο τοίχου» σε L/T junction → μέτρηση από την **κοντινή ΠΑΡΕΙΑ** του εγκάρσιου (`resolveJunctionFaceInsetMm`, reuse wall-trim `penetrationBevel`).
- **Slice 2g (μόλις τώρα):** η τρύπα + το συμπαγές κούφωμα ακολουθούν live το drag (`buildOpeningHostWallPreview` + `OpeningHostWallPreview` swap manager).
- **27 + 10 tests PASS.** Όλα 🔴 pending commit (ο Giorgio committάρει).

**⛔ ΜΗΝ ξαναβάλεις μαύρο περίγραμμα στις ΠΡΑΣΙΝΕΣ/μπλε ΓΡΑΜΜΕΣ+ΒΕΛΗ** (αφαιρέθηκε σκόπιμα, Giorgio «πολύ παχύ»)· το outline στα **κείμενα** ΜΕΝΕΙ.

---

## 2) 🧩 SSOT ΧΑΡΤΗΣ — ΤΙ ΝΑ REUSE (FULL SSOT, μηδέν νέα μηχανή renderer/junction)

| Τι | Αρχείο | Σημείωση |
|----|--------|----------|
| **3Δ dimension renderer** `createDimension3DRenderer(dim, layoutOverride?)` | `bim-3d/dimensions/Dimension3DRenderer.ts` | ΑΥΤΟΛΕΞΕΙ reuse· `BimDimension3D` aligned/billboard· `AXIS_LAYOUT={dimLineOffset:0,textOffset:0}` |
| **overlay πρότυπο (scene-leaf)** `TempOpeningDimOverlay` | `bim-3d/placement/TempOpeningDimOverlay.ts` | **ΠΡΟΤΥΠΟ** — κλώνε/γενίκευσε για τοίχο (screen-constant label, halo, always-on-top ΗΔΗ λυμένα μέσα του) |
| **junction «μέχρι την παρειά»** `resolveJunctionFaceInsetMm` / `penetrationBevel` | `bim/walls/opening-junction-refs.ts` / `bim/walls/wall-trims-corner-resolve.ts` | reuse για centerline↔face του reference τοίχου |
| **wall-junction detection** `classifyPair`, `lineLineIntersect`, `sinAngleBetween`, `JOIN_THRESHOLD_MM` (exported) | `bim/walls/wall-trims*.ts` | για «ποιοι τοίχοι είναι reference» — ΜΗΝ γράψεις νέα intersection math |
| **wall axis/faces** `getWallAxisVertices`, `wall.geometry.outerEdge/innerEdge`, `wall.params.thickness/start/end` | `bim/geometry/wall-geometry.ts` | scene-units· `mmToSceneUnits` για mm |
| **3Δ live move (gizmo)** `applyLivePreview`→`applyMove` | `bim-3d/animation/bim3d-edit-live-preview-apply.ts` + `bim3d-edit-interaction-handlers.ts` | **ΕΔΩ** ζει η μετακίνηση τοίχου (rigid translation)· εδώ μπαίνει το overlay hook-in (≠ opening: ΔΕΝ υπάρχει dedicated hook) |
| **plan→world** `dxfPlanToWorld`, `worldToDxfPlan`, `getPixelWorldSize` | `bim-3d/viewport/coordinate-transforms.ts` | ήδη τα χρησιμοποιεί το TempOpeningDimOverlay |

---

## 3) 📁 ΠΙΘΑΝΑ ΑΡΧΕΙΑ (git add ΜΟΝΟ δικά σου — επιβεβαίωσε στο Plan)
**NEW (πιθανά):**
- `bim/walls/wall-move-dim-references.ts` (pure: μετακινούμενος τοίχος + όλοι οι τοίχοι/grids → ≤2 references ανά πλευρά + κάθετες αποστάσεις mm). **ΕΔΩ η ΝΕΑ λογική** (όχι στο opening-dim-references — διαφορετική γεωμετρία).
- `bim-3d/placement/TempWallMoveDimOverlay.ts` (scene-leaf, mirror `TempOpeningDimOverlay`· reuse `createDimension3DRenderer`). **Ή** γενίκευση του υπάρχοντος overlay (αν βγει καθαρό SSoT).
- `__tests__` για τα δύο.

**MOD (πιθανά — ΟΛΑ shared/hot, ΠΡΟΣΟΧΗ):**
- `bim-3d/animation/bim3d-edit-live-preview-apply.ts` (hook-in: όταν `applyMove` μετακινεί έναν τοίχο → update overlay· hide στο commit/cancel). ⚠️ shared με in-flight ADR work — minimal touch.
- `docs/.../ADR-363-bim-drawing-mode.md` (§12 changelog), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, memory `project_adr363_2d_move_from_point`.

---

## 4) 🔴 ΤΟ NEXT — Plan Mode (πάρε ΕΣΥ τις Revit αποφάσεις)

**Αλγόριθμος (πρόταση — οριστικοποίησέ τον στο Plan):**
1. **Trigger:** στο 3Δ gizmo move, όταν η μετακινούμενη οντότητα είναι `wall` (single) → ενεργοποίησε overlay (mirror του τρόπου που το opening drive-άρει το `TempOpeningDimOverlay`). Βρες στο `bim3d-edit-live-preview-apply` πού γνωρίζεις «ποιο entity + live translation».
2. **References (NEW pure SSoT):** δοθέντος του μετακινούμενου τοίχου (live θέση) + όλων των τοίχων:
   - βρες **παράλληλους** reference τοίχους εκατέρωθεν (sinAngle≈0 → παράλληλοι· `sinAngleBetween`)· πάρε τον πλησιέστερο ανά πλευρά (κάθετη απόσταση centerline↔centerline, ή →face μέσω `resolveJunctionFaceInsetMm`/perp-offset).
   - (Phase 1 v1: μόνο παράλληλοι reference τοίχοι· grids/reference-planes/κάθετοι = FUTURE.)
   - **απόφαση centerline vs face:** Revit default = ρύθμιση· v1 πάρε **centerline→centerline** (απλό, σταθερό) Ή **face→face** — ΕΣΥ Revit-decision, τεκμηρίωσέ το.
3. **Render:** ≤2 `BimDimension3D` (aligned, κάθετα στον τοίχο, axis-centred layout) μέσω `createDimension3DRenderer` — ΙΔΙΟ visual με τα κουφώματα (48px, halo στο κείμενο, always-on-top).
4. **Transient:** μηδέν persistence· εξαφανίζονται στο release (όπως το opening overlay).

**ΚΡΙΣΙΜΟ Recognition ΠΡΙΝ κώδικα:** (α) πού στο `bim3d-edit-live-preview-apply`/handlers ξέρεις «wall + live world translation»· (β) reuse vs νέο overlay (αν το `TempOpeningDimOverlay` γενικεύεται καθαρά → προτίμησέ το· αλλιώς νέο sibling)· (γ) units (scene vs mm).

**🔵 FUTURE (ΟΧΙ τώρα):** grids/reference-planes/κάθετοι reference· centerline↔face Tab toggle· numeric input (listening)· 2Δ parity (PreviewCanvas)· επέκταση και σε column/beam move.

---

## 5) RECOGNITION (ΠΡΙΝ κώδικα — επιβεβαίωσε)
1. `TempOpeningDimOverlay.ts` + `opening-dim-references.ts` + `opening-junction-refs.ts` (πώς δουλεύουν — τι reuse-άρεται, τι ΟΧΙ).
2. `bim3d-edit-live-preview-apply.ts` `applyLivePreview`/`applyMove` + `bim3d-edit-interaction-handlers.ts` (entry point μετακίνησης τοίχου· πού capture-άρεις translation + entityType).
3. `wall-trims*.ts` (`classifyPair`/`sinAngleBetween`/`lineLineIntersect`) — reuse για παράλληλο/reference detection.
4. `wall-geometry.ts` (`getWallAxisVertices`, outer/inner edges) + units (`mmToSceneUnits`).
5. Υπάρχει ήδη «nearest parallel wall» helper; (ΨΑΞΕ — αν ναι, reuse· αν όχι, νέο pure.)

---

## 6) TESTS / TSC / DOCS
- **Tests:** pure `wall-move-dim-references` (παράλληλος εκατέρωθεν → κάθετη απόσταση· κανένας → null/skip· centerline vs face)· overlay wiring (mirror `TempOpeningDimOverlay.test`).
- **tsc:** background, **N.17 process-check ΠΡΩΤΑ** (έτρεχαν 10-11 άλλων agents).
- **N.15 docs:** ADR-363 §12 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr363_2d_move_from_point`. **ΜΗΝ** adr-index.

## 7) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ γράψεις νέο dimension renderer / νέα intersection math (reuse §2).
- ΜΗΝ βάλεις τη wall-reference λογική μέσα στο `opening-dim-references.ts` (διαφορετική γεωμετρία → νέο αρχείο).
- ΜΗΝ ξαναβάλεις μαύρο περίγραμμα στις γραμμές/βέλη (μόνο κείμενα).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.
- ΜΗΝ αγγίξεις το `bim3d-edit-live-preview` swap-class εσωτερικά (owned by in-flight ADR) — μόνο hook-in από το apply layer.

## 8) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + `git log -5` + `git status`.
2. Recognition §5 (1-5).
3. Plan Mode → file-level σχέδιο (§4) + Revit decisions (centerline/face, ποια references v1) + εκτίμηση → έγκριση Giorgio.
4. Υλοποίηση + tests + tsc(N.17) + docs(N.15).

## 9) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (πλήρες ιστορικό Slice 2d/2e/2f/2g)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
