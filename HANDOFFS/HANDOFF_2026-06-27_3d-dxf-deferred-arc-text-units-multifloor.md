# HANDOFF — 3D DXF editing/hover: deferred follow-ups (arc ghost, text, non-mm units, multi-floor)

**Ημερομηνία:** 2026-06-27
**Status:** READY — 4 ανεξάρτητα follow-ups πάνω σε ΥΛΟΠΟΙΗΜΕΝΗ βάση (ADR-537 + ADR-538). Enterprise + FULL SSOT.
**⚠️ SHARED WORKING TREE:** δουλεύει ταυτόχρονα κι άλλος agent (ADR-539 «Polygon Mode» per-face + structural). **ΞΑΝΑΔΙΑΒΑΣΕ
κάθε αρχείο πριν το edit** — μπορεί να έχει αλλάξει από το handoff. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ** (N.(-1)).

---

## 0. ΤΙ ΗΔΗ ΥΠΑΡΧΕΙ (η βάση — ΜΗΝ το ξαναφτιάξεις)

**ADR-537** (COMMITTED) — επιλογή & grip-editing ωμών DXF (line/polyline/circle/arc) στον 3D κάμβα, full SSoT με 2D:
- `bim-3d/grips/dxf-wireframe-hit-test.ts` — `pickDxfEntityAt` + pure `nearestDxfEntityWithin`/`distanceToDxfEntityMm`.
- `bim-3d/grips/grip-3d-dxf-raw-grips.ts` — `rawDxfReshapeGrips`.
- `bim-3d/grips/grip-3d-dxf-commit.ts` — `commitDxfGrip3D` (→ `commitDxfGripDragModeAware` → StretchEntityCommand).
- `bim-3d/grips/dxf-grip-ghost-paint.ts` — `buildDxfGhostSegments` (live ghost· **arc → επιστρέφει `[]` σήμερα**).
- `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` — το hook (seat grips/drag/commit/arbitration).
- Reuse αυτούσια: `BimGripController3D`, `Grip3DOverlayStore`, `BimGripOverlay2D`, `computeDxfEntityGrips`, `commitDxfGripDragModeAware`, `makeGripPlanToCanvas`, `dxfPlanToWorld`.

**ADR-538** (UNCOMMITTED — ο Giorgio θα το κάνει commit) — 3D hover φωτισμός + «+» badge, full SSoT με 2D:
- State SSoT = **`systems/hover/HoverStore.ts`** (ΤΟ ΙΔΙΟ store με το 2D· ενοποιημένο 2D↔3D hover).
- Badge SSoT = `systems/hover/hover-add-badge.ts` `resolveHoverBadge` (το 2D `CrosshairOverlay` το καλεί κι αυτό).
- DXF glow = `bim-3d/viewport/grips/DxfHoverGlowOverlay2D.tsx` (reuse `drawEntityGlowPrePass` + `HOVER_HIGHLIGHT`).
- Outline geometry SSoT = `bim-3d/grips/dxf-entity-outline.ts` `dxfEntityOutlineSegments` (**έχει `arcPolyline` + `circlePolyline`** — reuse!).
- BIM yellow silhouette = `SelectionOutlinePass` (ΕΝΑ pass ζωγραφίζει selection gold + hover yellow· hover = λεπτό 1.4px/dim 0.65) + `BimSelectionHighlighter` (generic `apply`) + `ThreeJsSceneManager.hoverHighlighter` + `scene-manager-actions.applyBimHover`.
- Pick driver = `use-bim3d-pointer-handlers.ts` `pickHover` (throttle `DXF_TIMING.frame.HOVER_HITTEST`).

**Κρίσιμα μονοπάτια συντεταγμένων (SSoT):** `bim-3d/viewport/coordinate-transforms.ts` (`dxfPlanToWorld` = **mm-based**, ×0.001),
`bim-3d/grips/grip-3d-screen-project.ts` `makeGripPlanToCanvas`. Το DXF wireframe ζωγραφίζεται από `converters/DxfToThreeConverter.ts`
(scale `DXF_UNIT_TO_METRES[units]`, default mm).

---

## 1. ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSOT AUDIT (grep ΠΡΙΝ γράψεις κώδικα)

**Giorgio rule:** πραγματικό SSoT audit ΠΡΙΝ από κάθε νέο μηχανισμό — reuse, ΟΧΙ διπλότυπο. Τρέξε ΟΛΑ τα παρακάτω και
κατέγραψε τι βρήκες ΠΡΙΝ σχεδιάσεις:

