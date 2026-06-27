# HANDOFF — 3D wall-placement overlays: mustard fix + FULL 2D parity (Revit/Maxon-grade)

**Ημερομηνία:** 2026-06-27
**ADR βάσης:** ADR-537 (3D raw-DXF) + **νέο SSoT `post-fx-overlay-pass.ts`** (αυτό το session). Πιθανό νέο ADR για το wall-placement parity.
**Status:** Προηγούμενο task (post-FX overlay pass: underlay + gizmo) **IMPLEMENTED + jest GREEN + tsc clean (UNCOMMITTED)**. **ΝΕΟ TASK = αυτό το handoff.**
**Commit:** ΤΟΝ ΚΑΝΕΙ Ο GIORGIO (N.(-1)). ⚠️ **SHARED WORKING TREE** με άλλον agent → **re-read κάθε αρχείο πριν το edit**.
**Γλώσσα:** Απάντα ΠΑΝΤΑ στα Ελληνικά.

---

## 🎯 ΚΥΡΙΟ TASK ΝΕΟΥ SESSION

Στην **3D προβολή** (`/dxf/viewer` → «3D Προβολή»), με **ενεργό εργαλείο τοίχου** (σχεδίαση), ο Giorgio βλέπει 3 προβλήματα (στιγμιότυπο `Στιγμιότυπο οθόνης 2026-06-27 204747.jpg`). Ζητάει **Revit/Maxon-grade, FULL ENTERPRISE + FULL SSOT, ΠΛΗΡΗ ΙΣΟΤΙΜΙΑ με τον 2D καμβά, μία πηγή αλήθειας, μηδέν διπλότυπα.**

> **ΥΠΟΧΡΕΩΤΙΚΟ:** ΠΡΙΝ γράψεις κώδικα, κάνε **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** για να βρεις υπάρχοντα μηχανισμό και να ΜΗΝ φτιάξεις διπλότυπο. Οι ακριβείς θέσεις είναι παρακάτω — επαλήθευσέ τες με grep (shared tree, μπορεί να άλλαξαν).

### Πρόβλημα 1 — Wall ghost: μουσταρδί + «μακριά από τον κέρσορα»
- **Αρχείο:** `bim-3d/placement/WallPlacementGhost.ts:~48` → `MeshStandardMaterial({ transparent:true, opacity:0.4 })`, `scene.add(mesh)` (~γρ.107) **ΧΩΡΙΣ** `registerPostFxOverlay`. Instantiate: `bim-3d/placement/use-bim3d-wall-placement.ts:~74`.
- **Μουσταρδί = ΙΔΙΑ ΡΙΖΑ** με underlay/gizmo (translucent+lit στο main scene → SSAO tint στο settle). **FIX = register στο `post-fx-overlay-pass`** (δες «ΜΗΧΑΝΙΣΜΟΣ» κάτω).
- **«Μακριά από τον κέρσορα»:** SSoT audit του projection chain (`raycast-floor-point.ts` → `world-to-scene-point.ts worldToPlanMm` → `coordinate-transforms.ts worldToDxfPlan`) **ΔΕΝ βρήκε δομικό offset** (self-consistent). 🔴 **Browser-repro απαραίτητο** πριν «διορθώσεις» κάτι — ίσως είναι start-point ή floor-elevation race, ΟΧΙ projector bug. Μην αλλάξεις τον projector στα τυφλά.

### Πρόβλημα 2 — Ο «κύβος»: 3D OSNAP marker = μουσταρδί + ΔΙΠΛΟΤΥΠΟ (όχι 2D-parity)
- **Αρχείο:** `bim-3d/placement/PlacementSnapMarker.ts` (γεωμετρία στο `bim-3d/shared/snap-marker-core.ts:~41` = `EdgesGeometry(BoxGeometry(2,2,2))` + `LineBasicMaterial({transparent:true, depthTest:false})`, renderOrder 1999). Show/hide: `use-bim3d-wall-placement.ts:~178-179`.
- **(α) Μουσταρδί:** translucent line στο main scene χωρίς εγγραφή → register στο overlay pass.
- **(β) ΔΙΠΛΟΤΥΠΟ:** στον 2D καμβά η έλξη = **επίπεδο τετράγωνο glyph**, ΟΧΙ 3D κύβος. **ΥΠΑΡΧΕΙ ΗΔΗ SSoT** `SnapIndicatorGlyph` (ADR-542) που καθρεφτίζει το 2D glyph (memory: `reference_3d_snap_markers.md` — NEW `SnapIndicatorGlyph` screen-space SVG+label, `computeSnap3DHover`, `Snap3DOverlayStore`, `BimSnapIndicatorOverlay3D`). Ο placement κύβος = **παράλληλος μηχανισμός**. **Ο Giorgio δεν τον θέλει** → αντικατάστησέ τον με το 2D-parity SSoT (`SnapIndicatorGlyph`/ADR-542), ΜΗΝ φτιάξεις νέο. ⚠️ SSoT audit ΠΡΩΤΑ: επιβεβαίωσε πώς ζει το ADR-542 glyph και αν το wall-placement μπορεί να το χρησιμοποιήσει αντί του `PlacementSnapMarker`.

