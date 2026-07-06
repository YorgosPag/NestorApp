# ADR-574 — Ghost / Preview (φαντάσματα οντοτήτων) SSoT Audit

> **Status:** 🟢 RESOLVED-NO-CHANGE (audit / census) — χαρτογράφηση ΟΛΩΝ των «φαντασμάτων»
> (ghosts / previews) του DXF Viewer σε **κάθε κατάσταση** (δημιουργία/γέννηση, μετακίνηση,
> επεξεργασία λαβής, περιστροφή) και σε **2D + 3D**, με στόχο να διαπιστωθεί αν χρησιμοποιούν όλα τη
> **ΜΙΑ ΚΑΙ ΜΟΝΑΔΙΚΗ πηγή αλήθειας** (SSoT). Καμία αλλαγή runtime κώδικα — μόνο καταγραφή ευρημάτων
> + μη-δεσμευτικές συστάσεις.
> **Date:** 2026-07-05
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-040 (preview-canvas performance / micro-leaf), ADR-362 (dimension preview SSoT),
> ADR-398 §4 (`useCanvasGhostPreview` harness), ADR-408 (MEP connectors placement ghosts),
> ADR-448 (3D vertical datum), ADR-550 (unified entity render contract / WYSIWYG moving copy),
> ADR-560 (entity body-drag move/copy), ADR-561 (move/rotate grips primitives — preview≡commit),
> ADR-543/544 (wall/column drawing 2D↔3D SSoT), ADR-549 (entity rendering census), ADR-572
> (alignment traces SSoT audit — αδελφό audit).

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio ζήτησε **βαθιά βουτιά** στην υποεφαρμογή `/dxf/viewer` για να διαπιστωθεί αν τα «φαντάσματα»
**όλων ανεξαιρέτως** των οντοτήτων χρησιμοποιούν τη **μία και μοναδική πηγή αλήθειας** για τη
δημιουργία, εμφάνιση και συμπεριφορά τους — κατά τη **γέννηση**, κατά τη **μετακίνηση**, κατά την
**επεξεργασία**, κατά την **περιστροφή**, και σε κάθε άλλη κατάσταση.

Ως «φάντασμα» (ghost / preview) ορίζουμε την **εφήμερη οπτική αναπαράσταση** μιας οντότητας που
εμφανίζεται **κατά την αλληλεπίδραση**, πριν οριστικοποιηθεί (commit): το rubber-band καθώς σχεδιάζεις
νέα οντότητα, το ημιδιάφανο αντίγραφο καθώς σύρεις/μετακινείς, το preview καθώς τραβάς λαβή ή
περιστρέφεις.

**Απάντηση σε μία γραμμή:** Η **ΓΕΩΜΕΤΡΙΑ** (το σχήμα) των φαντασμάτων είναι **γνήσια ενοποιημένη
SSoT** — για κάθε παραμετρική οντότητα, σε 2D και 3D, το ghost παράγει το σχήμα του από την **ίδια**
γεννήτρια `compute*Geometry` και (στην πλειονότητα) το ζωγραφίζει με τον **ίδιο** committed renderer με
την τελική οντότητα. Το fragmentation **δεν** είναι στη γεωμετρία· είναι σε **paint/routing**, σε
**4 οριοθετημένες νησίδες** — καμία δεν είναι παράλληλη μηχανή γεωμετρίας.

**Μεθοδολογία:** 3 παράλληλοι Explore agents (κεντρικό pipeline & γέννηση / MOVE-GRIP-ROTATION /
γεωμετρία BIM-vs-2D) πάνω σε ολόκληρο το `src/subapps/dxf-viewer`, + χειροκίνητη επιβεβαίωση της
νησίδας MEP (γρ.-by-γρ. read `MepManifoldGhostRenderer.ts` + `useMepManifoldGhostPreview.ts`).

---

## 2. Οι δύο άξονες της SSoT

Το «χρησιμοποιεί το ghost την πηγή αλήθειας;» έχει **δύο** ανεξάρτητους άξονες. Τα ευρήματα διαφέρουν
ανά άξονα, οπότε τους διαχωρίζουμε ρητά:

| Άξονας | Ερώτηση | SSoT αρχεία | Ετυμηγορία |
|---|---|---|---|
| **A. Γεωμετρία (σχήμα)** | Το ghost βγάζει το σχήμα του από την ίδια γεννήτρια με το commit; | `bim/geometry/*-geometry.ts` (`compute*Geometry` → γράφει `entity.geometry`)· 3D vertical datum `bim-3d/converters/bim-three-shape-helpers.ts` (ADR-448) | ✅ **ΕΝΟΠΟΙΗΜΕΝΗ** παντού |
| **B. Paint / Render (πινελιά)** | Το ghost ζωγραφίζεται από τον ίδιο renderer με το commit; | 2D `rendering/core/EntityRendererComposite.ts`· 3D `Bim*Converter`· WYSIWYG bridge `canvas-v2/preview-canvas/bim-preview-render.ts` (`BimPreviewRenderer`) + `rendering/ghost/draw-real-entity-preview.ts` (ADR-550) | ✅ ενοποιημένη για BIM & edit· ⚠️ **4 νησίδες** paint/routing |

**Κρίσιμο συμπέρασμα:** Ο άξονας Α (γεωμετρία) είναι το ουσιώδες ρίσκο «το preview δείχνει άλλο από
αυτό που θα φτιαχτεί» — και εκεί το σύστημα είναι **καθαρό**. Οι νησίδες του άξονα B αφορούν
**στυλιστική** πιστότητα (χρώμα/πάχος/σύμβολο) και **διπλό routing**, όχι απόκλιση σχήματος.

---

## 3. Κεντρική αρχιτεκτονική φαντασμάτων

| Ρόλος | Αρχείο | Σημείωση |
|---|---|---|
| **Μία φυσική επιφάνεια preview** | `canvas-v2/preview-canvas/PreviewCanvas.tsx` | Mount-άρεται **μία** φορά (`CanvasLayerStack.tsx`). ~30 dedicated ghost mounts μοιράζονται το ίδιο bitmap μέσω `getCanvas()` getter (skip-clear layering). |
| **Imperative renderer** | `canvas-v2/preview-canvas/PreviewRenderer.ts` | `drawPreview()` / `render()` / `clear()`. Κρατά το `currentPreview` (το «τι προβάλλεται» για τη γέννηση). |
| **Ένα RAF / DPR / viewport harness** | `hooks/tools/useCanvasGhostPreview.ts` (ADR-398 §4) | Ένας lifecycle (RAF + DPR-clear + canonical viewport + snapped cursor) για **όλα** τα ~19 ghost hooks. |
| **Ένα transform SSoT (edit)** | `rendering/ghost/apply-entity-preview.ts` (`applyEntityPreview`) | «Single source of truth for what the entity looks like during a drag.» |
| **Store** | — | ❌ **ΔΕΝ** υπάρχει ενιαίο preview store. Γέννηση = `PreviewRenderer.currentPreview` (instance field)· edit/placement = σκόρπια per-interaction stores (`GripDragStore`, `EntityBodyDragStore`, `wall-preview-store`, `column-polygon-preview-store`, κ.λπ.) + phase props threaded στο `CanvasLayerStack`. Λειτουργικά ανεκτό (ADR-040 leaf pattern), αλλά **όχι** ενιαία «τι προβάλλεται» πηγή. |

### Τα τρία pipelines rendering (όλα βάφουν την ίδια επιφάνεια)

- **Pipeline A — CREATION rubber-band:** `useUnifiedDrawing.tsx` → `hooks/drawing/drawing-preview-generator.ts::generatePreviewEntity` → `PreviewRenderer.drawPreview` → `preview-entity-paint.ts`, με branch:
  - primitives → `preview-entity-dispatch.ts` → `preview-entity-renderers.ts` (**ξεχωριστό** paint)·
  - BIM (`wysiwygPreview`) → `bim-preview-render.ts::BimPreviewRenderer` → **πραγματικός** `EntityRendererComposite`·
  - dimension → `preview-dimension-renderer.ts` → **ίδιος** `buildDimensionGeometry` (ADR-362).
- **Pipeline B — EDITING transform ghost** (move/rotate/mirror/scale/stretch/grip/body-drag): per-tool hooks → `useCanvasGhostPreview` → `applyEntityPreview` → renderer είτε `draw-real-entity-preview.ts` (WYSIWYG, ADR-550) είτε `draw-ghost-entity.ts` (silhouette, δευτερεύοντες followers/dimmed origin).
- **Pipeline C — BIM PLACEMENT ghost** (MEP + openings): per-entity hooks → `useCanvasGhostPreview` → **bespoke `*GhostRenderer` class ανά οντότητα** (βλ. §5 νησίδα 2).