```
# Arc reshape/ghost — υπάρχει ήδη 2D arc preview/geometry;
grep -rn "arcPolyline\|bulgeApexPoint\|pointOnArc\|arcMidpoint\|sampleArc\|describeArc" src/subapps/dxf-viewer
grep -rn "case 'arc'" src/subapps/dxf-viewer/hooks/grip-computation.ts src/subapps/dxf-viewer/canvas-v2/dxf-canvas
# Text σε 3D — υπάρχει text→three (π.χ. dimensions/labels) να reuse;
grep -rni "text" src/subapps/dxf-viewer/bim-3d/converters
grep -rn "TextGeometry\|troika\|SpriteText\|makeTextSprite\|DimensionLabel\|drawText3D\|CanvasTexture" src/subapps/dxf-viewer/bim-3d
# Units — ΕΝΑ μέρος για mm↔unit conversion;
grep -rn "DXF_UNIT_TO_METRES\|DXF_UNIT_TO_MM\|unitToMm\|mmPerUnit\|sceneUnits" src/subapps/dxf-viewer/bim-3d src/subapps/dxf-viewer/canvas-v2
# Multi-floor DXF — πού ζει ο stack + per-floor elevation;
grep -rn "multiFloor\|MultiFloor\|floorElevationMm\|DxfOverlayFloorEntry\|syncDxfOverlayMultiFloor" src/subapps/dxf-viewer/bim-3d
```

Αν βρεις υπάρχον helper → **reuse**. Αν όχι → φτιάξε **ΕΝΑ** SSoT helper και βάλ' τον στο σωστό module (όχι inline σε N αρχεία).

---

## 2. ΤΑ 4 FOLLOW-UPS (ανεξάρτητα — διάλεξε ένα ή όλα)

### α) Arc ghost κατά το grip-drag (ADR-537)
**Τι λείπει:** στο `dxf-grip-ghost-paint.ts buildDxfGhostSegments`, το `case 'arc'` πέφτει στο `default → []`. Στο drag
φαίνεται μόνο το τετράγωνο λαβής (το commit του arc δουλεύει ήδη).
**SSoT reuse:** το **`dxf-entity-outline.ts arcPolyline(center, radius, startDeg, endDeg)`** (γράφτηκε στο ADR-538) δίνει
ήδη το δειγματισμένο τόξο. Εφάρμοσε το grip delta στο σωστό παραμετρικό (center move → translate· start/end angle vertex →
νέα γωνία· mid edge → ακτίνα/bulge) και δείγμα με το ίδιο `arcPolyline`. Δες `computeDxfEntityGrips` `case 'arc'` για τη
σημασία κάθε `gripIndex` (0=center/move, 1=startAngle, 2=endAngle, 3=mid/move). **Καμία νέα γεωμετρία** — reuse arcPolyline.
**Test:** colocated, pure (όπως `dxf-grip-ghost-paint.test.ts`).

### β) Text οντότητες — select/hover/grips στο 3D
**Blocker:** `converters/DxfToThreeConverter.ts appendEntitySegments` κάνει **skip** το `text` → δεν υπάρχει 3D αναπαράσταση
να επιλεγεί/φωτιστεί. Το 2D SSoT υπάρχει ήδη: `computeDxfEntityGrips` `case 'text'` = ΕΝΑ center grip.
**Δουλειά:** (1) render text στο 3D wireframe (SSoT audit: μήπως υπάρχει ήδη text→three για dimensions/labels — reuse·
αλλιώς CanvasTexture-on-plane ή sprite, στο plan επίπεδο Y=0, με σωστό billboarding όπως Revit annotations). (2) Κάν' το
pickable: επέκτεινε `pickDxfEntityAt distanceToDxfEntityMm` με `case 'text'` (bbox distance) + `dxfEntityOutlineSegments`
με text bbox για το hover glow. (3) grip = ήδη δουλεύει (center) μόλις γίνει pickable.
**Προσοχή:** μην διπλασιάσεις text rendering — Revit/C4D έχουν ΕΝΑ text subsystem. Grep πρώτα.

