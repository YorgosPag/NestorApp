# HANDOFF — ADR-404 Phase 3: 2Δ προβολή κλίσης στο cut plane (Revit-style) + section parity

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 — μετά το Phase 2 (gizmo X/Z rings → tilt εντολές)
**ADR:** ADR-404 — 3D BIM Element Tilt (Slope-Based, All Axes)
**Plan file:** `C:\Users\user\.claude\plans\sprightly-moseying-mccarthy.md` (APPROVED) — §Phase 3
**Μοντέλο:** Opus 4.8 (5+ αρχεία: geometry + 2Δ sections· cross-cutting math). Plan Mode.
**Commit:** **Ο Giorgio κάνει το commit — ΠΟΤΕ ο agent** (N.(-1)).
**⚠️ Το working tree μοιράζεται με άλλον agent** (ADR-401 Phase G.3 — stair vertical resize). Βλ. §6.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
1. **`git status` / `git log`** — δες τι έχει κάνει commit ο Giorgio. **ΜΗΝ αγγίξεις αρχεία άλλου agent, ΠΟΤΕ `git add -A`, ΠΟΤΕ commit/push/`--no-verify`.**
2. **Διάβασε ADR-404** (`docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md`) — ειδικά «Phase 1 DONE», «Phase 2 DONE», «Phase 3 PENDING».
3. **Διάβασε memory:** `project_adr404_3d_bim_tilt.md`.
4. **Phase 1 RECOGNITION** πριν κώδικα (βλ. §3) — ΚΥΡΙΩΣ: επιβεβαίωσε το **datum** του `cutPlaneMm` (storey-relative vs project-absolute) και τη **per-type 2Δ σημασιολογία** (κολώνα/τοίχος = πραγματική πλευρική μετατόπιση· δοκάρι/πλάκα = ίσως μόνο section, ΟΧΙ footprint shift — βλ. §4.3 ΠΡΟΣΟΧΗ).

---

## 1. ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (Phase 1+2 — η βάση, ΜΗΝ το σπάσεις)

**Phase 1 (data model + 3Δ):**
- Πεδία: `ColumnTilt {direction, angle}` + `tilt?` σε `ColumnParams`· `WallTilt {angle}` signed + `tilt?` σε `WallParams`· δοκάρι `topElevationEnd`· πλάκα `SlabSlope {direction, angle%}` + `geometryType:'tilted'`.
- **SSoT γεωμετρίας (ΑΥΤΑ ΘΑ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ):**
  - `bim/geometry/column-tilt.ts` → `columnTiltShearAt(params, heightAboveBase) → {dx,dy}` (= `height·tan·{cos,sin}(direction)`).
  - `bim/geometry/wall-tilt.ts` → `wallTiltShearAt(params, heightAboveBase) → {dx,dy}` (⟂ run).
  - `bim/geometry/beam-slope.ts` → `beamSlopeOffsetZmm(params, pt)` (Z offset κατά μήκος άξονα).
  - `bim/geometry/slab-slope.ts` → `slabSlopeOffsetZmm(params, pt)` (Z offset, signed dist × angle/100).
- 3Δ shear: `bim-3d/converters/mesh-slope-shear.ts` (`applyColumnTilt`/`applyWallTilt`/`applyBeamSlope`/`applySlabSlope`). **Flat path μόνο** (attached/openings = follow-up).

**Phase 2 (gizmo → tilt):** drag-bridge axis-generalized rotate + `tilt` outcome· `bim3d-tilt-bridge.ts` (`compute*TiltParams` + `snapTiltAngleDeg`)· `TILT_HANDLES_BY_TYPE`· live preview `buildTiltPreviewObject`· dispatch `case 'tilt'` (reuse `Update*ParamsCommand`). **Single-select μόνο.**

**ΟΡΙΟ:** το 3Δ shear + οι gizmo εντολές + το BOQ πρέπει να μείνουν **ακριβώς** όπως είναι.

---

## 2. Ο ΣΤΟΧΟΣ ΤΟΥ PHASE 3
Μέχρι τώρα η κλίση φαίνεται **μόνο στο 3Δ**. Το Phase 3 κάνει τη **2Δ κάτοψη + τις τομές** να δείχνουν την κλίση: το στοιχείο εμφανίζεται **μετατοπισμένο εκεί που το κόβει το επίπεδο τομής** (Revit «cut plane projection»). **Το BOQ μένει αμετάβλητο** (Revit = projected plan area· length/height/area ανέπαφα).

### Αποφάσεις ΗΔΗ κλειδωμένες (ΜΗ ξαναρωτήσεις):
- 2Δ = **προβολή στο cut plane** (Revit-style) — design Q&A Giorgio 2026-06-01, decision #3.
- Στοιχεία: κολώνα + τοίχος + δοκάρι + πλάκα (ΟΧΙ σκάλα).
- BOQ αμετάβλητο.