### Πρόβλημα 3 — Δυναμικές ενδείξεις: κενό parity 2D↔3D
- **ΥΠΑΡΧΟΥΝ ήδη στο 3D (parity, μην τα ξαναφτιάξεις):** CAD crosshair `bim-3d/viewport/BimCrosshairOverlay3D.tsx`, HUD μήκος/γωνία `bim-3d/viewport/wall-hud/WallHudOverlay3D.tsx`, alignment tracking `bim-3d/viewport/tracking/Tracking3DOverlay.tsx` (όλα reuse 2D painters SSoT).
- **ΛΕΙΠΟΥΝ (2D-only, δεν mountάρονται στο 3D `BimViewport3D`):**
  - **Dynamic Input** (πληκτρολογούμενα L/θ): `components/dxf-layout/DynamicInputSubscriber.tsx` + `systems/dynamic-input/` (`DynamicInputSystem`). Στο 2D mountάρεται στο `CanvasLayerStack.tsx:~423`.
  - **Radial Command Ring** (ADR-513, Μήκος/Γωνία/Πάχος/Ύψος μετά το 1ο κλικ): `systems/dynamic-input/components/RadialCommandRing.tsx`, render μέσω `DynamicInputSubscriber.tsx:~104` όταν `wallAwaitingEnd`.
- **TASK:** mount τα ίδια 2D SSoT components στο 3D viewport (`BimViewport3D.tsx`) — **reuse, ΟΧΙ διπλότυπο**. (Polar tracking F8/F10 είναι ήδη γνωστό gap, `polarEnabled:false` στο `use-bim3d-wall-placement.ts:~130` — χαμηλή προτεραιότητα.)

### «Το βελάκι/crosshair δεν φαίνεται»
- Ο `BimCrosshairOverlay3D` υπάρχει (parity). Γιατί δεν φαίνεται → 🔴 browser-repro (ίσως mount/z-index/gate). Διερεύνησε ΠΡΙΝ αλλάξεις.

---

## ✅ ΤΙ ΥΛΟΠΟΙΗΘΗΚΕ ΑΥΤΟ ΤΟ SESSION (UNCOMMITTED — ΜΗΝ το ξαναφτιάξεις, ΧΡΗΣΙΜΟΠΟΙΗΣΕ το)

**ΝΕΟ SSoT: `bim-3d/scene/post-fx-overlay-pass.ts`** — Revit/Maxon-grade «post-FX UI/reference overlay pass». Λύνει το **μουσταρδί** ριζικά: ΟΛΑ τα translucent UI/reference overlays που μπαίνουν στο main scene βάφονται από τον SSAO composer στο idle (warm sun + AO multiply). Αυτά ζωγραφίζονται πλέον σε **ξεχωριστό forward pass ΜΕΤΑ το SSAO**, depth-correct (materials ορίζουν depth), ποτέ AO/tone.

### ΜΗΧΑΝΙΣΜΟΣ (πώς να εγγράψεις νέο overlay — ghost + snap στο Task 1/2):
1. Ο owner κρατά το root του **`visible=false`** (ώστε το MAIN render να το παρακάμπτει).
2. Στον constructor: `this.unreg = registerPostFxOverlay(scene, () => <shownRoots[]>)` — provider που επιστρέφει τα roots που πρέπει να φανούν ΑΥΤΟ το frame (π.χ. `() => this.shown ? [this.mesh] : []`).
3. Στο dispose: `this.unreg()`.
4. Το show/hide γίνεται με **flag** (π.χ. `this.shown=true/false`), ΟΧΙ με `root.visible=true` (το root μένει false· το pass το flip-άρει transient).
5. Αν υπάρχει public `get visible()` ή external consumers του `.visible`, γύρνα τους στο flag (όπως έγινε στο gizmo) — μηδέν regression.

**Registry = scene-scoped** (`WeakMap<scene, Set<provider>>`) → χωρίς cross-viewport bleed. API: `registerPostFxOverlay(scene, provider)`, `collectPostFxOverlayRoots(scene)`, `renderPostFxOverlays(renderer, scene, camera)`, `PostFxOverlayPass extends Pass`.

**Wiring (ΗΔΗ έτοιμο):** `ssao-modulator.ts` (PostFxOverlayPass ανάμεσα SSAO↔CopyPass· `renderPostFxOverlays` στα `renderRaster()`+`disableSSAO()`), `section-scene-controller.ts` (μετά τα caps). Το pass τρέχει σε ΟΛΑ τα paths (raster/SSAO/section).

**Owners που ΗΔΗ εγγράφονται (παραδείγματα προς μίμηση):**
- `converters/DxfToThreeConverter.ts` — underlay (wireframe+text), `visible=false` + register/unregister.
- `gizmo/bim-gizmo-overlay.ts` — gizmo (axes/snap/base-marker)· decoupling `.visible`→`active`/`snapShown`/`basePointShown` flags· public `get visible()`→`active`.

