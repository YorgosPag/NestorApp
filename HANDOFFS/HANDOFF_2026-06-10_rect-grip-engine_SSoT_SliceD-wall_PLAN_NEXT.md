# HANDOFF — rect-grip-engine SSoT (ADR-436/363/397) + 2 label bugs + Slice D (τοίχος)

**Date:** 2026-06-10 · **Model:** Opus · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα)

> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: ΕΝΑ tsc τη φορά. Renderer/ghost touch → stage ADR-040 changelog (CHECK 6B/6D). **Απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.**
>
> 🎯 **Στόχος ποιότητας (Giorgio):** FULL ENTERPRISE + FULL SSOT, όπως Revit. **SEARCH FIRST** για υπάρχον SSoT πριν γράψεις νέο κώδικα (μάθημα αυτής της συνεδρίας — βλ. §4).

---

## 1. ΤΙ ΕΓΙΝΕ (DONE — pending browser-verify + commit από Giorgio)

Ενοποίηση των grips όλων των **ορθογώνιων** BIM entities σε **ΕΝΑ** rotated-rectangle grip core. Giorgio: «4 γωνίες + 2 edge midpoints + rotation = 7 λαβές, παντού ίδιος κώδικας, SSoT».

### NEW αρχεία
- `bim/grips/rect-frame.ts` — `RectFrame {center, rotationDeg, halfWidth, halfLength}` (scene units) + `rectCornerWorld` / `rectEdgeWorld` / `RECT_CORNERS`. **Pure γεωμετρία.**
- `bim/grips/rect-grip-engine.ts` — `applyRectCornerDrag(frame, corner, delta, limits, ortho?)` (opposite **corner** fixed) + `applyRectEdgeDrag(frame, edge, delta, limits)` (opposite **edge** fixed). Clamp-aware back-derived centre shift.
- `bim/grips/__tests__/rect-grip-engine.test.ts` — 14 tests.
- `bim/columns/column-rect-adapter.ts` — `columnToRectFrame`/`rectFrameToColumnParams` (preserve anchor) + `applyRectColumnGrip` (returns `null` για non-rect) + `rectColumnCornerGrips` + `isRectColumn`.

### MOD αρχεία
- `bim/foundations/foundation-grips.ts` — pad adapter (`padToRectFrame`/`rectFrameToPadParams`) + 7-grip emission + `applyFoundationGripDrag` routing corner/edge→engine. **Αφαιρέθηκαν** `resizeWidth`/`resizeLength`/`projectDeltaToLocal` (dead-code).
- `bim/columns/column-grips.ts` (477 LOC) — emission +4 corners (rect/shear-wall) + delegation `applyRectColumnGrip` πριν τα variant handlers.
- `hooks/grip-kinds.ts` — `FoundationGripKind` += `foundation-corner-{ne,nw,sw,se}`· `ColumnGripKind` += `column-corner-{ne,nw,sw,se}`.
- `bim/grips/centred-box-grips.ts` — **ΕΝΟΠΟΙΗΣΗ:** τώρα **consumer** του engine (`cornerWorld`→`rectCornerWorld`, `resizeCorner`→`applyRectCornerDrag`+ORTHO). Διαγράφηκε το διπλότυπο γεωμετρικό core. **Τα 8 entities που το χρησιμοποιούν ΑΝΕΓΓΙΧΤΑ** (mep-fixture/electrical-panel/water-heater/manifold/boiler/radiator/furniture/floorplan-symbol).
- `rendering/ghost/draw-ghost-entity.ts` — **GHOST FIX:** πρόσθεσε `case 'foundation'` + `case 'floor-finish'` (έλειπαν → δεν φαινόταν live φάντασμα σε drag).
- `hooks/tools/useGripDimAnnotation.ts` — corner labels `w= l=` (pad) / `w= d=` (column).
- Docs: ADR-436 (§4.3 + Slice 1c changelog + status), ADR-363 (Slice C entry), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

### Semantics (LOCKED, Revit/AutoCAD)
- **Corner drag** → απέναντι **γωνία** σταθερή· dragged corner ακολουθεί κέρσορα 1:1· κέντρο μετατοπίζεται κατά το μισό.
- **Edge drag** → απέναντι **ακμή** σταθερή· μόνο η μία διάσταση αλλάζει.
- Αντικατέστησε το προηγούμενο anchor-symmetric width/depth/length resize (foundation+column rect/shear-wall).