---

## 4. Πίνακας: ΚΑΤΑΣΤΑΣΗ × ENTITY-FAMILY → γεωμετρία & paint

Στήλες: **Γεω** = πηγή σχήματος (άξονας A), **Paint** = διαδρομή πινελιάς (άξονας B), **Ετυμ.** =
SAME (ίδια SSoT) / DIFF (νησίδα).

| Κατάσταση | Οικογένεια | Γεωμετρία (source) | Paint | Ετυμ. |
|---|---|---|---|---|
| **CREATION** | 2D primitive (line/circle/arc/rect/polyline/point) | raw params (δεν υπάρχει generator) | `preview-entity-renderers.ts` (ξεχωριστό) | ⚠️ **DIFF paint** (νησίδα 1) |
| **CREATION** | dimension | `buildDimensionGeometry` | `preview-dimension-renderer.ts` (ίδιος builder) | ✅ SAME |
| **CREATION** | BIM (wall/slab/column/beam/foundation/roof/stair/floor-finish/wall-covering) | `compute*Geometry` (`*-preview-helpers` → builders) | `BimPreviewRenderer` → `EntityRendererComposite` | ✅ SAME |
| **CREATION/PLACEMENT** | MEP (fixture/panel/manifold/radiator/boiler/water-heater/segment) & openings | tool `getGhostFootprint()` (+ shared symbol/palette sub-helpers) | **bespoke `*GhostRenderer`** | ⚠️ **DIFF paint** (νησίδα 2) |
| **MOVE** (whole-entity) | 2D primitive / polyline | `applyClassicEntityPreview` (translate) — commit ίδιο | `draw-real-entity-preview` / silhouette | ✅ SAME |
| **MOVE** | BIM box & linear | `calculateBimMovedGeometry` (ίδια fn με commit) | WYSIWYG real | ✅ SAME |
| **GRIP** (resize/stretch) | 2D primitive / polyline | classic vertex stretch (ίδιο με commit) | real / silhouette | ✅ SAME |
| **GRIP** | BIM box (column/beam-box/panel/furniture/MEP fixture) | `apply*GripDrag → compute*Geometry` (`apply-parametric-box-preview.ts`) — commit ξανατρέχει **ίδια** fn | WYSIWYG real | ✅ SAME |
| **GRIP** | BIM linear (wall/beam/mep-segment) | `applyWallGripDrag`/`applyBeamGripDrag` (axis-box) — commit ίδια fn | WYSIWYG real | ✅ SAME |
| **ROTATION** | arc/polyline/rect | `applyPrimitiveRotationDrag → rotateEntity` — commit `resolveRotation → rotateEntity` | real / silhouette | ✅ SAME (identity, ADR-561) |
| **ROTATION** | **line** | preview `applyAxisBoxGripDrag('rotation')` **vs** commit `rotateEntity` | real | ⚠️ **DIFF engine** (νησίδα 4) |
| **ROTATION** | BIM box & linear | `apply*GripDrag('*-rotation',{pivot})` — commit ίδια fn | WYSIWYG real | ✅ SAME |
| **όλες** | text/mtext | `applyTextGripDrag` (preview & commit ίδιο) | real | ✅ SAME |
| **όλες** | hatch | `apply-entity-preview.ts` (ίδιοι `fillHatchGradient`/`traceHatchBoundary`) | real | ✅ SAME |
| **GRIP/MOVE/ROT (3D)** | column/wall/slab/... | `bim3d-grip-preview-builders.ts` → `apply*GripDrag → compute*Geometry → *ToMesh` (ίδιος converter) | three.js scene | ✅ SAME |
| **CREATION (3D)** | column/wall/beam/... | `*PlacementGhost.ts` → `compute*Geometry → *ToMesh` | three.js scene | ✅ SAME |
| **DXF entity σε 3D** (line/poly/circle/arc/text) | `dxf-entity-outline.ts` sampler | `dxf-grip-ghost-paint.ts` (ίδιος `circlePolyline`/`arcPolyline`/`textBoxCornersWorld`) | three.js | ✅ SAME sampler |

