# ADR-551: Απογραφή Καμβάδων (`<canvas>`) & Viewports (2D + 3D) στο /dxf/viewer + ευκαιρίες ενοποίησης

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✏️ DRAFT (census + audit — όχι refactor) |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/` (`components/dxf-layout/`, `canvas-v2/`, `bim-3d/viewport/`, `bim-3d/scene/`) |
| **Author** | Claude (έρευνα κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-549** (census entity renderers), **ADR-550** (unified entity render contract), ADR-040 (2D preview canvas perf / micro-leaf), ADR-366 (3D BIM viewer), ADR-029 (Canvas V2), ADR-045 (viewport ready guard), ADR-046 (single coordinate transform), ADR-006 (crosshair overlay consolidation), ADR-535/542/543/544/545 (shared 2D↔3D overlays) |

---

## Summary

Η υποεφαρμογή `/dxf/viewer` έχει **ΕΝΑ κύριο interactive viewport** που **εναλλάσσεται** (swap) μεταξύ 2D και 3D — **δεν** συνυπάρχουν side-by-side. Πάνω σε αυτό το ένα region στοιβάζονται **πολλοί φυσικοί καμβάδες** (`<canvas>` DOM elements):

- **2D mode:** έως **24 φυσικά `<canvas>`** (τυπικά ~16, ελάχιστο 3) — όλα με δικό τους `getContext('2d')`.
- **3D mode:** **7 (idle) έως 8 (crop) φυσικά canvases** = **2 WebGL** (main renderer + ViewCube) + **5–6 2D overlays** projected μέσω κάμερας.
- **Viewports:** **1 κύριο** (swap 2D↔3D μέσω `ViewMode3DStore.toggle2D3D()`) · **1 nav gizmo** (ViewCube, μόνο 3D) · **2 βοηθητικά dialog-preview canvases** (εκτός κύριου viewport). **0 minimap / 0 split-view / 0 picture-in-picture.**

**Σκοπός του ADR:** χάρτα (census) του **canvas/viewport layer** — όχι των renderers (αυτό κάνει το ADR-549). Όταν δουλεύουν πολλοί agents στον ίδιο render layer, ο κίνδυνος είναι να προστεθεί **νέος ξεχωριστός καμβάς** αντί να επεκταθεί υπάρχων shared canvas (παραβίαση SSoT). Περιλαμβάνει **6 ευκαιρίες ενοποίησης** + 1 cross-cutting σύσταση.

> **Διάκριση από ADR-549/550:** Το ADR-549 μετράει τους **~57 entity renderers/converters** (τον κώδικα που ζωγραφίζει οντότητες). Το ADR-550 σχεδιάζει ΕΝΑ entity contract. **Αυτό το ADR** μετράει τις **φυσικές επιφάνειες απόδοσης** (`<canvas>` DOM + WebGL contexts + viewport regions). Canvas ≠ renderer: ένας καμβάς φιλοξενεί πολλούς renderers (π.χ. ο `DxfCanvas` τρέχει 5 renderers σε ΕΝΑ context).

---

## Context

Ο Giorgio ζήτησε: **πόσοι καμβάδες 2D+3D και πόσα viewports** χρησιμοποιούνται, με ευκαιρίες ενοποίησης. Η απάντηση δόθηκε με ανάγνωση των mount/dispatch αρχείων (όχι εκτίμηση): `CanvasLayerStack.tsx`, `BimViewport3D.tsx` + `BimViewport3DCanvasOverlays.tsx`, `scene-setup.ts`, `view-cube.ts`, `ViewMode3DStore.ts`.

**Θεμελιώδης διαχωρισμός (ADR-040 / ADR-366):** το 2D και το 3D pipeline είναι σκόπιμα ανεξάρτητα. Το 3D είναι additive overlay (z-50) πάνω από το 2D — τα 2D layers παραμένουν mounted από κάτω αλλά καλύπτονται πλήρως. Δεν συγχωνεύονται σε ένα engine, αλλά **μοιράζονται κώδικα στα overlays** (grips/crosshair/snap/HUD/tracking).

---

## 1. Census — 2D Canvas Layer Stack

Mount root: `components/dxf-layout/CanvasLayerStack.tsx` (shell, μέσω `CanvasLayerStackTransformBridge`). Όλοι οι καμβάδες έχουν **δικό τους `getContext('2d')`** — κανένας δεν είναι DOM/SVG. z-order bottom→top:

| z | # | Canvas | Path | Ρόλος | Mount |
|---|---|---|---|---|---|
| 0 | 1 | `GridUnderlayCanvas` | `components/dxf-layout/GridUnderlayCanvas.tsx` | Adaptive grid (κάτω από floorplan) | Πάντα |
| 0 | 2 | `FloorplanBackgroundCanvas` | `floorplan-background/components/FloorplanBackgroundCanvas.tsx` | Raster/PDF background (PDF μέσω ΙΔΙΟΥ ctx → 0 επιπλέον canvas) | Όταν `floorId` |
| 0 | 3 | `LayerCanvas` | `canvas-v2/layer-canvas/LayerCanvas.tsx` | Area-fill/zone polygons + selection box | Όταν `showLayerCanvas` |
| 5 | 4 | `FloorUnderlayOverlay` | `components/dxf-layout/FloorUnderlayOverlay.tsx` | Faded DXF άλλων ορόφων (xref/underlay) | Πάντα στο DOM |
| 10 | 5 | `DxfCanvas` | `canvas-v2/dxf-canvas/DxfCanvas.tsx` | **Κύριο entity render** (DxfRenderer+Selection+Grid+Ruler+Guide σε ΕΝΑ ctx)· sole pointer owner | Όταν `showDxfCanvas` |
| 10 | 6 | `RiserThroughOverlay` | `components/dxf-layout/RiserThroughOverlay.tsx` | Cross-floor riser glyphs | Πάντα στο DOM |
| 10 | 7 | `HeatLoadOverlay` | `components/dxf-layout/HeatLoadOverlay.tsx` | Heat-load heatmap (ADR-422 L1) | Πάντα στο DOM |
| 10 | 8 | `PipeSizingOverlay` | `components/dxf-layout/PipeSizingOverlay.tsx` | DN badges (ADR-422 L3) | Πάντα στο DOM |
| 10 | 9 | `HydraulicBalancingOverlay` | `components/dxf-layout/HydraulicBalancingOverlay.tsx` | ΔP/kv badges (ADR-422 L4) | Πάντα στο DOM |
| 10 | 10 | `StructuralUtilizationOverlay` | `components/dxf-layout/StructuralUtilizationOverlay.tsx` | Reinforcement utilization (ADR-485) | Πάντα στο DOM |
| 10 | 11 | `StructuralDiagramOverlay` | `components/dxf-layout/StructuralDiagramOverlay.tsx` | M/V/N diagrams (ADR-483) | Πάντα στο DOM |
| 10 | 12 | `StructuralWarningOverlay` | `components/dxf-layout/StructuralWarningOverlay.tsx` | Warning halos/⚠ (ADR-490) | Πάντα στο DOM |
| 11 | 13 | `EnvelopeOverlay` | `components/dxf-layout/EnvelopeOverlay.tsx` | ETICS θερμοπρόσοψη (ADR-396) | Πάντα στο DOM |
| 11 | 14 | `HomeRunWiresOverlay` | `components/dxf-layout/HomeRunWiresOverlay.tsx` | Electrical home-run wires | Πάντα στο DOM |
| 14 | 15-21 | `ProposalGhostOverlay` ×7 | `components/dxf-layout/canvas-layer-stack-*-proposal-ghost.tsx` | Proposal ghosts (water/drainage/heating/electrical/hvac/fire/gas) — **κοινό component, 7 mounts** | Ανά proposal active |
| 14 | 22 | `GuideFollowGhostOverlay` | `components/dxf-layout/GuideFollowGhostOverlay.tsx` | Foundation follow-ghost σε guide drag | Σε guide drag (+linger) |
| 15 | 23 | `PreviewCanvas` | `canvas-v2/preview-canvas/PreviewCanvas.tsx` | **ΕΝΑΣ shared canvas για ΟΛΑ τα tool ghosts** (rotate/move/mirror/scale/stretch/grip/trim/extend/polar/OTRACK/wall-HUD…) — όλα τα tool hooks κάνουν `null` + paint εδώ | Πάντα |
| 18 | 24 | `Focus2DOverlay` | `accessibility/Focus2DOverlay.tsx` | Keyboard-focus accessibility outline | Όταν `mode==='2d'` |

**Καταμέτρηση 2D:** max **24** · τυπικά **~16** (standard features, χωρίς ενεργά MEP proposals) · ελάχιστο **3** (grid + dxf + preview).

**Μη-canvas overlays (HTML/SVG — ΔΕΝ μετρώνται ως καμβάδες):** `CrosshairCompositor` (z-20, HTML div + translate3d), `SnapIndicatorGlyph` (z-30, SVG), polygon-crop/lasso/zoom-window/auto-area/region-perimeter (SVG/div), `ClashMarkerLayer` (z-60, div), `RulerCornerBox` (z-30, button).

---

## 2. Census — 3D Viewport (Three.js)

Mount root: `bim-3d/viewport/BimViewport3D.tsx` + `BimViewport3DCanvasOverlays.tsx`. Το 3D div (z-50) καλύπτει όλο το 2D stack.

| # | Canvas | Context | Path | Ρόλος | Mount |
|---|---|---|---|---|---|
| 1 | Main `WebGLRenderer.domElement` | **WebGL2** | `bim-3d/scene/scene-setup.ts` (`new THREE.WebGLRenderer` → `container.appendChild`) | Πλήρες scene BIM/DXF render. **Path-tracer/SSAO/SelectionOutline/Envmap reuse το ΙΔΙΟ context (FBOs) → 0 νέα canvas** | Πάντα |
| 2 | **ViewCube** mini-renderer 160×160 | **WebGL2 (2ο context)** | `bim-3d/viewport/view-cube/view-cube.ts` (`document.createElement('canvas')` + ξεχωριστός `WebGLRenderer`) | Navigation gizmo (face/edge/corner snap). Οι face/arrow textures είναι offscreen `CanvasTexture` — **όχι** στο DOM | Πάντα (3D) |
| 3 | ✅ **`BimOverlayDispatchCanvas`** (ADR-555) | 2D | `bim-3d/viewport/overlay-dispatch/BimOverlayDispatchCanvas.tsx` | **ΕΝΑΣ** dispatch canvas — folds grips (ADR-535) + DXF hover-glow (ADR-538) + wall-HUD (ADR-543) + tracking (ADR-543) + placement (ADR-544) σε z-ordered multi-pass· reuse όλους τους 2D painters | Πάντα |
| ~~4–7~~ | ~~`DxfHoverGlowOverlay2D` / `WallHudOverlay3D` / `Tracking3DOverlay` / `BimPlacementOverlay2D`~~ | — | — | **ΑΦΑΙΡΕΘΗΚΑΝ** — folded στο #3 (ADR-555) | — |
| 8 | `CropRegionOverlay` | 2D | `bim-3d/render/crop-region/CropRegionOverlay.tsx` | Photoshop crop dim/handles (interactive pointer-events → ΜΕΝΕΙ ξεχωριστό, §5.4) | **Μόνο σε crop** |

**Καταμέτρηση 3D:** idle **2** (1 WebGL μετά ADR-553 + 1 2D dispatch μετά ADR-555) · max **3** (crop). _(Ιστορικά: idle 7 = 2 WebGL + 5 2D πριν ADR-553/555.)_ 

**Μη-canvas overlays (HTML/SVG):** `BimCrosshairOverlay3D` (HTML div, ADR-545), `BimSnapIndicatorOverlay3D` (SVG, ADR-542), `DynamicInput3DLeaf`/`RadialCommandRing` (DOM, ADR-513), `ClashMarkers3D`/`ProposalGhost3D`/`Column/BeamDiagram3D` (DOM transforms).

**Offscreen WebGL (εκτός viewport stack — ΔΕΝ μετρώνται):** `createOffscreenCaptureRenderer` (MP4/PDF export), `WallTypePreviewRenderer` / `SlabTypePreviewRenderer` (thumbnail pickers). Επίσης οι M/V/N text-sprite textures = offscreen `CanvasTexture`.

---

## 3. Viewports

| Item | Τιμή |
|---|---|
| **Κύρια interactive viewports** | **1** (`CanvasSection` → `CanvasLayerStack`) |
| **2D ↔ 3D** | **Swap, ΟΧΙ coexist.** SSoT: `bim-3d/stores/ViewMode3DStore.ts` (`ViewMode3D = '2d'\|'3d-raster'\|'3d-preview'\|'3d-final'`, action `toggle2D3D()`). Entry: `ViewMode3DToggleButton`· return: «← 2D» button στο `BimViewport3D` |
| **2D transform SSoT** | `systems/cursor/ImmediateTransformStore.ts` (`{scale,offsetX,offsetY}`, module singleton)· wrapper `hooks/canvas/useViewportManager.ts` |
| **3D camera** | `bim-3d/scene/ThreeJsSceneManager.ts` + `OrbitControls` (Persp/Ortho). **Ανεξάρτητο** — δεν διαβάζει/γράφει `ImmediateTransformStore` |
| **Κοινή viewport abstraction** | **Καμία** (2 ανεξάρτητα transform systems) |
| **Nav gizmo** | 1 (ViewCube, 3D only — όχι drawing region) |
| **Minimap / split-view / PiP / overview** | **0** (κανένα) |
| **Βοηθητικά dialog-preview canvases** | 2: `ui/text-templates/preview/TextTemplatePreview.tsx`, `ui/components/detail-sheet/DetailSheetDialog.tsx` (εκτός κύριου viewport) |

> Σημ.: το `systems/viewport/ViewportContext.tsx` ΔΕΝ είναι camera viewport — διαχειρίζεται annotation scale (1:50/1:100) για dimension text.

---

## 4. Συγκεντρωτική καταμέτρηση

| Επίπεδο | 2D | 3D | Σχόλιο |
|---|---|---|---|
| Φυσικά `<canvas>` (max) | **24** | **8** | 3D = 2 WebGL + 6 × 2D overlay |
| Φυσικά `<canvas>` (typical/idle) | ~16 | 7 | |
| Φυσικά `<canvas>` (min) | 3 | 7 | |
| WebGL contexts | 0 | **2 → 1** (ADR-553) | ήταν main + ViewCube· ο ViewCube έγινε scissored sub-viewport του main → **1** context |
| Interactive viewports | colspan → **1** (swap) | | |
| Nav gizmo | colspan → **1** (ViewCube) | | |
| Dialog-preview canvases | colspan → **2** | | |

**Κύρια απάντηση:** **1 viewport** (swap 2D↔3D) · στο 2D έως **24** φυσικοί καμβάδες, στο 3D **7–8** (εκ των οποίων 2 WebGL) · + 1 ViewCube nav gizmo + 2 dialog previews. Κανένα minimap/split/PiP.

---

## 5. SSoT Audit & ευκαιρίες ενοποίησης

### 5.1 ✅ Ήδη σωστά (διατήρηση)
- **2D PreviewCanvas = ΕΝΑΣ shared καμβάς** για ΟΛΑ τα tool ghosts (rotate/move/mirror/scale/stretch/grip/trim/extend/polar/OTRACK/wall-HUD). Όλα τα tool hooks επιστρέφουν `null` και ζωγραφίζουν εδώ → ΕΝΑΣ backing store αντί N. **Πρότυπο προς μίμηση.**
- **PDF = 0 επιπλέον canvas** — ζωγραφίζει στο ΙΔΙΟ `FloorplanBackgroundCanvas` ctx.
- **Shared 2D↔3D overlay seams** — όλα τα 3D overlay canvases (grip/hover/wall-HUD/tracking/placement) reuse τον 2D painter (UnifiedGripRenderer/paintWallHudCore/paintAlignmentPaths/placement projector), όχι 3D-only re-implementation (ADR-535/542/543/544/545).
- **Path-tracer/SSAO/outline reuse το ΙΔΙΟ WebGL context** (FBOs) — όχι δεύτερο renderer canvas.

### 5.2 ⚠️ Ευκαιρίες ενοποίησης (canvases)

**2D:**
1. ✅ **IMPLEMENTED (ADR-552, 2026-06-29)** — **7 analytical overlays (#6–#12) → 1 shared «analytical dispatch canvas».** Πανομοιότυπο CSS/size/data-flow, **αμοιβαία αποκλειόμενα** στην πράξη, αλλά **6 άδειοι canvas backing stores έμεναν μόνιμα στο DOM** ακόμα κι όταν ανενεργά. Υλοποιήθηκε με pull model (dispatch κάνει size+clear ΜΙΑ φορά, καλεί 7 painter hooks με σειρά z-order)· paint κώδικας verbatim· 6/6 jest. **2D max 24→18, typical ~16→~10.** Βλ. **ADR-552**.
2. ✅ **IMPLEMENTED (ADR-554, 2026-06-29)** — **7 ProposalGhostOverlay (#15–#21) → 1 zero-lag proposal dispatch canvas.** Pull model (ίδιο με #1), αλλά zero-lag (`subscribeImmediateTransformFrame`) γιατί τα proposals ακολουθούν pan/zoom frame-for-frame· 7 painter hooks· **shared `paintOverlayDispatchFrame` SSoT με το ADR-552** (μηδέν duplicate). **2D max 18→12, typical ~10→~4.** Βλ. **ADR-554**.
3. ⛔ **DEFERRED (2026-06-29)** — **EnvelopeOverlay + HomeRunWires (#13–#14) → 1 z=11 BIM-annotation canvas.** SSoT audit: **ασύμβατες repaint αρχιτεκτονικές** (Envelope=React `useEffect`· HomeRunWires=zero-lag scheduler/`getImmediateTransform()` — force στο pull model θα επανέφερε το wire pan-lag bug του ADR-408 Φ7)· **ΔΕΝ είναι mutually exclusive** (συνυπάρχουν σε πραγματικό έργο → 0 άδειοι backing stores, ο waste argument δεν ισχύει)· μηδέν shared painter/projector/store· κίνδυνος perf regression (`computeEnvelopeShell` σε κάθε pan frame). Κερδίζεις 1 canvas, ρισκάρεις cross-domain coupling. **Preconditions για revisit:** (1) EnvelopeOverlay → memoized painter hook (geometry memoized, projection via args)· (2) `paintOverlayDispatchFrame` variant για zero-lag scheduler dispatch. Μέχρι τότε → ξεχωριστοί καμβάδες.

**3D:**
4. ✅ **IMPLEMENTED (ADR-555, 2026-06-29)** — **BimGripOverlay2D + DxfHoverGlowOverlay2D (#3+#4) → 1 dispatch.** ⚠️ Η αρχική υπόθεση «αμοιβαία αποκλειόμενα» ήταν **ΛΑΘΟΣ** (verified από κώδικα): grip + hover **ΣΥΝΥΠΑΡΧΟΥΝ** (hover entity B ενώ A selected). → ΟΧΙ conditional switch αλλά **z-order layering** (glow κάτω, grips πάνω). Folded μαζί με #5 σε ΕΝΑΝ dispatch canvas. Βλ. **ADR-555**.
5. ✅ **IMPLEMENTED (ADR-555, 2026-06-29)** — **WallHud + Tracking + Placement (#5+#6+#7) → ίδιος dispatch.** ⚠️ «ποτέ ταυτόχρονα» = **ΛΑΘΟΣ**: wallHud + tracking **ΣΥΝΥΠΑΡΧΟΥΝ** (tracking όλο το `tool==='wall'`, wallHud το subset `&& hasStart`)· placement genuinely exclusive. → z-ordered passes. Ενοποιήθηκαν με #4 (αντί 2 ξεχωριστά merges, **ΕΝΑΣ** unified dispatch — §5.3). Βλ. **ADR-555**.
6. ✅ **IMPLEMENTED (ADR-553, 2026-06-29)** — **ViewCube 2ο WebGL context → scissored sub-viewport του main renderer.** Ο 2ος `WebGLRenderer` αφαιρέθηκε· ο cube ζωγραφίζεται από τον main renderer ως scissored sub-viewport (Three.js `webgl_multiple_views` pattern), στο τέλος του frame μετά το post-FX (AO-immune, όπως ο selection-outline pass). Το DOM element κρατιέται ως **διάφανο hit-layer** (κανένα context) → hit-test byte-identical, zero coordinate-remap. Pure `computeViewCubeScissorRect` 5/5 jest. **3D WebGL contexts 2→1.** Βλ. **ADR-553**.

### 5.3 ⭐ Cross-cutting σύσταση (ισχυρότερο εύρημα) — ✅ IMPLEMENTED (ADR-555, 2026-06-29)
Το **2D** έχει ΕΝΑ shared `PreviewCanvas` με dispatch· το **3D** αντίθετα έσπασε σε **5 ξεχωριστά overlay canvases**. **Σύσταση (υλοποιήθηκε):** το 3D viewport υιοθέτησε το 2D pattern — **ΕΝΑΣ shared projected-overlay canvas με dispatch** (`BimOverlayDispatchCanvas`, 3D αδελφός του `paintOverlayDispatchFrame`). Τα #4 + #5 ενοποιήθηκαν μαζί σε **ΕΝΑΝ** dispatch (όχι 2 pairwise merges) με z-ordered multi-pass (5 overlay canvases → 1). Ίδιο SSoT πρότυπο και στα δύο pipelines. Κρίσιμο: το frame-level dirty/skip gate διατήρησε το ADR-549 Φ3 (no hover-lag). Βλ. **ADR-555**.

### 5.4 No-merge (τεκμηριωμένα σωστά — μην «ενοποιηθούν»)
- **GridUnderlayCanvas vs DxfCanvas:** ο grid σπάστηκε επίτηδες για z-order **κάτω** από το floorplan background. Merge → grid πάνω από την εικόνα. Σωστό ως έχει.
- **PreviewCanvas vs ProposalGhostOverlay:** ο PreviewCanvas είναι transient (σβήνεται κάθε cursor event)· τα proposal ghosts χρειάζονται cross-idle persistence. Ο διαχωρισμός διόρθωσε bug «ghost εξαφανίζεται στο πρώτο mousemove». Σωστός.
- **LayerCanvas vs DxfCanvas:** διαφορετικός renderer (LayerRenderer vs DxfRenderer), διαφορετικό περιεχόμενο (area-fill vs geometry), διαφορετικό pointer model (LayerCanvas = pointer-events-none). Όχι redundant.

### 5.5 Σύσταση χρήσης (για agents)
- **Νέο 2D tool ghost** → paint στον υπάρχοντα `PreviewCanvas` (επέστρεψε `null` από το hook). **Ποτέ** νέος `<canvas>`.
- **Νέο 2D analytical/annotation overlay** → εξέτασε reuse του dispatch (μετά το #1), αλλιώς ακολούθησε το ADR-040 leaf pattern· τεκμηρίωσε εδώ.
- **Νέο 3D overlay (grip/snap/HUD/crosshair/placement)** → reuse τον 2D painter μέσω projected canvas (ADR-535/542/545)· ιδανικά paint στον shared overlay canvas (μετά το #4/#5/§5.3). **Ποτέ** νέα 3D-only υλοποίηση.

---

## Consequences
- **Pro:** ενιαία χάρτα canvas/viewport — οι agents ξέρουν «πού ζωγραφίζω» πριν προσθέσουν νέο `<canvas>`.
- **Con:** οι μετρήσεις είναι snapshot (2026-06-29)· νέα overlays αλλάζουν τους αριθμούς → ενημέρωση changelog.
- **Εκτός scope:** η ΥΛΟΠΟΙΗΣΗ των 6 merges (§5.2). Αυτό το ADR είναι χάρτα + audit, όχι refactor — όπως το ADR-549.

---

## Changelog

### 2026-06-29 — Αρχική απογραφή canvas/viewport & SSoT audit (DRAFT)
**Πλαίσιο:** Εντολή Giorgio — βαθιά καταγραφή πόσοι καμβάδες 2D+3D και πόσα viewports χρησιμοποιούνται στο `/dxf/viewer`, με ευκαιρίες ενοποίησης.

**Μέθοδος:** ανάγνωση mount/dispatch αρχείων (3 παράλληλοι Explore agents): `CanvasLayerStack.tsx` (+leaves/overlays), `BimViewport3D.tsx`/`BimViewport3DCanvasOverlays.tsx`, `scene-setup.ts`, `view-cube.ts`, `ViewMode3DStore.ts`, `ImmediateTransformStore.ts`, `ThreeJsSceneManager.ts`. Αριθμοί από κώδικα, όχι εκτίμηση.

**Αποτέλεσμα:** 1 viewport (swap 2D↔3D) · 2D έως 24 φυσικά canvases (typ ~16, min 3) · 3D 7–8 (2 WebGL + 5–6 2D overlays) · + 1 ViewCube nav gizmo + 2 dialog previews · 0 minimap/split/PiP. Εντοπίστηκαν 6 ευκαιρίες ενοποίησης + 1 cross-cutting σύσταση (3D → ΕΝΑΣ shared overlay canvas, όπως ο 2D PreviewCanvas).

**Επόμενα (προτεινόμενα, εκτός scope):** (1) 2D analytical dispatch canvas [✅ ADR-552]· (2) 2D proposal dispatch canvas [✅ ADR-554]· (3) 3D grip+hover merge [✅ ADR-555]· (4) 3D drawing-feedback canvas (wallHud+tracking+placement) [✅ ADR-555]· (5) ViewCube scissored sub-viewport [✅ ADR-553]. _(#3+#4 ενοποιήθηκαν σε ΕΝΑΝ dispatch — §5.3.)_

### 2026-06-29 — §5.2 #1 IMPLEMENTED (ADR-552)
Η ευκαιρία #1 (7 analytical overlays → 1 dispatch canvas) υλοποιήθηκε — βλ. **ADR-552**. 2D max 24→18, typical ~16→~10. Οι υπόλοιπες 5 ευκαιρίες παραμένουν προτεινόμενες.

### 2026-06-29 — §5.2 #6 IMPLEMENTED (ADR-553)
Η ευκαιρία #6 (ViewCube 2ο WebGL context → scissored sub-viewport) υλοποιήθηκε — βλ. **ADR-553**. **3D WebGL contexts 2→1.** Ο 2ος `WebGLRenderer` αφαιρέθηκε· ο cube ζωγραφίζεται από τον main renderer (Three.js `webgl_multiple_views` pattern, AO-immune τελευταίο pass)· το DOM element έμεινε διάφανο hit-layer (zero context, hit-test byte-identical). Απομένουν προτεινόμενες: #2, #3, #4, #5.

### 2026-06-29 — §5.2 #2 IMPLEMENTED (ADR-554)
Η ευκαιρία #2 (7 proposal ghosts → 1 zero-lag dispatch canvas) υλοποιήθηκε — βλ. **ADR-554**. **2D max 18→12, typical ~10→~4.** Εξήχθη shared `paintOverlayDispatchFrame` SSoT (analytical ADR-552 + proposal, μηδέν duplicate). Απομένουν: #4, #5 (3D unified dispatch).

### 2026-06-29 — §5.2 #3 DEFERRED
Η ευκαιρία #3 (EnvelopeOverlay + HomeRunWires) **αναβλήθηκε** μετά από SSoT audit: ασύμβατες repaint αρχιτεκτονικές (React `useEffect` vs zero-lag scheduler — force θα επανέφερε το wire pan-lag bug), **ΔΕΝ είναι mutually exclusive** (συνυπάρχουν → μηδέν όφελος μνήμης), μηδέν shared infra, κίνδυνος perf regression. Κερδίζεις 1 canvas, ρισκάρεις cross-domain coupling — δεν αξίζει χωρίς τα preconditions (§5.2 #3). Big-player honesty: δεν ενοποιούμε δύο ανεξάρτητα domains με ασύμβατα μοντέλα μόνο για −1 canvas.

### 2026-06-29 — §5.2 #4 + #5 + §5.3 IMPLEMENTED (ADR-555)
Οι ευκαιρίες #4 + #5 + η cross-cutting σύσταση §5.3 υλοποιήθηκαν **μαζί** σε **ΕΝΑΝ** unified dispatch (όχι 2 pairwise merges) — βλ. **ADR-555**. Τα 5 camera-projected Canvas2D overlays (#3–#7: grip/hover-glow/wall-HUD/tracking/placement) → **1** `BimOverlayDispatchCanvas` (3D αδελφός του 2D `paintOverlayDispatchFrame`), z-ordered multi-pass. **SSoT audit διόρθωσε δύο λάθος υποθέσεις του census:** grip+hover **συνυπάρχουν**, wallHud+tracking **συνυπάρχουν** → z-order layering, όχι switch. Frame-level dirty/skip gate διατήρησε το ADR-549 Φ3 (no hover-lag regression). **3D idle overlay canvases 5→1** (συνολικά 3D idle 7→2 μαζί με ADR-553). 17/17 jest + projection tests GREEN. **ΟΛΕΣ οι ευκαιρίες §5.2 πλέον IMPLEMENTED (#1–#6), εκτός #3 (DEFERRED, τεκμηριωμένο).**
