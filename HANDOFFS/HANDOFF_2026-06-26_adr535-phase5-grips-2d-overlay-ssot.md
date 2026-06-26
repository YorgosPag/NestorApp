# HANDOFF — ADR-535 Φ5: λαβές 3D = 2D overlay canvas με ΕΝΑ render code (FULL SSoT με τον 2D καμβά)

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Στόχος (εντολή Giorgio):** Οι λαβές στην 3D να **σταματήσουν να είναι 3D κύβοι-mesh** και να γίνουν **2D σύμβολα ζωγραφισμένα σε overlay canvas πάνω από το WebGL**, με τον **ΙΔΙΟ ΑΚΡΙΒΩΣ** κώδικα draw που τρέχει ο 2D καμβάς → κυριολεκτικά **μία πηγή αλήθειας**. «Όπως η Revit. FULL ENTERPRISE + FULL SSOT.»

---

## 0. ⚠️ ΔΙΑΒΑΣΕ ΠΡΩΤΑ — ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ

1. **SHARED WORKING TREE** — δουλεύει **ΚΑΙ άλλος agent** (ADR-534 BOQ/beam-flange/rebar). Τρέξε `git status` στην αρχή. **ΜΗΝ** αγγίξεις/κάνεις stage αρχεία που δεν είναι δικά σου: `ADR-534-*.md`, `beam-rebar-3d.ts`, `bim-three-structural-converters.ts`, `linear-member-rebar-3d*.ts` (+ ό,τι άλλο δεν αναγνωρίζεις). **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΕΣΥ ΠΟΤΕ** (όχι `git add`, όχι commit, όχι push — N.(-1)).
2. **FULL ENTERPRISE + FULL SSOT:** **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep.** Ξανα-grep ΚΑΘΕ symbol/path παρακάτω (shared tree, μπορεί να άλλαξε). Αν υπάρχει ήδη κεντρικά → reuse, ΜΗΔΕΝ διπλότυπα. Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· **ΜΗΔΕΝ inline styles (N.3)** — εξαίρεση μόνο δυναμική θέση (π.χ. `left/top`)· zero hardcoded strings i18n (N.11).
3. **tsc: ΕΝΑΣ τη φορά (N.17)** — έλεγξε running tsc ΠΡΙΝ. **Full-project `tsc --noEmit` κάνει OOM (exit 134)** — προτίμησε colocated jest (ts-jest = full type-check) + στατική επαλήθευση. (Trick: temp `*.test.ts` που κάνει `import * as m from '...'` → ts-jest type-check-άρει όλο το graph· διέγραψέ το μετά.)
4. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule).
5. **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit + canvas αρχεία → στο commit ο Giorgio κάνει **stage ADR-535 + ADR-040**.

---

## 1. ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ (Φ1–Φ4, COMMITTED + UNCOMMITTED) — ΤΟ ΠΡΟΒΛΗΜΑ

Οι λαβές στην 3D είναι σήμερα **3D κύβοι-mesh** (`BoxGeometry`) μέσα στη σκηνή, με screen-constant scale. Τρία προβλήματα (browser-verified από Giorgio):
1. **Πατάνε ΠΑΝΩ στην οροφή / δεν κεντράρονται** στις κορυφές — `grip-mesh-factory-3d.ts:~81` `lift = +½ side` (σκόπιμη ανύψωση).
2. **Διαφορετικό μέγεθος/εμφάνιση από τον 2D καμβά** — 3D = solid κύβος `0x2d8cf0`· 2D = flat τετράγωνο **7px** (`GRIP_SIZE_DEFAULT`) μέσω `GripShapeRenderer.fillRect`. Δύο διαφορετικά rendering backends (WebGL vs Canvas2D).
3. **Κλιμακωτό zoom** — `updateScale` καλείται **μόνο σε events** (wheel/move/orbit), όχι κάθε frame.

**Η εγκεκριμένη λύση:** αντικατάσταση των 3D κύβων με **2D overlay canvas** που ζωγραφίζει με τον **ΙΔΙΟ** `UnifiedGripRenderer` του 2D → ίδιο μέγεθος/σχήμα/χρώμα, συνεχές zoom, τέλειο κεντράρισμα, μία πηγή αλήθειας.