### Verify state
- **996/996 jest** (68 suites: engine 14 + foundation 27 + column 352 + 8 centred-box consumers + …). **tsc καθαρό** (μόνο pre-existing `mesh-to-object3d` + `proposal-ghost-3d-builders` errors άλλου agent).
- 🔴 **Pending Giorgio browser-verify:** πέδιλο 7 λαβές + φάντασμα· κολώνα (rect/shear-wall) 7 λαβές· κολώνα L/T/I/U/circular/polygon αμετάβλητες.

---

## 2. ΕΚΚΡΕΜΟΤΗΤΕΣ (η δουλειά της νέας συνεδρίας)

### 🔴 BUG 1 — Hover dimension label: μικρά γράμματα → μεγάλωσέ τα
- **Συμπεριφορά:** hover πάνω σε πέδιλο → φωτίζεται + ταμπέλα διαστάσεων (λευκό φόντο, μαύρα γράμματα), **πολύ μικρή για να διαβαστεί**.
- **Πού:** ο hover dimension renderer (ΔΕΝ εντοπίστηκε ακριβώς — grep `utils/hover/`, hover dimension overlay, ή αν χρησιμοποιεί το `rendering/utils/canvas-pill.ts` `PILL_FONT`). **SEARCH FIRST**: πιθανώς κοινό pill με το drag label (canvas-pill). Αν ναι, αύξησε `PILL_FONT` **κεντρικά** (SSoT) — αλλά πρόσεξε μην χαλάσεις άλλα labels· ίσως χρειάζεται ξεχωριστή hover-font σταθερά.

### 🔴 BUG 2 — Drag dimension label: κάθετη ΑΝΤΙΣΤΡΟΦΗ (οριζόντια σωστά)
- **Συμπεριφορά:** σέρνω χερούλι → 2η ταμπέλα· οριζόντια ακολουθεί σωστά, **κάθετα αντίστροφα** (κέρσορας πάνω → ταμπέλα κάτω).
- **ROOT CAUSE (εντοπίστηκε):** `hooks/tools/useGripDimAnnotation.ts:69-71` έχει **δικό του** `worldToScreen` που **ΔΕΝ κάνει Y-flip**:
  ```ts
  function worldToScreen(p, t) { return { x: p.x*t.scale + t.offsetX, y: p.y*t.scale + t.offsetY }; }
  ```
  Το canonical (που χρησιμοποιεί `draw-ghost-entity.ts`) είναι `CoordinateTransforms.worldToScreen(p, transform, viewport)` και κάνει το σωστό Y-flip.
- **ENTERPRISE/SSoT FIX:** αντικατέστησε το local duplicate με το canonical `CoordinateTransforms.worldToScreen` SSoT (διορθώνει την αντιστροφή **ΚΑΙ** σβήνει διπλότυπο). Έλεγξε signature/viewport param. Επηρεάζει και column/beam labels (ίδιο drawFrame) — re-verify.

### 🔴 SLICE D — Τοίχος (straight) → rect-grip-engine (το ΤΕΛΕΥΤΑΙΟ rect entity· υψηλό ρίσκο)
**Στόχος:** ο ίσιος τοίχος να χρησιμοποιεί τον κοινό engine για corners + **να αποκτήσει 2 edge midpoints** → 7 λαβές, ίδιος κώδικας με πέδιλο/κολώνα.

