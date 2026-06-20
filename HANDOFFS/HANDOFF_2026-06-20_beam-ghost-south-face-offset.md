# HANDOFF — Beam ghost: η παρειά του φαντάσματος δεν ταυτίζεται με την παρειά της κολώνας (σταθερό offset)

**Date:** 2026-06-20
**Owner επόμενης συνεδρίας:** fresh session (`/clear` πριν ξεκινήσεις)
**Status:** BUG ανοιχτό. Smart beam ghost ΥΛΟΠΟΙΗΘΗΚΕ & COMMITTED· μένει ΕΝΑ visual offset bug.

> Απάντα στον Giorgio στα **Ελληνικά**. **COMMIT/PUSH τα κάνει Ο GIORGIO**, όχι εσύ (N.(-1)).
> **Shared working tree με άλλον agent** — `git add` ΜΟΝΟ τα δικά σου beam-ghost αρχεία.
> Ένα `tsc` τη φορά (N.17). FULL ENTERPRISE + FULL SSoT (Revit-grade). SSoT audit (grep) ΠΡΙΝ γράψεις.

---

## 0. ΤΟ BUG (μία πρόταση)

Όταν ενεργοποιείς το εργαλείο «Δοκάρι» και εμφανίζεται το **φάντασμα πριν το 1ο κλικ** κουμπωμένο σε παρειά ορθογώνιας κολώνας, η **παρειά του δοκαριού δεν ταυτίζεται ακριβώς με την παρειά της κολώνας** — είναι **σταθερά μετατοπισμένη λίγα pixels προς ΒΟΡΡΑ (+Y world)**.

### Δεδομένα από τον Giorgio (browser-verified συμπεριφορά):
- 🎯 **ΑΠΟΦΑΣΙΣΤΙΚΟ (2026-06-20, στένεψε δραματικά το πρόβλημα):** Το **preview** (ghost πριν/πάνω στα κλικ) έχει το +Y offset, **ΑΛΛΑ το COMMITTED δοκάρι (μετά τα 2 κλικ) ευθυγραμμίζεται ΣΩΣΤΑ** με την κολώνα. ⇒ **preview-only bug.** Το beam entity geometry είναι ΣΩΣΤΟ (αλλιώς το committed θα ήταν κι αυτό offset). Το +Y μπαίνει **ΜΟΝΟ στο preview render path** — σχεδόν σίγουρα **PreviewCanvas transform/origin/DPR διαφορετικό από το main DxfCanvas**, ΟΧΙ στο geometry/resolver/finish.
- Reference εικόνες: `Στιγμιότυπο οθόνης 2026-06-20 105455.jpg` (σχηματικό: **κόκκινο=κολώνα, πράσινο=δοκάρι**, E παρειά· top-aligned αλλά **νότια παρειά beam πιο βόρεια** από νότια κολώνας), `...020242.jpg`, `...020345.jpg`.
- Το offset είναι: **σταθερό**, **μικρό (λίγα px)**, **ΔΕΝ κλιμακώνεται με το πλάτος**, σε **όλες τις παρειές & αγκυρώσεις**, **πάντα +Y**. (Ταιριάζει τέλεια με «σταθερό canvas-transform offset».)
- Επίσης (free case): «το κέντρο σταυρονήματος δεν ταυτίζεται με το κέντρο άξονα — ο άξονας λίγα px πιο βόρεια». ⇒ ίδιο preview-canvas offset.
- 🎯 **ΤΕΛΙΚΗ ΕΠΙΒΕΒΑΙΩΣΗ Giorgio:** το offset είναι **ΟΜΟΙΟΜΟΡΦΟ +Y translation όλου του ghost**, ίδιο μέγεθος σε ΟΛΕΣ τις πλευρές: στη **S παρειά** (beam βορράς→νότος) το βόρειο short-end του beam **εισχωρεί** λίγο μέσα στην κολώνα (βόρεια)· στη **N παρειά** το νότιο short-end **αφήνει gap** ίσου μεγέθους — πάντα προς βορρά. Αυτή η «εισχώρηση στη μία πλευρά = gap στην απέναντι, ίδιο μέγεθος» είναι η ΥΠΟΓΡΑΦΗ ενός σταθερού canvas-transform +Y (όχι geometry — το geometry θα έδινε συμμετρικό/scaled σφάλμα, όχι ομοιόμορφη μετατόπιση).