---

## 3. PHASE 1 RECOGNITION (κάν' το ΠΡΙΝ κώδικα)
1. **`cutPlaneMm` datum:** `config/bim-view-range.ts` (γρ.15 πεδίο, γρ.27 default **1200**). Επιβεβαίωσε: είναι **storey-relative** (από FFL) ή project-absolute; Η μετατόπιση κολώνας/τοίχου χρειάζεται `heightAboveBase = cutPlaneMm − baseOffset` στο **ΙΔΙΟ datum**. Δες πώς το χρησιμοποιούν οι υπάρχοντες renderers (zBottom ≤ cutPlaneMm ≤ zTop, γρ.60).
2. **Section adapters:** `bim-3d/2d-section/section-intersect.ts` έχει `toSlabPlan`/`toWallPlan` (διαβάζουν **params απευθείας** → χρειάζονται ρητό shift). Επιβεβαίωσε ότι κολώνα/δοκάρι διαβάζουν **cached geometry** (→ ρέει αυτόματα μόλις διορθώσεις το `compute*Geometry`).
3. **Reuse:** το `tiltPlanShift` για κολώνα/τοίχο ΕΙΝΑΙ το υπάρχον `columnTiltShearAt`/`wallTiltShearAt` αποτιμημένο στο `heightAboveBase = cutPlaneMm − base`. **Μην ξαναγράψεις τη math** — wrap τα.

---

## 4. ΥΛΟΠΟΙΗΣΗ — βήμα-βήμα

### 4.1 NEW κοινό SSoT `bim/geometry/cut-plane-tilt.ts`
- `tiltPlanShift(...)` — επιστρέφει την **plan μετατόπιση (mm)** του footprint στο cut plane.
- **Κολώνα/τοίχος (κατακόρυφα):** `heightAboveBase = cutPlaneMm − baseOffsetMm` → κάλεσε `columnTiltShearAt(params, heightAboveBase)` / `wallTiltShearAt(...)`. **ΑΥΤΟ είναι το Revit cut-plane offset.** Στη βάση (cutPlane=base) → 0.
- **Unit-safe:** ίδια σύμβαση με Phase 1 (`tan` αδιάστατο).

### 4.2 Geometry shift — **κολώνα + τοίχος** (η πραγματική 2Δ προβολή)
- `computeColumnGeometry` (`bim/geometry/column-geometry.ts` — `transformFootprint` γρ.318, καλείται γρ.99): μετατόπισε το footprint κατά `tiltPlanShift` πριν/μετά το transform (lateral shift στο cut plane).
- `computeWallGeometry` (`bim/geometry/wall-geometry.ts`): μετατόπισε τον άξονα start/end στο cut plane.

### 4.3 Δοκάρι + πλάκα — ⚠️ ΠΡΟΣΟΧΗ (Recognition-gated)
Το plan file λέει «`computeBeamGeometry` lateral lean shift / `computeSlabGeometry` slope→plan shift». **ΑΛΛΑ** η κλίση δοκαριού/πλάκας είναι **κατακόρυφη** (Z) — το **footprint κάτοψης ΔΕΝ μετατοπίζεται** όπως της κολώνας. Για αυτά τα στοιχεία:
- Το cut plane κόβει το κεκλιμένο σώμα → η **τομή** (section) είναι το κύριο 2Δ αποτέλεσμα.
- Επιβεβαίωσε στο Recognition αν χρειάζεται **καθόλου** plan-footprint shift για beam/slab, ή **μόνο section**. **Μη βάλεις πλασματική πλευρική μετατόπιση** αν δεν αντιστοιχεί σε Revit. (Πιθανή ορθή απόφαση: beam/slab = section-only στο Phase 3.)

### 4.4 Section parity (κρίσιμο)
- `bim-3d/2d-section/section-intersect.ts`: `toSlabPlan`/`toWallPlan` διαβάζουν params **απευθείας** → εφάρμοσε τον **ΙΔΙΟ** `tiltPlanShift`/slope offset εκεί ώστε η τομή να συμφωνεί με την κάτοψη.
- Κολώνα/δοκάρι (διαβάζουν cached geometry) → ρέουν αυτόματα από το §4.2/§4.3.

### 4.5 BOQ
**ΚΑΜΙΑ αλλαγή.** (Revit: projected plan area· length/height/area αμετάβλητα.) Αν κάποιο geometry change επηρεάζει BOQ → λάθος, ξανα-δες το.

---