**Ανάγνωση πίνακα:** Ο άξονας Α (γεωμετρία) είναι **SAME σε ΟΛΕΣ τις γραμμές** (τα primitives δεν
έχουν generator — το σχήμα είναι τα ίδια τα raw params, άρα ταυτόσημο εξ ορισμού). Το DIFF εμφανίζεται
**μόνο** στον άξονα B (paint/engine), στις 4 νησίδες.

---

## 5. Ευρήματα Fragmentation — 4 νησίδες (άξονας B μόνο)

### Νησίδα 1 — 2D DXF primitive CREATION rubber-band · **Severity: LOW**
Το creation preview των line/circle/arc/rect/polyline ζωγραφίζεται από `preview-entity-renderers.ts`
(ξεχωριστά `ctx.moveTo/lineTo/ellipse/strokeRect`), **όχι** από τους committed `LineRenderer`/
`CircleRenderer`/… Επειδή η «γεωμετρία» εδώ είναι τα raw params (2 σημεία, κέντρο+ακτίνα), **δεν
υπάρχει generator να αποκλίνει** — το σχήμα είναι ταυτόσημο εξ κατασκευής. Το ρίσκο είναι **μόνο
στυλιστικό**: το `resolveEntityRenderStyle` (lineweight/dash/ByLayer color) **δεν** εφαρμόζεται σε
αυτό το creation path, άρα το rubber-band μπορεί να διαφέρει οπτικά από το τελικό stroke.

### Νησίδα 2 — MEP + openings PLACEMENT ghosts (Pipeline C) · **Status: ✅ IMPLEMENTED (Σ2 2026-07-05 · Σ2b slab-opening 2026-07-06)**
~~Τα placement previews των MEP (manifold/fixture/panel/radiator/boiler/water-heater/segment) και των
openings χρησιμοποιούν **bespoke class ανά οντότητα**: `MepManifoldGhostRenderer`,
`ElectricalPanelGhostRenderer`, `MepBoilerGhostRenderer`, `MepWaterHeaterGhostRenderer`,
`MepRadiatorGhostRenderer`, `MepSegmentGhostRenderer`, `OpeningRenderer`. Καθεμία είναι
**χειροκίνητο δίδυμο** του committed renderer της (σχόλιο στον κώδικα: *«Palette mirrors
`MepManifoldRenderer`… mirror of `ElectricalPanelGhostRenderer`»*) και **ξαναγράφει** fill/outline/
anchor, αντί να δρομολογείται μέσω `EntityRendererComposite`.~~

**Υλοποιήθηκε η σύσταση Σ2 (βλ. §7).** 7 από τις 8 bespoke οικογένειες migrate-αρίστηκαν στο κοινό
SSoT helper `renderWysiwygPlacementGhost` (`bim/ghosts/wysiwyg-placement-ghost.ts`), το οποίο
δρομολογεί το placement ghost μέσω **του ίδιου** committed pipeline `BimPreviewRenderer` →
`EntityRendererComposite` που ήδη χρησιμοποιεί το edit (grip/move) — δηλαδή **byte-identical WYSIWYG
by identity**, με τους **ίδιους** commit builders (`build*Entity`) να παράγουν την οντότητα-προεπισκόπηση:

- **Migrated (7):** manifold, electrical-panel, mep-boiler, mep-water-heater, mep-radiator,
  mep-fixture, opening. Οι bespoke renderers `MepManifoldGhostRenderer.ts`,
  `ElectricalPanelGhostRenderer.ts`, `MepBoilerGhostRenderer.ts`, `MepWaterHeaterGhostRenderer.ts`,
  `MepRadiatorGhostRenderer.ts`, `opening-ghost-renderer.ts` (+ `MepFixtureGhostRenderer.ts` και το test
  του) **διαγράφηκαν** — κανένα leftover import (επιβεβαιωμένο με grep σε όλο το `dxf-viewer`).
