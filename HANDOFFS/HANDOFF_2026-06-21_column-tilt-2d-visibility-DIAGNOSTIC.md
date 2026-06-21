# HANDOFF (ΔΙΑΓΝΩΣΤΙΚΟ) — Κλίση κολώνας: ορατότητα στον 2Δ καμβά

**Date:** 2026-06-21 · **Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ** (CLAUDE.md LANGUAGE RULE).
**Τύπος:** 🟡 DIAGNOSTIC / «investigate-if-recurs» — **ΟΧΙ confirmed bug, ΟΧΙ έτοιμο fix.**
**Working tree:** ⚠️ **ΚΟΙΝΟ με άλλον agent**. Stage ΜΟΝΟ δικά σου. **COMMIT/PUSH = ΜΟΝΟ ο Giorgio.**
**Διάβασε ΠΡΩΤΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (όραμα) ·
`ADR-404-3d-bim-element-tilt.md` (το σύστημα κλίσης) · `ADR-470` (structural-component visibility gate).

---

## 🎯 ΤΟ ΣΥΜΠΤΩΜΑ (Giorgio)

«Όταν **πλαγιάζω** (κλίνω / κάνω λοξή) μια **κολώνα**, η κλίση **δεν αναπαριστάνετο** στον 2Δ καμβά.
Δούλευε πριν, χάλασε σε άγνωστη στιγμή.» — **ΑΛΛΑ στην ίδια συνεδρία (2026-06-21) ο Giorgio είδε ότι
ΕΜΦΑΝΙΖΕΤΑΙ ξανά**, χωρίς να ξέρει τι άλλαξε. Άρα: **διακοπτόμενη ορατότητα**, ΟΧΙ μόνιμη απουσία.

## ✅ ΣΥΜΠΕΡΑΣΜΑ ΕΡΕΥΝΑΣ (2 Explore agents, 2026-06-21)

**Ο κώδικας του tilt pipeline είναι ΑΚΕΡΑΙΟΣ — δεν βρέθηκε commit που να τον σπάει.** Η αλυσίδα 2Δ:

```
ColumnRenderer.render()
  → columnCutPlaneShiftCanvas(column.params, useDrawingScaleStore.getState().viewRange.cutPlaneMm)  [cut-plane-tilt.ts]
      → isColumnTilted(params)                         [column-tilt.ts — params.tilt && angle!==0]
      → columnTiltShearAt(params, cutHeightAboveBase)  [column-tilt.ts — height·tan(angle) shear, SSoT]
  → αν null  → flat path (καμία μετατόπιση)
  → αν shift → ctx.save()+ctx.translate(d) → σχεδίαση σώματος → ctx.restore()
             → drawCutPlaneTiltProjection(verts, shift, ...)  [base outline + connecting lines]
```

## 🔍 ΓΙΑΤΙ «ΑΛΛΟΤΕ ΦΑΙΝΕΤΑΙ / ΑΛΛΟΤΕ ΟΧΙ» — 2 αιτίες (καμία ΔΕΝ είναι σίγουρα bug)

### 1️⃣ ΠΙΟ ΠΙΘΑΝΟ — η 2Δ κλίση είναι **cut-plane-dependent** (by design, σαν Revit)
Η 2Δ αναπαράσταση = **μετατόπιση της κορυφής στο ΥΨΟΣ ΤΟΥ CUT-PLANE**, ΟΧΙ σταθερό «πλάγιασμα»:
```
shift = cutHeightAboveBase(cutPlaneMm, baseOffset, height) × tan(angle)     [cut-plane-tilt.ts]
```
→ **Αν `viewRange.cutPlaneMm` ≈ βάση κολώνας (ή κάτω) → `cutHeightAboveBase = 0` → shift = 0 → ΚΑΜΙΑ ορατή κλίση.**
Όταν αλλάζει **ενεργός όροφος / view-range / cut-plane elevation** (ή η κολώνα έχει `baseOffset` πάνω από
το cut-plane), η κλίση «εμφανίζεται». **Πιστό στη Revit** (plan cut-plane). **Πιθανότατα αυτό συνέβη.**
- SSoT cut-plane: `useDrawingScaleStore.getState().viewRange.cutPlaneMm`. Έλεγξε ποιος/πότε το θέτει + το default.

### 2️⃣ ΔΕΥΤΕΡΕΥΟΝ (latent) — ADR-470 core-visibility early-return
Commit **`db0bbd9a` (2026-06-17)** πρόσθεσε **πριν** το tilt block στον `ColumnRenderer` (~γρ. 87-95):
```ts
if (!isStructuralComponentVisible('core', column)) { this.finalizeRender(entity, options); return; }
```
Αν το 'core' component είναι κρυμμένο (per-view flag / λάθος default στο render-settings store) → **όλη η
κολώνα** (μαζί με την κλίση) δεν ζωγραφίζεται. **ΑΛΛΑ** αυτό κρύβει **ΟΛΟΚΛΗΡΗ** την κολώνα, όχι μόνο την
κλίση — οπότε λιγότερο πιθανό ως το συγκεκριμένο σύμπτωμα. Αξίζει έλεγχο μόνο αν «χανόταν όλη η κολώνα».

### 3️⃣ Edge-case persistence (χαμηλό) — `tilt: {direction:0, angle:0}` αντί `undefined`
`column-firestore-service.ts` `stripUndefinedDeep(params)`: αν παλιός κώδικας έσωσε μηδενικό tilt αντί
`undefined`, το `isColumnTilted` το διαβάζει `false` (αβλαβές). Αν χάθηκε **μη-μηδενικό** angle σε
save/reload → θα ήταν persistence bug, ΟΧΙ renderer. (Δεν επιβεβαιώθηκε.)