**Αρχεία που άλλαξαν (9, UNCOMMITTED):** `scene/post-fx-overlay-pass.ts` (NEW, αντικατέστησε το `underlay-pass.ts` που διαγράφηκε), `converters/DxfToThreeConverter.ts`, `converters/dxf-text-3d.ts`, `gizmo/bim-gizmo-overlay.ts`, `lighting/ssao-modulator.ts`, `scene/scene-rendering-subsystems.ts`, `scene/ThreeJsSceneManager.ts`, `scene/section-scene-controller.ts`, `docs/.../ADR-537-*.md`. **Tests:** NEW `scene/__tests__/post-fx-overlay-pass.test.ts` (11 jest, registry+render+pass) + converter registry assertion.

**Έλεγχοι:** δικά μου suites GREEN (post-fx-overlay-pass, DxfToThreeConverter, dxf-text-3d, ΟΛΑ τα gizmo). Τα 8 δικά μου αρχεία **tsc-clean** (project exit 2 = προϋπάρχοντα errors ΑΛΛΩΝ agents· 4 failing `bim3d-resize-bridge` circular-column tests = ΟΧΙ δικά μου).

---

## 🧭 SSoT AUDIT — τρέξε ΠΡΙΝ γράψεις (grep)
```
# Πώς εγγράφονται overlays (μίμησε αυτό για ghost+cube)
grep -rn "registerPostFxOverlay" src/subapps/dxf-viewer/bim-3d
# Wall placement ghost + snap marker (Task 1/2)
grep -rn "WallPlacementGhost\|PlacementSnapMarker\|createSnapMarkerMesh\|scene.add" src/subapps/dxf-viewer/bim-3d/placement src/subapps/dxf-viewer/bim-3d/shared
# 2D-parity snap glyph SSoT (ADR-542) — αντικατάσταση του κύβου (Task 2β)
grep -rn "SnapIndicatorGlyph\|BimSnapIndicatorOverlay3D\|computeSnap3DHover\|Snap3DOverlayStore" src/subapps/dxf-viewer
# Dynamic input + radial ring (Task 3) — reuse 2D, μην διπλασιάσεις
grep -rn "DynamicInputSubscriber\|DynamicInputSystem\|RadialCommandRing" src/subapps/dxf-viewer
# Πού mountάρεται το 3D viewport (για να βάλεις τα 2D overlays)
grep -rn "BimCrosshairOverlay3D\|WallHudOverlay3D\|Tracking3DOverlay" src/subapps/dxf-viewer/bim-3d/viewport
# Projection chain (Task 1 «μακριά από κέρσορα» — repro ΠΡΙΝ αλλαγή)
grep -rn "raycastFloorPoint\|worldToPlanMm\|worldToDxfPlan\|planMmToScenePoint" src/subapps/dxf-viewer/bim-3d
```

## 🚦 ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ
1. **Mustard fix (γρήγορο, ίδιο SSoT):** register `WallPlacementGhost` + `PlacementSnapMarker` (+ `ColumnPlacementGhost`, `MepSegmentPlacementGhost` αν είναι ίδια περίπτωση) στο `post-fx-overlay-pass` (μηχανισμός παραπάνω). Browser-verify ότι φεύγει το μουσταρδί.
2. **Cube → 2D parity:** αντικατάστησε τον `PlacementSnapMarker` κύβο με το ADR-542 `SnapIndicatorGlyph` SSoT (audit πρώτα· ίσως ο ghost-register γίνει περιττός αν περάσει στο glyph system).
3. **Dynamic input + radial ring parity:** mount `DynamicInputSubscriber` (+ `RadialCommandRing`) στο `BimViewport3D` (reuse 2D SSoT).
4. **Ghost «μακριά από κέρσορα» + «βελάκι/crosshair δεν φαίνεται»:** browser-repro → διάγνωση → fix (μην αλλάξεις projector στα τυφλά).

## 🛠️ ΚΑΝΟΝΕΣ
- **FULL SSoT:** grep ΠΡΩΤΑ, reuse, μηδέν διπλότυπα. **FULL ENTERPRISE:** no `any`/`as any`/`@ts-ignore`, αρχεία <500γρ, functions <40γρ. **Revit/Maxon-grade.**
- **2D parity = SSoT:** τα 3D overlays πρέπει να reuse-άρουν τους ΙΔΙΟΥΣ 2D painters/components (όπως ήδη κάνουν crosshair/HUD/tracking).
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process πρώτα)· default OOM → `NODE_OPTIONS="--max-old-space-size=8192"`· grep μόνο τα δικά σου αρχεία.
- **SHARED TREE:** re-read πριν edit. **Commit → Giorgio** (ΟΧΙ εσύ). Jest colocated, pure-first.
- **Pre-commit CHECK 6B/6D:** τα bim-3d render/converter αρχεία είναι perf-critical → stage ADR-537 (+ ADR-040, + ADR-542 αν αγγίξεις snap glyph) μαζί.
- Verify: `npm run dev` → `http://localhost:3000/dxf/viewer` → «3D Προβολή» → εργαλείο τοίχου → σχεδίαση (μετά hard-reload για να φύγει stale HMR).
```