- **Migrated Σ2b (slab-opening, 2026-07-06):** το `slab-opening` placement ghost **migrate-αρίστηκε**
  στο ίδιο WYSIWYG SSoT (`renderWysiwygPlacementGhost` → πραγματικός `SlabOpeningRenderer`), με νέο
  preview-tolerant builder `buildSlabOpeningPreviewEntity` (`slab-opening-completion.ts`) που μοιράζεται
  το ΙΔΙΟ geometry/validator SSoT με το strict `buildSlabOpeningEntity` (κοινό `assembleSlabOpeningEntity`
  helper — μηδέν διπλότυπη construction) αλλά παρακάμπτει **ΜΟΝΟ** το `outlineOutsideSlab` hard-reject.
  **Big-player edge behaviour:** το placement ghost ΠΟΤΕ δεν εξαφανίζεται στις άκρες — εντός πλάκας →
  πλήρες WYSIWYG, εκτός → 🔴 status schematic (`resolveGhostStatusColor('overlap')` + `drawStatusGhostPolygon`,
  κοινό SSoT με δοκάρι/κολώνα), όπως το Revit δείχνει opening + warning. Ο leaf `useSlabOpeningGhostPreview`
  παίρνει πλέον `getHostSlab` (mirror του `getHostWall`)· το `slab-opening-ghost-renderer.ts` **διαγράφηκε**
  (νεκρό — grep επιβεβαίωσε μόνο consumer το πρώην placement branch). Το edge-midpoint `+vertex` hover
  affordance (branch 2) **δεν** είναι placement ghost — μένει bespoke σκόπιμα. Test:
  `hooks/drawing/__tests__/slab-opening-completion-preview.test.ts` (3 tests, PASS).
- **Deferred/blocked (1):** `MepSegmentGhostRenderer.ts` **δεν** διαγράφηκε — παραμένει sole-non-test
  importer του πέραν του δικού του migrated hook: το χρησιμοποιεί **και** το
  `components/dxf-layout/proposal-ghost-paint.ts` (ADR-426/554, MEP auto-design proposal ghosts —
  διαφορετικό feature, εκτός scope).

**Γνωστή, αποδεκτή απόκλιση (και στις 7 migrated οικογένειες):** το ghost παίρνει layer από
`getDefaultLayerId()` (canonical placement layer) ενώ το commit path παίρνει `currentLevelId` από το
tool. Επηρεάζει μόνο assignment metadata (όχι fill/outline/lineweight στο ghost frame), άρα δεν σπάει
το WYSIWYG-by-identity προσδοκία.

**Follow-up καθαρισμού (δεν έγινε σε αυτό το island, για να αποφευχθεί shared-file churn):** οι μέθοδοι
`getGhostFootprint`/`getGhostSymbol` στα `useMep*Tool.ts`/`useOpeningTool.ts` έμειναν ως **unused
optional** props στα migrated leaf hooks (π.χ. `getGhostFootprint` σε `UseMepManifoldGhostPreviewProps`),
και τα mount `.tsx` αρχεία συνεχίζουν να τα περνάνε — ασφαλές (TS δεν κάνει excess-property-check σε
typed μεταβλητή), αλλά dead πλέον. Μπορούν να αφαιρεθούν σε μελλοντικό, μικρότερο cleanup pass.

### Νησίδα 3 — Twin dispatch ladders (preview ↔ commit) · **Severity: MEDIUM (maintainability)**
`applyEntityPreview` (`apply-entity-preview.ts`, preview) και `commitDxfGripDragModeAware`
(`hooks/grips/grip-commit-adapters.ts`, commit) είναι **δύο παράλληλες** ~15–30-branch σκάλες πάνω
στους **ίδιους** `*GripKind` discriminators. Τα *transforms* μοιράζονται (κάθε commit ξανατρέχει την
**ίδια** `apply*GripDrag` fn του preview — ADR-561), αλλά το **routing είναι διπλό** και κρατιέται σε
parity **μόνο** με σχόλια ADR. Νέα οικογένεια οντότητας απαιτεί edit **και** στις δύο σκάλες (+
`entity-preview-types.ts`, `grip-projections.ts`, `grip-drag-preview-transform.ts`). Δεν είναι
απόκλιση εμφάνισης — είναι δομικό ρίσκο συντήρησης. (Υπάρχει και **τρίτη** επιφάνεια routing για 3D
στο `bim-3d/animation/bim3d-grip-preview-builders.ts`, που όμως επαναχρησιμοποιεί τα ίδια transforms.)