## 5. REFERENCE (θέσεις-κλειδιά)
- Tilt SSoT (Phase 1): `bim/geometry/column-tilt.ts`, `wall-tilt.ts`, `beam-slope.ts`, `slab-slope.ts`.
- Geometry: `column-geometry.ts` (`transformFootprint` γρ.318)· `wall-geometry.ts`· `beam-geometry.ts` (`pickAxisVertices` γρ.101)· `slab-geometry.ts`.
- Sections: `bim-3d/2d-section/section-intersect.ts` (`toSlabPlan`/`toWallPlan`)· `section-scene-sync.ts`.
- View range: `config/bim-view-range.ts` (`cutPlaneMm` γρ.15, default 1200 γρ.27).
- Tilt-bridge (Phase 2, για context): `bim-3d/gizmo/bim3d-tilt-bridge.ts`.

---

## 6. ΠΑΓΙΔΕΣ + MULTI-AGENT
- **⚠️ Shared working tree:** άλλος agent δουλεύει **ADR-401 Phase G.3 (stair vertical resize)** — πειράζει `bim-3d/gizmo/bim-gizmo-overlay.ts` + `bim3d-resize-bridge.ts` + το test του. Υπάρχει **1 αποτυχημένο test, `bim3d-resize-bridge-stair.test.ts` (`axis-Y → null`), που είναι ΔΙΚΟ ΤΟΥΣ stale — ΟΧΙ δικό σου**. **ΜΗΝ το αγγίξεις, ΜΗΝ το «διορθώσεις».** Το Phase 3 δεν αγγίζει αυτά τα αρχεία.
- **`git add <specific>` πάντα**, verify `git diff --cached` πριν (αν ποτέ ζητηθεί staging). ΠΟΤΕ `git checkout/restore` σε αρχεία άλλου agent.
- **SlabSlope.angle = ποσοστό (%)**, ΟΧΙ μοίρες (`tan(deg)·100`). column/wall tilt.angle = **μοίρες**.
- **Units:** `cutPlaneMm`/`baseOffset` σε **mm**· το `tiltPlanShift` βγαίνει mm (ίδιο plan space με τα `compute*Geometry` inputs). Πρόσεξε meter-scenes (δες `mmScaleFor`/`inferSceneUnitsFromWidth` precedents).
- **Datum mismatch** = το #1 ρίσκο: αν το `cutPlaneMm` και το `baseOffset` δεν είναι στο ίδιο datum → η μετατόπιση βγαίνει σε λάθος ύψος.
- **ADR-040 CHECK 6B/6D:** αγγίζεις renderer/section/geometry → **stage ADR-404** μαζί.
- **Files ≤500 γρ** (N.7.1). **ΜΗΝ** διαβάσεις full bg `.output` (φουσκώνει).

---

## 7. DEFINITION OF DONE
- [ ] Phase 1 Recognition (datum `cutPlaneMm` + per-type 2Δ σημασιολογία beam/slab επιβεβαιωμένα)
- [ ] NEW `cut-plane-tilt.ts` (`tiltPlanShift` — reuse `columnTiltShearAt`/`wallTiltShearAt`, ΟΧΙ νέα math)
- [ ] `computeColumnGeometry` + `computeWallGeometry` lateral cut-plane shift
- [ ] beam/slab: section-only ή footprint shift **σύμφωνα με το Recognition** (όχι πλασματικό)
- [ ] Section parity: `toSlabPlan`/`toWallPlan` εφαρμόζουν τον ΙΔΙΟ shift
- [ ] BOQ **αμετάβλητο** (verify)
- [ ] `npx jest src/subapps/dxf-viewer/bim/geometry src/subapps/dxf-viewer/bim-3d/2d-section` PASS + `npx tsc --noEmit` 0 (φιλτράρισε στα αρχεία σου)
- [ ] ADR-404 changelog «Phase 3» + status «Phase 1+2+3 DONE» + trackers N.15 (ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + memory `project_adr404_3d_bim_tilt`)
- [ ] 🔴 Browser verify Giorgio: γερμένο στοιχείο → κάτοψη δείχνει μετατοπισμένο footprint στο cut plane· τομή σωστή· BOQ ίδιο
- [ ] **Ο Giorgio κάνει το commit — ΟΧΙ εσύ**

---

## 8. ΕΚΚΡΕΜΟΤΗΤΕΣ ΜΕΤΑ ΤΟ PHASE 3 (follow-ups, εκτός phases)
- Flat-path limitation: attached-to-host κολώνα/τοίχος + τοίχος με ανοίγματα δεν γέρνουν (3Δ ΟΥΤΕ 2Δ).
- Multi-select tilt (τώρα single-only).
- Accumulate-across-planes κολώνα (τώρα set-per-plane).
- 🔴 Browser verify Phase 1+2 (αν δεν έγινε ακόμα) — ειδικά το **sign/πλευρά** του tilt (trivial flip στο `bim3d-tilt-bridge.ts` αν χρειαστεί).