---

## 1. ΤΙ ΕΧΕΙ ΗΔΗ ΥΛΟΠΟΙΗΘΕΙ (ΜΗΝ το ξανακάνεις)

### ✅ COMMITTED (commit `465d48c7` «beam ghost on column faces…», από Giorgio):
- **Smart beam ghost (ADR-398 §3.3)** — φάντασμα πριν το 1ο κλικ, κουμπώνει σε 12 θέσεις (4 παρειές × 3 thirds). Pure resolver `bim/beams/beam-column-face-snap.ts` (`resolveBeamColumnFaceSnap` + `resolveBeamGhostSnapFromStore`). 20 jest.
- **`beamPreviewStore.startAnchored`** flag (centerline mode vs location-line auto-flush).
- **`useBeamTool.ts`** — `syncColumnsToStore` στο activate (+ render-loop fix: stable `getSceneEntitiesRef`), resolver στο 1ο κλικ.
- **Grip centralization (ADR-363 Slice G)** — extra mid-edges (`width-edge-far`/`length-edge-start`) σηκώθηκαν στο `bim/grips/axis-box-grips.ts` (opt-in `getAxisBoxGrips(params,{extraMidEdges:true})`). Διαγράφηκαν `applyBeamExtraEdgeGrip`/`applyWallExtraEdgeGrip`/`axisBoxEdgeMidpoint`. (Άσχετο με το bug — απλά context.)

### 🔴 UNCOMMITTED (δικά μου, ΔΕΝ έλυσαν το bug — απόφασισε αν τα κρατάς):
- **`hooks/drawing/beam-preview-helpers.ts`** — `makeBeamGhostBeforeClick` διαβάζει τώρα `getImmediateSnap()?.point ?? cursorPoint` (αντί raw cursor), mirror του `useColumnGhostPreview`. **Λογική:** το preview hover (`processDrawingHover`) δεν εφαρμόζει OSNAP/grid snap, αλλά το σταυρόνημα ζωγραφίζεται στο `ImmediateSnap`. **Πιθανώς σωστό αρχιτεκτονικά, αλλά ΔΕΝ έλυσε το offset** → το bug ΔΕΝ είναι (μόνο) cursor-snap mismatch.
- **`ADR-398`** changelog entries (render-loop fix + snap-alignment fix).
- ⚠️ Σκέψου αν το snap-alignment fix πρέπει να κρατηθεί ή να γίνει `git checkout` (αν αποδειχθεί άσχετο/παρενέργεια).

---

## 2. ΤΙ ΕΧΕΙ ΑΠΟΚΛΕΙΣΤΕΙ (μην ξανακυνηγήσεις αυτά)

1. **Ο resolver είναι σωστός** — `beam-column-face-snap.test.ts` (20 jest) αποδεικνύει σωστά centerline start/end. Π.χ. E lo third → `start=(maxX, minY+half)` → beam south face = `minY` = column south. ΜΑΘΗΜΑΤΙΚΑ σωστό.
2. **Το beam geometry είναι ΣΥΜΜΕΤΡΙΚΟ** γύρω από το centerline — `bim/geometry/beam-geometry.ts` `buildOutlineRect` → `offsetPolyline(axis, half, +1)` + `offsetPolyline(axis, half, -1)`, ίδιο vertex normal. ΟΧΙ ασύμμετρο offset.
3. **Η κολώνα ΔΕΝ είναι offset** — `ColumnRenderer.ts:84,239` ζωγραφίζει ΑΚΡΙΒΩΣ το `column.geometry.footprint.vertices` — το ΙΔΙΟ footprint που διαβάζει ο resolver (μέσω `syncColumnsToStore` → `beamPreviewStore`).
4. **Ο BeamRenderer ζωγραφίζει το geometry όπως είναι** — `BeamRenderer.ts:167-197` (outline + axisPolyline), χωρίς vertical offset. Το «hidden above floor» (γρ.6) είναι ΜΟΝΟ dashed style, ΟΧΙ 2.5D y-shift.
5. **Cursor-snap mismatch fix ΔΕΝ έλυσε** (βλ. §1 uncommitted).
6. **🎯 Geometry/resolver/finish ΑΠΟΚΛΕΙΟΝΤΑΙ** από το «committed ευθυγραμμίζεται σωστά» (§0): το ΙΔΙΟ beam entity (ίδιο `buildBeamEntity`/geometry) ζωγραφισμένο στο **main canvas** είναι σωστό· στο **PreviewCanvas** είναι +Y. Άρα η μόνη μεταβλητή = **ο preview render path** (PreviewCanvas transform ή `applyPreviewStyling`).