### Νησίδα 4 — Line ROTATION: διαφορετική geometry engine preview vs commit · **Severity: LOW**
Preview: `applyLineRotationDrag → applyAxisBoxGripDrag('rotation') → rotateAxisPointsAboutPivot`.
Commit: `commitLineGripDrag → sweptAngleDegAboutPivot + RotateEntityCommand → rotateEntity`. Μοιράζονται
το **angle** SSoT (`sweptAngleDegAboutPivot`), αλλά εφαρμόζουν τη γεωμετρία μέσω **δύο** υλοποιήσεων.
Μαθηματικά ισοδύναμο για γραμμή 2 σημείων, **αλλά όχι identity** — σε αντίθεση με arc/polyline (ADR-561)
που ενοποιήθηκαν και οι δύο πλευρές στο `rotateEntity`. (Σχετική ασυμμετρία: το rectangle preview το
περιστρέφει ως polyline μέσω `rotateEntity`, ενώ το commit το «εκρήγνυται» σε πραγματικό `polyline` με
`UpdateEntityCommand` — ίδιες κορυφές, διαφορετική αναπαράσταση στο release.)

---

## 6. Καλά patterns ήδη σε ισχύ (προς επέκταση)

- **Preview geometry SSoT:** `rendering/ghost/apply-entity-preview.ts` + `apply-parametric-box-preview.ts` — ένα transform engine, κοινό σε Move / grip / body-drag· κάθε branch `apply*GripDrag → compute*Geometry`.
- **preview ≡ commit «by identity»:** κάθε commit ξανατρέχει την **ίδια** `apply*GripDrag` fn (ADR-560/561).
- **WYSIWYG bridge:** `bim-preview-render.ts` (`BimPreviewRenderer`) + `draw-real-entity-preview.ts` βάφουν το ghost μέσω του **πραγματικού** `EntityRendererComposite` (ADR-550).
- **Ένα RAF/clear harness:** `useCanvasGhostPreview.ts` για όλα τα ghost hooks (ADR-398 §4).
- **Placement-ghost assembly SSoT:** `bim/placement/placement-ghost-assembly.ts` + `hooks/drawing/wysiwyg-preview-shared.ts` (`toWysiwygPreviewEntity`) — «καμία νέα γεωμετρία».
- **Dual resolvers σε ένα `entity.geometry`:** 2D `EntityRendererComposite` + 3D `Bim*Converter` διαβάζουν την **ίδια** `entity.geometry` που γράφουν οι κοινές `compute*Geometry` («ONE catalog SSoT + TWO resolvers»).
- **3D vertical datum SSoT:** `bim-3d/converters/bim-three-shape-helpers.ts` (ADR-448)· 2D↔3D footprint ring μέσω `buildWallFootprintRing`.
- **Ghost UX policy SSoT:** `rendering/ghost/ghost-policy.ts` (`GHOST_ALPHA`) κοινό σε Canvas2D + three.js.

---

## 7. Συστάσεις / Follow-up (μη-δεσμευτικές — καμία δεν υλοποιείται σε αυτό το ADR)

| # | Σύσταση | Νησίδα | Προτεραιότητα |
|---|---|---|---|
| Σ1 | Εφαρμογή `resolveEntityRenderStyle` στο 2D primitive creation paint (byte-identical rubber-band με το τελικό stroke) | 1 | LOW |
| Σ2 | ✅ **IMPLEMENTED (2026-07-05)** — Δρομολόγηση MEP/opening **placement** ghosts μέσω committed renderers (ή shared symbol-draw helper), ώστε placement ghost == commit paint όπως ήδη το edit. Υλοποιήθηκε ως `renderWysiwygPlacementGhost` (`bim/ghosts/wysiwyg-placement-ghost.ts`) σε 7/8 οικογένειες· `mep-segment` deferred (shared file εκτός scope), `slab-opening` blocked (validation-gated hosted placement — βλ. §5 νησίδα 2) | 2 | MEDIUM |
| Σ3 | Collapse των twin preview/commit dispatch ladders σε **ένα** table keyed by `grip-kind` (single registry, preview & commit διαβάζουν το ίδιο) | 3 | MEDIUM |
| Σ4 | Ενοποίηση **line rotation** (και ιδανικά όλων των rotations) σε **μία** geometry engine (`rotateEntity`), ώστε line preview↔commit να γίνουν identity όπως arc/polyline | 4 | LOW |

Αν/όταν αναληφθούν, να προστεθούν στο `.claude-rules/pending-ratchet-work.md` (κανόνας N.0.2).

---

## 8. Δήλωση ποιότητας (GOL)