### γ) Non-mm DXF (cm/m/in/ft)
**Σήμερα:** gated σε mm (`pickDxfEntityAt` + `resolveEligibleDxfEntity` + `DxfHoverGlowOverlay2D`/`FLAT_ELEVATION`). Ρίζα: ο
κοινός `dxfPlanToWorld` είναι mm-based (×0.001) ενώ το wireframe scale-άρεται με `DXF_UNIT_TO_METRES[units]`.
**Enterprise λύση (ΕΝΑ unit factor SSoT):** φτιάξε/βρες `dxfUnitToMm(units)` (πιθανώς `DXF_UNIT_TO_METRES × 1000`). Στο
**seat** (grips/outline positions) → ×unitMm ώστε να ευθυγραμμίζονται με τον mm projector. Στο **commit** → delta ÷unitMm
πίσω σε entity units (το `gripToVertexRefs` είναι index-based, άρα μόνο το delta χρειάζεται μετατροπή — επιβεβαίωσε με grep).
Σήκωσε το gate. **Test:** unit-factor round-trip (mm/cm/m). ΜΗΝ φτιάξεις δεύτερο projector — ένα factor στα boundaries.

### δ) Multi-floor DXF (edit + hover)
**Σήμερα:** `useDxfOverlay3DStore.dxfScene` = single active floor· το `FLAT_ELEVATION=()=>0`. Stack: SSoT audit
(`multi-floor-3d-source.ts` / `syncDxfOverlayMultiFloor` / `DxfOverlayFloorEntry` έχουν `floorElevationMm`).
**Δουλειά:** per-floor elevation στον projector (`() => floorElevationMm` αντί 0) + pick/seat ανά όροφο (ποιος όροφος είναι
κάτω από τον κέρσορα). Reuse το υπάρχον multi-floor source — μην ξαναχτίσεις stacking.

---

## 3. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (enterprise, μη-διαπραγματεύσιμοι)

- **FULL SSOT:** reuse υπάρχοντα (HoverStore, computeDxfEntityGrips, commitDxfGripDragModeAware, dxf-entity-outline,
  SelectionOutlinePass, coordinate-transforms). Κάθε νέος helper = ΕΝΑ canonical module, μηδέν inline copy-paste.
- **Big-player standard (Revit/Maxon):** post-process/SSoT μηχανισμοί, body material untouched, ΕΝΑ subsystem ανά concern.
- **N.7.1:** νέα αρχεία <500 γρ., functions <40 γρ. (⚠️ `ThreeJsSceneManager.ts` είναι στα **~499** — ΜΗΝ προσθέσεις
  μέθοδο εκεί· βάλε λογική σε `scene-manager-actions.ts` helper όπως `applyBimHover`).
- **`any`/`as any`/`@ts-ignore` ΑΠΑΓΟΡΕΥΟΝΤΑΙ.** Inline-styles forbidden (εξαίρεση: compositor overlays τύπου CrosshairOverlay).
- **tsc:** το default κάνει **OOM** (N.17). Χρησιμοποίησε `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` και
  **grep μόνο τα δικά σου αρχεία** (η app έχει προϋπάρχοντα errors άλλων agents — ΟΧΙ δικά σου). **ΕΝΑ tsc τη φορά** (έλεγξε
  process πρώτα). Targeted/skip για 1-3 αρχεία.
- **ADR-driven:** επέκτεινε ADR-537 (α/γ/δ) ή ADR-538 (β hover μέρος) ή νέο ADR (επόμενος ελεύθερος — δες
  `docs/centralized-systems/reference/adr-index.md`). **Pre-commit CHECK 6B/6D:** stage το ADR μαζί με τα 3D/canvas αρχεία,
  αλλιώς μπλοκάρει.
- **Jest:** colocated `__tests__`, pure-first (δες τα 6 suites των ADR-537/538 ως πρότυπο).
- **SHARED TREE:** re-read πριν edit· μην πατήσεις δουλειά του ADR-539 agent (Polygon Mode / FaceSelectionHighlighter /
  `usePolygonMode3DStore` / `raycastBimFace`).
- **Browser-verify + commit → Giorgio.** Εσύ ετοιμάζεις + δηλώνεις τι έγινε.

## 4. Verify (end-to-end, ανά follow-up)
`npm run dev` → `http://localhost:3000/dxf/viewer`, DXF με arcs/text/non-mm/πολλούς ορόφους, γύρνα 3D:
- **α** drag arc grip → το τόξο-ghost ακολουθεί live· άφημα → commit + resync, 1 undo.
- **β** click/hover text → επιλέγεται/φωτίζεται + center grip· μετακίνηση δουλεύει.
- **γ** φόρτωσε cm/m DXF → grips/hover ευθυγραμμισμένα με το wireframe (όχι 1000× off).
- **δ** «Όλοι οι όροφοι» → hover/edit σε σωστό όροφο/υψόμετρο.
- tsc (8GB, grep δικά σου) + jest GREEN.