---

## 🗂️ ΑΚΡΙΒΗ ΣΗΜΕΙΑ (αν ξανασυμβεί — από πού να ξεκινήσεις)

| Ρόλος | Αρχείο | Σημείο |
|---|---|---|
| Data model κλίσης | `bim/types/column-types.ts` | `ColumnTilt {direction, angle}` (~225) · `ColumnParams.tilt?` (~239, ADR-404) |
| Math SSoT | `bim/geometry/column-tilt.ts` | `isColumnTilted` (~40) · `columnTiltShearAt` height·tan (~48) |
| 2Δ shift feeder | `bim/geometry/cut-plane-tilt.ts` | `columnCutPlaneShiftMm`/`...Canvas` (~41/67· null όταν shift=0) |
| 2Δ renderer | `bim/renderers/ColumnRenderer.ts` | core-gate early-return (~87) · `_tiltShift`+`ctx.translate` (~102-110) · `drawCutPlaneTiltProjection` (~180-185) |
| 2Δ projection draw | `bim/renderers/cut-plane-tilt-projection.ts` | base outline + connecting lines (~47-83) |
| Cut-plane store | `useDrawingScaleStore` → `viewRange.cutPlaneMm` | ποιος το θέτει / default / ανά όροφο |
| 3Δ (σύγκριση) | `bim-3d/converters/mesh-slope-shear.ts` `applyColumnTilt` (~74) · `bim-three-structural-converters.ts` (~97,137) | per-vertex shear (ΙΔΙΟΣ SSoT· 3Δ shear το mesh, 2Δ κάνει render-time translate) |
| UX ορισμός κλίσης | `bim-3d/gizmo/bim3d-tilt-bridge.ts` `computeColumnTiltParams` (~101) | ΜΟΝΟ μέσω 3Δ gizmo X/Z rings → `UpdateColumnParamsCommand`. **Δεν υπάρχει ribbon field για tilt.** |

**Σχετικά commits (ColumnRenderer):** `6866899a`/`bbd06f1d` (2026-06-01, πρώτη 2Δ tilt projection) · `60dbc819`
(2026-06-13, split refactor — tilt διατηρήθηκε) · `db0bbd9a` (2026-06-17, ADR-470 core-gate — νέο early-return)
· `6079457c` (2026-06-11, `transformFootprint`→`centredPolyToWorld` SSoT).

---

## 🚧 ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (αν προκύψει υλοποίηση)
- **ΠΡΙΝ ΚΑΘΕ ΚΩΔΙΚΑ → πραγματικό SSoT AUDIT (grep)** ώστε να **reuse** υπάρχοντα, μηδέν διπλότυπα. Audit greps:
  ```
  rg -n "isColumnTilted|columnTiltShearAt|columnCutPlaneShift|cutHeightAboveBase" src/subapps/dxf-viewer
  rg -n "isStructuralComponentVisible|structural-component-visib|'core'" src/subapps/dxf-viewer/bim
  rg -n "viewRange|cutPlaneMm|useDrawingScaleStore" src/subapps/dxf-viewer
  rg -n "drawCutPlaneTiltProjection|cut-plane-tilt-projection" src/subapps/dxf-viewer
  rg -n "applyColumnTilt|mesh-slope-shear|isBeamTilted|wallCutPlaneShift" src/subapps/dxf-viewer
  ```
- **FULL ENTERPRISE + FULL SSOT, Revit-grade.** No `any`/`as any`/`@ts-ignore`. Files ≤500, functions ≤40. i18n (N.11). Enterprise IDs (N.6).
- **Tilt SSoT = `column-tilt.ts`** (`isColumnTilted`/`columnTiltShearAt`). 2Δ + 3Δ + section-intersect **ΗΔΗ** το μοιράζονται — **ΜΗΝ** γράψεις νέα math κλίσης.
- ⚠️ Ο `ColumnRenderer` αγγίζει **ADR-040 CHECK 6B/6D** → stage ADR-040. Shared tree: stage ΜΟΝΟ δικά σου.
- **N.17:** ΕΝΑ tsc τη φορά. **COMMIT/PUSH = ΜΟΝΟ Giorgio.**

## ✅ ΤΙ ΝΑ ΕΠΙΒΕΒΑΙΩΣΕΙΣ ΠΡΩΤΑ (browser, πριν αγγίξεις κώδικα)
1. Φτιάξε λοξή κολώνα (3Δ gizmo X/Z ring). Στο 2Δ: **άλλαξε cut-plane / ενεργό όροφο** → δες αν η μετατόπιση
   εμφανίζεται/μεγαλώνει με το ύψος cut-plane. **Αν ναι → είναι το cut-plane mechanism (αναμενόμενο, ΟΧΙ bug).**
2. Δες αν ΟΛΗ η κολώνα χάνεται ποτέ (όχι μόνο η κλίση) → τότε ύποπτος ο ADR-470 core-gate.
3. Reload (Firestore): η λοξή κολώνα κρατά το `tilt`; (edge-case #3).

**Αν #1 το εξηγεί → δεν υπάρχει bug· το πολύ UX βελτίωση (π.χ. σταθερό «slanted» glyph ανεξάρτητο cut-plane,
αν ο Giorgio το θέλει σαν κάποια CAD).** Πες το στον Giorgio πριν υλοποιήσεις.