➡️ **Η ρίζα είναι preview-only — εστίασε στο PreviewCanvas vs main DxfCanvas.** Σύγκρινε ΑΚΡΙΒΩΣ πώς το `drawPreview` (PreviewCanvas) στήνει το `ctx.setTransform`/origin/DPR σε σχέση με το `DxfRenderer` (main). Ένα half-pixel ή ένα διαφορετικό y-origin/DPR offset εξηγεί τα πάντα.

---

## 3. ΠΡΩΤΟ ΒΗΜΑ: σύγκρινε PreviewCanvas vs main DxfCanvas transform

Αφού **committed OK / preview offset**, μη χάνεις χρόνο σε coords/geometry (είναι σωστά). Η πρώτη κίνηση:

1. **Διάβασε & σύγκρινε** πώς στήνεται το `ctx` transform (DPR, `setTransform`, origin, y-flip, half-pixel rounding) στο **PreviewCanvas** (`canvas-v2/preview-canvas/PreviewRenderer.ts` + `drawPreview` + canvas init) έναντι του **main** (`canvas-v2/dxf-canvas/DxfRenderer.ts` / `DxfCanvas`). Βρες τη ΔΙΑΦΟΡΑ (το σταθερό +Y offset ζει εκεί).
2. Αν χρειαστεί επιβεβαίωση, πρόσθεσε **temporary log** στο `drawPreview` (PreviewCanvas) ΚΑΙ στο main beam render: τύπωσε το screen-y ενός γνωστού world point (π.χ. του beam south-face vertex) από κάθε path. Η διαφορά = το offset.
3. **Cross-check:** το ίδιο world point ζωγραφισμένο από τα δύο canvas πρέπει να πέφτει στο ίδιο screen pixel. Αν όχι → βρήκες τη ρίζα (canvas transform).

---

## 4. TOP ΥΠΟΨΙΕΣ (μετά το «committed OK / preview offset», ΣΕΙΡΑ ΑΛΛΑΞΕ)