✅ **Google-level: YES** — Ο κρίσιμος άξονας (γεωμετρία φαντάσματος = γεωμετρία commit) είναι
ενοποιημένος SSoT σε **κάθε** τύπο οντότητας, **κάθε** κατάσταση (γέννηση/μετακίνηση/επεξεργασία/
περιστροφή) και **2D+3D**, με αρχιτεκτονικά επιβεβλημένο «preview ≡ commit». Οι 4 νησίδες είναι
**paint/routing** (στυλιστική πιστότητα & maintainability), **όχι** απόκλιση σχήματος — τεκμηριωμένες
με severity + συστάσεις, χωρίς κανένα «preview δείχνει άλλο απ' ό,τι φτιάχνεται» εύρημα.

---

## 9. Appendix — Ευρετήριο κρίσιμων αρχείων

**Επιφάνεια / pipeline:** `canvas-v2/preview-canvas/{PreviewCanvas.tsx, PreviewRenderer.ts,
preview-canvas-handle.ts, preview-entity-paint.ts, preview-entity-dispatch.ts,
preview-entity-renderers.ts, preview-dimension-renderer.ts, bim-preview-render.ts}`

**Γέννηση (generator):** `hooks/drawing/{drawing-preview-generator.ts, useUnifiedDrawing.tsx,
wysiwyg-preview-shared.ts}` + `hooks/drawing/*-preview-helpers.ts` · `bim/placement/placement-ghost-assembly.ts`

**Editing SSoT:** `rendering/ghost/{apply-entity-preview.ts, apply-parametric-box-preview.ts,
apply-entity-preview-helpers.ts, draw-real-entity-preview.ts, draw-ghost-entity.ts, ghost-policy.ts,
entity-preview-types.ts}`

**Commit / routing:** `hooks/grips/{grip-commit-adapters.ts, grip-projections.ts,
grip-dxf-drag-preview-resolver.ts, grip-drag-preview-transform.ts, primitive-rotation-drag.ts,
grip-parametric-commits.ts, grip-linear-commits.ts, grip-primitive-rotate-commits.ts}`

**Harness / hooks:** `hooks/tools/{useCanvasGhostPreview.ts, useMovePreview.ts, useRotationPreview.ts,
useGripGhostPreview.ts, useEntityBodyDragPreview.ts, useMirrorPreview.ts, useScalePreview.ts,
useStretchPreview.ts}`

**Γεωμετρία SSoT:** `bim/geometry/*-geometry.ts` (`compute*Geometry`) ·
`bim-3d/converters/{bim-three-shape-helpers.ts, bim-three-structural-converters.ts, dxf-arc-circle-sample.ts}`

**Bespoke placement ghosts (νησίδα 2):** `bim/mep-manifolds/MepManifoldGhostRenderer.ts`,
`bim/electrical-panels/ElectricalPanelGhostRenderer.ts`, `bim/mep-boilers/MepBoilerGhostRenderer.ts`,
`bim/mep-water-heaters/MepWaterHeaterGhostRenderer.ts`, `bim/mep-radiators/MepRadiatorGhostRenderer.ts`,
`bim/mep-segments/MepSegmentGhostRenderer.ts`, `bim/renderers/OpeningRenderer.ts` · hooks
`hooks/tools/useMep*GhostPreview.ts`, `useOpeningGhostPreview.ts`, `useSlabOpeningGhostPreview.ts`

**3D previews:** `bim-3d/animation/bim3d-grip-preview-builders.ts`, `bim-3d/gizmo/bim3d-resize-bridge.ts`,
`bim-3d/placement/{ColumnPlacementGhost.ts, WallPlacementGhost.ts, BeamFromWallGhost.ts, ...}`,
`bim-3d/converters/dxf-grip-ghost-paint.ts`

**Mount wiring:** `components/dxf-layout/{canvas-layer-stack-preview-mounts.tsx,
canvas-layer-stack-tool-preview-mounts.tsx, CanvasLayerStack.tsx}`

---

## 10. Changelog

- **2026-07-05** — Δημιουργία. Audit/census των φαντασμάτων του DXF Viewer σε κάθε κατάσταση (2D+3D),
  βάσει 3 παράλληλων Explore agents + χειροκίνητης επιβεβαίωσης της νησίδας MEP. Ετυμηγορία: γεωμετρία =
  ενοποιημένη SSoT· 4 νησίδες paint/routing (creation-primitive-style, MEP/opening placement paint, twin
  dispatch ladders, line-rotation engine). Καμία αλλαγή runtime — μόνο καταγραφή + συστάσεις Σ1–Σ4.