**Τρέχουσα κατάσταση τοίχου** (`bim/walls/wall-grips.ts` + `wall-grip-transforms.ts`):
- Ίσιος τοίχος **ήδη** εκπέμπει 4 γωνίες (`wall-corner-{start,end}-{pos,neg}`) + rotation (5 λαβές). Τα `wall-start/end/thickness/midpoint` υπολογίζονται αλλά **φιλτράρονται**.
- Μοντέλο τοίχου = **άξονας** (`start`,`end`) + `thickness` + `flip` (ΟΧΙ anchor+W×L+rotation όπως column/pad). Γι' αυτό χρειάζεται **wall adapter**: `wallToRectFrame` (centre = axis midpoint, halfWidth = μισό μήκος άξονα, halfLength = thickness/2, rotationDeg = γωνία άξονα) + `rectFrameToWallParams` (πίσω σε start/end/thickness).
- ⚠️ **ΡΙΣΚΑ (γιατί ο τοίχος είναι ο δύσκολος):** `rectFrameToWallParams` πρέπει να: **διατηρεί `flip`**, **καθαρίζει `startMiter`/`endMiter`** (absolute junction points — σπάνε σε resize, βλ. `moveStart`/`moveEnd`), **κάνει drop `dna`** (manual override, βλ. `resizeThickness`/`moveCorner`), **clamp thickness** scene-unit-aware (`minThicknessFloorFor`/`maxThicknessCeilingFor`). Καμπύλος/polyline τοίχος = **ΕΞΩ** (δικός τους κώδικας).
- **Edges:** πρόσθεσε 2 edge-midpoint grips (`wall-edge-length` + `wall-edge-thickness` ή reuse `wall-thickness`) μέσω `applyRectEdgeDrag`. Σήμερα τα 2 `wall-thickness` handles είναι suppressed — un-suppress ως edge midpoints.
- **Pattern για να ακολουθήσεις:** `column-rect-adapter.ts` (ίδιο σχήμα: `wallToRectFrame`/`rectFrameToWallParams`/`applyRectWallGrip` returns null για curved/polyline). Routing στο `applyWallGripDrag` (πριν τα bespoke corner handlers).
- **ADR-040:** ο τοίχος είναι performance-critical — διάβασε ADR-040 + stage το (CHECK 6B/6D). ADR-363 §6 Phase 1C/1C-bis docstrings.
- Tests: ενημέρωσε `wall-grips.test.ts` (corner semantics: τώρα opposite-corner-fixed via engine αντί για το ασύμμετρο axial/perp· επιβεβαίωσε ισοδυναμία ή κατέγραψε αλλαγή).

---

## 3. ENGINE API (reference για Slice D)

```ts
// rect-frame.ts
interface RectFrame { center: Point2D; rotationDeg: number; halfWidth: number; halfLength: number; } // scene units
rectCornerWorld(frame, {sx:±1, sy:±1}): Point2D
rectEdgeWorld(frame, {axis:'x'|'y', sign:±1}): Point2D
RECT_CORNERS // [{1,1},{-1,1},{-1,-1},{1,-1}] NE,NW,SW,SE

// rect-grip-engine.ts
applyRectCornerDrag(frame, corner, worldDelta, {minHalfWidth,minHalfLength}, ortho?): RectFrame  // opposite corner fixed
applyRectEdgeDrag(frame, {axis,sign}, worldDelta, limits): RectFrame                              // opposite edge fixed
```
**Adapter pattern:** `xToRectFrame(params)→RectFrame` (centre+half-extents σε scene units via `mmScaleFor`) · `rectFrameToXParams(frame, params)→Params` (πίσω σε mm + entity semantics: anchor/flip/miters/dna/clamp). Engine = pure geometry· adapter = entity semantics.

---

## 4. ΜΑΘΗΜΑ (Giorgio code review αυτής της συνεδρίας)
Αρχικά έφτιαξα `rect-grip-engine` ΧΩΡΙΣ να ψάξω → **υπήρχε ήδη** `centred-box-grips.ts` (SSoT για centre-anchored rotatable box, 8 consumers, με 4 corners + opposite-corner-fixed resize). Ήταν **μερικό διπλότυπο**. Διόρθωση: το centred-box έγινε consumer του engine. **ΠΑΝΤΑ SEARCH FIRST** (`grep` για υπάρχον SSoT: centred-box / grip-math / shared helpers) πριν γράψεις νέο grip/geometry κώδικα.

---

## 5. QUICK COMMANDS
```
npx jest src/subapps/dxf-viewer/bim/grips src/subapps/dxf-viewer/bim/foundations src/subapps/dxf-viewer/bim/columns src/subapps/dxf-viewer/bim/walls --silent
# 8 centred-box consumers regression:
npx jest src/subapps/dxf-viewer/bim/mep-fixtures src/subapps/dxf-viewer/bim/electrical-panels src/subapps/dxf-viewer/bim/furniture --silent
```