---

## 2. SSoT AUDIT (έγινε 2026-06-26 — ΞΑΝΑ-grep ΠΡΙΝ τα χρησιμοποιήσεις)

### 2.1 ✅ Η ΠΗΓΗ ΑΛΗΘΕΙΑΣ του 2D draw — REUSE ΑΥΤΟΥΣΙΑ
| Ανάγκη | Υπάρχον SSoT (path:γρ.) | Πώς το χρησιμοποιείς |
|---|---|---|
| **Grip draw (THE renderer)** | `rendering/grips/UnifiedGripRenderer.ts` — `new UnifiedGripRenderer(ctx: CanvasRenderingContext2D, worldToScreen: (Point2D)=>Point2D)` | Φτιάξε instance με τον **overlay 2D ctx** + closure `worldToScreen3D`. Κάλεσε `renderGripSetBatched(grips: GripRenderConfig[], settings)` ή `renderGrip(config, settings)` / `renderEdgeMidpointGrip(screenPos, state, settings)` (διαμάντι για midpoints). **ΑΥΤΟΣ είναι ο «ένας κώδικας».** |
| shape/size/color sub-renderers | `GripShapeRenderer` / `GripSizeCalculator` / `GripColorManager` / `GripInteractionDetector` (ίδιος φάκελος) | **ΜΗΝ τα αγγίξεις** — τα ορχηστρώνει ο `UnifiedGripRenderer`. |
| μέγεθος (px) | `config/grip-size-default.ts` `GRIP_SIZE_DEFAULT=7` + `config/text-rendering-config.ts` `UI_SIZE_DEFAULTS.GRIP_SIZE` | Πέρασέ το ως `settings.gripSize` (ή πάρ' το από το GripStyleStore — δες 2.4). |
| temperature (cold/warm/hot) | `rendering/grips/grip-temperature.ts resolveGripTemperature` (μέσω `GripInteractionDetector`) | Για hover: πέρασε `temperature:'warm'` στο config της hovered λαβής, `'cold'` στις άλλες → ίδιο look με 2D. |

### 2.2 ✅ Προβολή 3D → οθόνη — REUSE
| Ανάγκη | Υπάρχον SSoT |
|---|---|
| world(THREE)→screen px | `bim-3d/viewport/coordinate-transforms.ts:42` `worldToScreen(pos:THREE.Vector3, camera, canvas) → {x,y}\|null` (⚠️ επιστρέφει **CLIENT** px = προσθέτει `rect.left/top`· null όταν πίσω από κάμερα `ndc.z>1`) |
| plan-mm → world(THREE) | `coordinate-transforms.ts:123` `dxfPlanToWorld(x,y,elevMm) → THREE.Vector3` |
| **Ο closure που χρειάζεσαι** | `worldToScreen3D = (p:Point2D) => { const s = worldToScreen(dxfPlanToWorld(p.x, p.y, elevFor(p)), camera, canvas); return s ? toCanvasLocal(s) : OFFSCREEN; }` |

### 2.3 ✅ Θέσεις λαβών + per-vertex elevation — REUSE (ΗΔΗ ΕΤΟΙΜΑ από Φ1–Φ3b)
| Ανάγκη | Υπάρχον SSoT |
|---|---|
| GripInfo[] (θέσεις) | `hooks/grip-computation.ts computeDxfEntityGrips(entity)` → φίλτρο `bim-3d/grips/grip-3d-reshape-grips.ts reshapeGripsForFootprint(grips)` (vertex+midpoint, !movesEntity· slab/roof/floor-finish/slab-opening) |
| per-vertex elevation (mm) | `bim-3d/animation/bim3d-grip-drag.ts` — `slabGripElevationMmFor` / `roofGripElevationMmFor` / `slabOpeningGripElevationMmFor` / floor-finish flat. **⚠️ μικρό refactor:** το `GripElevationMmFor` σήμερα είναι `(grip:GripInfo)=>number` αλλά διαβάζει ΜΟΝΟ `grip.position.{x,y}` → άλλαξέ το σε `(p:Point2D)=>number` ώστε να το καλεί ο `worldToScreen3D` closure. |
| commit (αμετάβλητο) | `bim-3d/grips/grip-3d-commit.ts` `commitGrip3DReshape` + exported `toUnifiedGrip` — **ΜΕΝΕΙ ΩΣ ΕΧΕΙ** |
| live reshape preview builders (αμετάβλητα) | `bim-3d/animation/bim3d-grip-preview-builders.ts` (slab/roof/floor-finish/slab-opening) — **ΜΕΝΟΥΝ** (αφορούν το mesh της ίδιας της οντότητας, όχι τις λαβές) |
| context-menu Φ4 (αμετάβλητο) | `Grip3DVertexContextMenu.tsx` + `Grip3DContextMenuStore` + `footprint-grip-ops.ts` — **ΜΕΝΟΥΝ** (μόνο το `gripAt` γίνεται screen-space, δες 2.5) |

### 2.4 ✅ Settings (μέγεθος/χρώμα) SSoT
- `GripStyleStore` (grep: `config/color-config.ts`, `canvas-v2/layer-canvas/layer-canvas-hooks.ts`, `text-rendering-config.ts` το χρησιμοποιούν). Βρες πώς ο 2D καμβάς παίρνει τα `GripSettings` (πιθανότατα μέσω hook/store) και **πέρασε ΤΑ ΙΔΙΑ** στον overlay → εγγυημένα ίδιο μέγεθος/χρώμα. Αν ο 2D δεν τα διαβάζει από store για το preview, χρησιμοποίησε `GRIP_SIZE_DEFAULT` + `UI_SIZE_DEFAULTS.GRIP_SIZE` (ίδια defaults).

### 2.5 ✅ PRECEDENT για overlay canvas πάνω από WebGL — MIRROR
`bim-3d/render/crop-region/CropRegionOverlay.tsx` = **ΑΚΡΙΒΩΣ το pattern**: absolutely-positioned `<canvas>` πάνω από το viewport, **RAF-throttled 60fps redraw**, pure Canvas2D, μηδέν GPU cost, «does not interfere with Three.js». Διάβασέ το πρώτο — αντιγράφεις δομή/positioning/DPR handling.

### 2.6 ⚠️ Hit-test (ποια λαβή κάτω από cursor) → γίνεται SCREEN-SPACE (ίδια φιλοσοφία με 2D)
Σήμερα `bim-3d/grips/grip-3d-hit-test.ts` = raycaster vs hitbox-meshes. **Αντικαθίσταται** με pure screen-space: project κάθε grip→screen (`worldToScreen3D`), βρες αυτήν με `|cursor - screenPos| ≤ ~halfSize+slack px`. (Το 2D κάνει screen-space distance· ίδιος μηχανισμός.)

---

## 3. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (φασικό, colocated jest ανά βήμα)

> Επιβεβαίωσε ΟΛΑ με grep πριν γράψεις. Η αρχιτεκτονική = **ο 3D feed-άρει ΘΕΣΕΙΣ+ELEVATION+state· ο overlay ζωγραφίζει με τον 2D `UnifiedGripRenderer`**.

### Βήμα 1 — ΝΕΟ pure projection + hit-test (jest-friendly)
- `bim-3d/grips/grip-3d-screen-project.ts` (PURE): `makeGripWorldToScreen(camera, canvas, elevFor)` → `(p:Point2D)=>Point2D|null` (reuse `dxfPlanToWorld`+`worldToScreen`). ΕΝΑ projection SSoT για overlay **και** hit-test.
- `bim-3d/grips/grip-3d-screen-hit-test.ts` (PURE): `findGripAtScreen(grips, project, clientX, clientY, hitRadiusPx) → gripIndex|null`. **Αντικαθιστά** το `grip-3d-hit-test.ts`.
- Tests: γνωστή κάμερα/canvas → σωστή projection + hit/miss. (Δες υπάρχον `grip-3d-hit-test.test.ts` / `grip-plane-projection.test.ts` για στήσιμο camera mocks.)

### Βήμα 2 — ΝΕΟΣ overlay (mirror CropRegionOverlay)
- `bim-3d/viewport/grips/BimGripOverlay2D.tsx` (React leaf): absolutely-positioned `<canvas>` πάνω από το viewport (DPR-aware όπως CropRegionOverlay)· **RAF redraw όσο υπάρχουν grips** (διαβάζει live κάμερα κάθε frame → συνεχές zoom)· ανά frame: `new/reuse UnifiedGripRenderer(ctx, worldToScreen3D)` → `renderGripSetBatched(configs, settings)`. configs: vertex→`square`, midpoint→`diamond` (ή `renderEdgeMidpointGrip`)· hovered→`temperature:'warm'`. **Behind-camera (project→null) → skip.**
- State: ΝΕΟ low-freq `bim-3d/stores/Grip3DOverlayStore.ts` `{ grips: GripInfo[], elevFor, hoverIndex, drag: {index, livePlanPos}|null }` + actions. Τα non-React handlers γράφουν· ο overlay διαβάζει + RAF-redraw. (ADR-040 micro-leaf, zero high-freq pointer data στο store — οι θέσεις προκύπτουν από camera+grips κάθε frame.)
- Mount στο `BimViewport3D.tsx` δίπλα στα `<ViewCubeContextMenu/>` / `<Grip3DVertexContextMenu/>`.

### Βήμα 3 — controller σε screen-space (κράτα το drag math)
- `bim-3d/grips/bim-grip-controller-3d.ts`: `cast()`/`updateHover()`/`beginDrag()`/`gripAt()` → **screen-space** (νέο hit-test, Βήμα 1)· `gripStartWorld = dxfPlanToWorld(grip.pos, elevFor(grip.pos))`· **το drag projection (ray∩horizontal-plane) ΜΕΝΕΙ** (`grip-plane-projection.ts`, `updateDrag`)· γράφε `drag.livePlanPos`+`hoverIndex` στο `Grip3DOverlayStore` (ο overlay ζωγραφίζει τη σερνόμενη λαβή ζωντανά). Διώξε κάθε εξάρτηση από meshes (`overlay.gripByIndex/getGripWorld/moveGrip`).

### Βήμα 4 — wiring + αφαίρεση mesh overlay
- `bim3d-grip-drag.ts refreshReshapeGrips`: αντί `ctx.gripOverlay.setGrips(...)` → γράψε `grips+elevFor` στο `Grip3DOverlayStore`. Άλλαξε `GripElevationMmFor` σε `(p:Point2D)=>number`.
- `use-bim3d-edit-interaction.ts`: **διώξε** `BimGripOverlay3D`/`BimGripController3D`-mesh deps + **όλα τα `updateScale`** (δεν υπάρχει πια screen-constant mesh)· κράτα τον (screen-space) controller για drag/hover· mount overlay (ή mount-άρεται στο BimViewport3D).
- `bim3d-edit-interaction-handlers.ts`: hover/`onEditContextMenu`/drag wiring μέσω του screen-space controller· διώξε `ctx.gripOverlay.updateScale`.
- **ΔΙΑΓΡΑΦΗ/αντικατάσταση:** `grip-mesh-factory-3d.ts`, `bim-grip-overlay-3d.ts` (mesh), `grip-3d-hit-test.ts` (raycaster) + τα tests τους (`grip-mesh-factory-3d.test.ts`, `grip-3d-hit-test.test.ts`, τυχόν `bim-grip-overlay-3d` test).

### Βήμα 5 — ADR-535 changelog (Φ5) + πίνακας φάσεων.

---

## 4. ΚΡΙΣΙΜΕΣ ΛΕΠΤΟΜΕΡΕΙΕΣ / ΠΑΓΙΔΕΣ
1. **`worldToScreen` επιστρέφει CLIENT px** (`+rect.left/top`). Ο overlay canvas καλύπτει το viewport → μετάτρεψε σε **canvas-local** (αφαίρεσε το rect του overlay) πριν το draw. Αλλιώς οι λαβές θα είναι μετατοπισμένες.
2. **DPR (device pixel ratio):** `canvas.width = clientW*dpr; canvas.height = clientH*dpr; ctx.scale(dpr,dpr)` (mirror CropRegionOverlay) → 7px = πραγματικά 7 CSS px. Πρόσεξε το `settings.dpiScale` του renderer (κράτα 1.0 αν ο ctx είναι ήδη scaled).
3. **Behind-camera:** `worldToScreen→null` (ndc.z>1) → **μη ζωγραφίσεις** εκείνη τη λαβή.
4. **Per-frame redraw = συνεχές zoom.** ΜΗΝ βασιστείς σε events — RAF loop όσο grips visible (mirror CropRegionOverlay RAF throttle). Αυτό λύνει το «κλιμακωτό».
5. **Occlusion:** οι λαβές overlay φαίνονται ΠΑΝΤΑ πάνω από τη γεωμετρία (όπως στον 2D καμβά) — αυτό ζήτησε ο Giorgio («ίδια εμφάνιση με 2D»). Μην προσπαθήσεις depth-occlusion.
6. **Hover look = 2D:** πέρασε `temperature:'warm'` μόνο στην hovered λαβή· ο `GripColorManager` δίνει το ίδιο χρώμα με τον 2D.
7. **Κεντράρισμα:** το `fillRect(pos.x-half, pos.y-half, size, size)` κεντράρει στο `pos` = η προβεβλημένη κορυφή. Κανένα `lift` πια.
8. **Context-menu Φ4:** μόνο το `gripAt` αλλάζει (screen-space)· ο dispatcher/store/component μένουν.
9. **Live drag:** ο overlay ζωγραφίζει τη σερνόμενη λαβή στο `drag.livePlanPos` (snapped)· το `bim3d-grip-preview-builders` συνεχίζει να ξαναχτίζει το mesh της οντότητας (πλάκα/host-slab) — τα δύο συνυπάρχουν, όπως τώρα.

---

## 5. TESTING (Google presubmit-grade, colocated jest)
- `grip-3d-screen-project.test.ts` — plan→screen (γνωστή κάμερα/canvas)· behind-camera→null.
- `grip-3d-screen-hit-test.test.ts` — hit μέσα σε radius / miss έξω· nearest-wins.
- κράτα GREEN: `bim3d-grip-preview-builders` (16), `footprint-grip-ops` (15), `slab-opening-pick-mesh` (4), `grip-3d-commit`, `grip-3d-reshape-grips`, slab-opening/floor-finish grips.
- Ο overlay component (canvas/RAF) είναι δύσκολος σε unit-test → light smoke (build `worldToScreen3D` closure, assert μία γνωστή προβολή) + βασίσου στο browser-verify.
- Baseline εντολή: `npx jest "src/subapps/dxf-viewer/bim-3d/grips" "src/subapps/dxf-viewer/bim-3d/animation/__tests__"` (ΠΡΟΣΟΧΗ: αφαίρεσε τα tests των διαγραμμένων αρχείων).

## 6. ΡΙΣΚΑ (σύνοψη)
1. **CLIENT vs canvas-local px** (§4.1) — η #1 πηγή «λαβές μετατοπισμένες».
2. **DPR** (§4.2) — αλλιώς λάθος μέγεθος/θολές λαβές.
3. **RAF redraw** (§4.4) — αλλιώς ξανά «κλιμακωτό».
4. **`GripElevationMmFor` refactor σε `(Point2D)=>number`** — άγγιξε ΟΛΑ τα call-sites (slab/roof/slab-opening + factory που διαγράφεται).
5. **Shared tree** — μην αγγίξεις τα ADR-534 αρχεία.

## 7. ΠΗΓΕΣ ΑΛΗΘΕΙΑΣ (γρήγορα links)
- 2D draw SSoT: `rendering/grips/UnifiedGripRenderer.ts` (+`GripShapeRenderer`/`GripSizeCalculator`/`GripColorManager`).
- Overlay precedent: `bim-3d/render/crop-region/CropRegionOverlay.tsx`.
- Projection: `bim-3d/viewport/coordinate-transforms.ts` (`worldToScreen`/`dxfPlanToWorld`/`getPixelWorldSize`).
- Θέσεις+elevation: `hooks/grip-computation.ts` + `bim-3d/grips/grip-3d-reshape-grips.ts` + `bim-3d/animation/bim3d-grip-drag.ts`.
- Αμετάβλητα: `grip-3d-commit.ts`, `bim3d-grip-preview-builders.ts`, `Grip3DVertexContextMenu.tsx`, `footprint-grip-ops.ts`, `grip-plane-projection.ts`.
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (changelog 2026-06-26 Φ3a/Φ3b/Φ4).
- Memory: `reference_3d_viewport_entity_grips.md`.