- **2026-07-05** — **Υλοποίηση Σ2 (Νησίδα 2, `IMPLEMENTATION_island2`).** Νέο shared SSoT helper
  `renderWysiwygPlacementGhost` (`bim/ghosts/wysiwyg-placement-ghost.ts`) που δρομολογεί MEP/opening
  placement ghosts μέσω `BimPreviewRenderer` → `EntityRendererComposite` (ίδιο committed pipeline με το
  edit), χρησιμοποιώντας τους **ίδιους** commit builders (`build*Entity`) για WYSIWYG-by-identity.
  **Migrated (7 οικογένειες, leaf hooks σε `hooks/tools/`):** manifold, electrical-panel, mep-boiler,
  mep-water-heater, mep-radiator, mep-fixture, opening. **Deleted bespoke renderers:**
  `MepManifoldGhostRenderer.ts`, `ElectricalPanelGhostRenderer.ts`, `MepBoilerGhostRenderer.ts`,
  `MepWaterHeaterGhostRenderer.ts`, `MepRadiatorGhostRenderer.ts`, `MepFixtureGhostRenderer.ts` (+ test),
  `opening-ghost-renderer.ts`. **Deferred/blocked (2):** `mep-segment` — `MepSegmentGhostRenderer.ts`
  παραμένει (shared χρήση από `proposal-ghost-paint.ts`, εκτός scope)· `slab-opening` — παραμένει bespoke
  σκόπιμα (`buildSlabOpeningEntity` validation-gated by host slab, identity θα έκανε το ghost να
  εξαφανίζεται στα όρια πλάκας). Consistency grep επιβεβαίωσε: **καμία** εναπομείνασα αναφορά στους
  διαγραμμένους renderers σε όλο το `dxf-viewer`. Follow-up καθαρισμού: `getGhostFootprint`/
  `getGhostSymbol` στα tool hooks + mount props έμειναν ως dead-but-safe (unused optional) — μελλοντικό
  μικρό cleanup pass.
- **2026-07-06** — **Υλοποίηση Σ2b (slab-opening placement ghost → WYSIWYG).** Το τελευταίο bespoke
  placement ghost της Νησίδας 2 migrate-αρίστηκε στο ίδιο `renderWysiwygPlacementGhost` SSoT (πραγματικός
  `SlabOpeningRenderer` via `BimPreviewRenderer`). Νέος preview-tolerant builder
  `buildSlabOpeningPreviewEntity` (`slab-opening-completion.ts`) που μοιράζεται το ΙΔΙΟ SSoT με το strict
  commit builder μέσω κοινού `assembleSlabOpeningEntity` helper (μηδέν διπλότυπη construction, N.0.2) και
  παρακάμπτει **ΜΟΝΟ** το `outlineOutsideSlab` hard-reject. Big-player edge behaviour: εντός πλάκας →
  πλήρες WYSIWYG· εκτός → 🔴 status schematic (`resolveGhostStatusColor('overlap')` + `drawStatusGhostPolygon`,
  κοινό SSoT με δοκάρι/κολώνα) αντί για κενό frame (Revit: opening + warning). Wiring: ο leaf
  `useSlabOpeningGhostPreview` παίρνει `getHostSlab` (mirror του `getHostWall` στο `useOpeningGhostPreview`)
  — νέο prop σε `SlabOpeningGhostPreviewMountProps`, `canvas-layer-stack-types.ts`, payload στο
  `CanvasSection.tsx`. **Deleted:** `bim/slab-openings/slab-opening-ghost-renderer.ts` (νεκρό μετά τη
  migration· grep επιβεβαίωσε μοναδικό consumer το πρώην placement branch). Το edge-midpoint `+vertex`
  hover affordance (branch 2) έμεινε bespoke σκόπιμα (δεν είναι placement ghost). Test:
  `hooks/drawing/__tests__/slab-opening-completion-preview.test.ts` (3 PASS). CHECK 6B: staged ADR-040
  (payload change στο architecture-critical `CanvasSection.tsx`, καμία αλλαγή subscription).