1. **🎯 PreviewCanvas vs main DxfCanvas transform/origin/DPR (ΣΧΕΔΟΝ ΒΕΒΑΙΟ).** Το ΙΔΙΟ entity είναι σωστό στο main, +Y στο preview → το PreviewCanvas έχει σταθερό y-offset. Ψάξε `ctx.setTransform`/`translate`/`devicePixelRatio`/half-pixel στο `canvas-v2/preview-canvas/*` (`PreviewRenderer`, `drawPreview`, canvas setup) και σύγκρινε byte-for-byte με το main `DxfRenderer`/`DxfCanvas` transform. Συχνή αιτία: half-pixel crispness offset, ή `Math.round`/`Math.floor` στο ένα canvas όχι στο άλλο, ή διαφορετικό y-flip origin. _(Το column anchor ghost ΔΕΝ εκθέτει αυτό — χρησιμοποιεί RAF direct `ColumnAnchorGhostRenderer` με δικό του CSS-pixel transform, ΟΧΙ το entity `drawPreview` path.)_
2. **`applyPreviewStyling` / preview entity decoration** (`drawing-preview-generator.ts`) — μήπως προσθέτει grip markers/offset που μετατοπίζει το rendered outline.
3. **Half-lineweight διαφορά column↔beam** (αν το #1 αποκλειστεί) — αλλά το «committed OK» το κάνει απίθανο (το committed beam έχει ίδιο lineweight κι ευθυγραμμίζεται).
4. ~~Beam finish / geometry~~ — **ΑΠΟΚΛΕΙΣΤΗΚΑΝ** (committed OK).

---

## 5. SSoT AUDIT (τρέξε ΠΡΙΝ γράψεις κώδικα — reuse, μηδέν διπλότυπα)

```
# Beam ghost (το feature που debugάρεις):
rg -n "resolveBeamColumnFaceSnap|resolveBeamGhostSnapFromStore|makeBeamGhostBeforeClick" src/subapps/dxf-viewer
rg -n "beam-preview-helpers|generateBeamPreview|beamPreviewStore" src/subapps/dxf-viewer
# Render path (εδώ είναι μάλλον η ρίζα):
rg -n "PreviewCanvas|PreviewRenderer|drawPreview|wysiwygPreview" src/subapps/dxf-viewer/canvas-v2
rg -n "lineWidthPx|resolveSubcategoryStyle|lineweightToPx|SCREEN_DPI" src/subapps/dxf-viewer/bim
rg -n "devicePixelRatio|setTransform|dpr" src/subapps/dxf-viewer/canvas-v2/preview-canvas
# Σύγκρινε column vs beam render (ίδιο footprint, διαφορετικό stroke;):
rg -n "footprint.vertices|geometry.outline|drawPolyline|buildPiecesPath" src/subapps/dxf-viewer/bim/renderers/ColumnRenderer.ts src/subapps/dxf-viewer/bim/renderers/BeamRenderer.ts
# Crosshair source (να ξέρεις σε ποιο σημείο ζωγραφίζεται το σταυρόνημα):
rg -n "Crosshair|ImmediatePosition|ImmediateSnap" src/subapps/dxf-viewer/systems/cursor
```

### Υπάρχοντα SSoT προς reuse (ΜΗΝ ξαναγράψεις):
- `getImmediateSnap` (`systems/cursor/ImmediateSnapStore`) — το snapped σημείο που τροφοδοτεί το σταυρόνημα/column ghost.
- `useColumnGhostPreview` (`hooks/tools/useColumnGhostPreview.ts`, γρ.67-72) — το browser-verified pattern «ghost στο snapped σημείο». MIRROR αυτό.
- `beam-geometry.ts` `buildOutlineRect`/`offsetPolyline` — μην αγγίξεις (συμμετρικό, verified).

---

## 6. ADR / DOC + ΚΑΝΟΝΕΣ

- Ενημέρωσε `ADR-398` (§3.3 + changelog) όταν βρεις τη ρίζα. + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, N.15) στο ΙΔΙΟ commit (που κάνει ο Giorgio).
- N.0.1: κώδικας = αλήθεια. N.7.1: <500 γρ/αρχείο, <40 γρ/συνάρτηση. N.2/N.3: όχι `any`/inline styles.
- ADR-040: αν αγγίξεις PreviewCanvas/renderer/cursor core → σεβάσου micro-leaf (CHECK 6B/6C/6D, ίσως χρειαστεί ADR staged).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου beam-ghost/preview αρχεία· ΟΧΙ `bim/structural/**`, `bim/foundations/**`, i18n, ή ό,τι δεν άλλαξες.

## 7. ΣΧΕΤΙΚΑ ARCHIVE
- `HANDOFFS/HANDOFF_2026-06-20_smart-beam-ghost-on-column-faces.md` (το αρχικό spec — υλοποιήθηκε).
- Memory: `reference_preview_ghost_must_read_immediate_snap.md` (το snap-source μάθημα).
- ADRs: ADR-398 §3.3 (smart beam ghost), ADR-363 §5.7 (beam WYSIWYG placement), ADR-449 (finish skin), ADR-040 (preview canvas perf).
