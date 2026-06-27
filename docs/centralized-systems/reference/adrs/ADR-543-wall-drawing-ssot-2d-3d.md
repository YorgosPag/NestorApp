# ADR-543 — Σχεδίαση τοίχου με ΜΙΑ πηγή αλήθειας: 2D καμβάς ↔ 3D viewport

| | |
|---|---|
| **Status** | ✅ APPROVED (UNCOMMITTED) |
| **Date** | 2026-06-27 |
| **Domain** | DXF/BIM Viewer — Drawing tools / 3D placement |
| **Σχετικά** | ADR-403 (3D BIM element placement), ADR-408 Φ8 (3D MEP segment 2-click), ADR-404 (wall tilt bridge), ADR-508 (wall ghost/HUD/face-snap), ADR-513 (radial command ring), ADR-542 (3D snap markers), ADR-040 (micro-leaf) |

## Context

Ο τοίχος σχεδιαζόταν **μόνο** στον 2D καμβά: επιλογή «Τοίχος» → κλικ αρχής → ζωντανό ghost →
ενδείξεις (COL/alignment traces, σημάδια OSNAP), ζωντανές διαστάσεις (μήκος/γωνία/πάχος·ύψος),
2-κλικ commit. Ζητήθηκε **η ίδια ακριβώς εμπειρία στο 3D viewport**, με **μία και μοναδική πηγή
αλήθειας** — όχι διπλός/διάσπαρτος κώδικας (Revit / Maxon Cinema 4D grade).

**Εύρημα SSoT audit (grep):** ο πυρήνας σχεδίασης τοίχου είναι **ήδη** καθαρός/ανεξάρτητος καμβά.
Το ίδιο 2D→3D μοτίβο εφαρμόζεται **ήδη 3 φορές** (κολώνα `bim:place-column-3d`, MEP segment
`bim:place-mep-segment-3d`, δοκάρι): το 3D κλικ δρομολογείται μέσω EventBus στο **ίδιο**
`onCanvasClick` του 2D FSM. Έλειπε μόνο η αντίστοιχη γέφυρα για τον τοίχο + το 3D ghost + τα 3D
overlays ενδείξεων.

## Decision

**Καμία αναπαραγωγή λογικής τοίχου.** Ο 2D FSM, οι builders, η geometry, ο snap engine, το commit
και η persistence καλούνται αυτούσια από το 3D. Το 3D προσθέτει ΜΟΝΟ: (α) μια γέφυρα εισόδου
(raycast floor → plan point → ίδιο `onCanvasClick`), (β) ένα 3D ghost (ίδιος `wallToMesh`),
(γ) ένα Canvas2D HUD overlay (ίδιος `paintWallHudCore`).

### Τι μένει ΙΔΙΟ (κοινός κώδικας 2D + 3D — μηδέν αλλαγή στη λογική)

| Layer | Αρχείο (SSoT) | Ρόλος |
|---|---|---|
| FSM | `hooks/drawing/useWallTool.ts` → `onCanvasClick` | Η ΜΙΑ μηχανή κλικ: awaitingStart→awaitingEnd→commit, polyline/curve, length/angle lock |
| Builders | `hooks/drawing/wall-completion.ts` (`buildWallEntity`, `buildDefaultWallParams`, `buildAnchoredWallParams`) | Παραγωγή WallEntity (pure) |
| Geometry | `bim/geometry/wall-geometry.ts` (`computeWallGeometry`) | Άξονας/footprint/όγκος (pure) |
| Preview store | `bim/walls/wall-preview-store.ts` (`wallPreviewStore`) | Κατάσταση ghost (zero-React, γράφεται από το FSM) |
| Ghost SSoT | `hooks/drawing/wall-preview-helpers.ts` (`generateWallPreview`) | Το 2D ghost entity (preview ≡ commit) |
| Snap | `snapping/global-snap-engine.ts` + `bim-3d/.../bim-3d-snap-hover.ts` | ΕΝΑ snap engine, ήδη γεφυρωμένο στο 3D |
| HUD layout | `canvas-v2/preview-canvas/wall-hud-paint.ts` (`paintWallHudCore`) | Διάταξη/ετικέτες HUD (projector-agnostic) |
| Commit | `bim/walls/add-wall-to-scene.ts` (`addWallToScene`) | trims + emit `drawing:entity-created` (canvas-agnostic) |
| Persistence | `hooks/data/useWallPersistence.ts` | Ακούει το ίδιο event → Firestore (μηδέν αλλαγή) |
| 3D mesh | `bim-3d/converters/BimToThreeConverter.ts` (`wallToMesh`) | Ο ίδιος converter με τους committed τοίχους |
| Projector | `bim-3d/grips/grip-3d-screen-project.ts` (`makeGripPlanToCanvas`) | plan-mm → canvas-px (SSoT) |
| Snap marker 3D | `bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx` | OSNAP marker — δούλευε ήδη (ADR-542) |

### Νέος κώδικας (το ΜΟΝΟ 3D-specific κομμάτι)

**Είσοδος (3D → κοινό FSM):**
- `systems/events/drawing-event-map-bim.ts` — νέο event `'bim:place-wall-3d': { point: Point2D }`.
- `hooks/drawing/useWallTool.ts` — listener (mirror κολόνας): `EventBus.on('bim:place-wall-3d', ({point}) => onCanvasClickRef.current(point))`. + δημοσίευση `getSceneUnits` στο `wallToolBridgeStore`.
- `bim-3d/placement/use-bim3d-wall-placement.ts` — armed όταν `activeTool==='wall'` ΚΑΙ `selectIs3D`. pointermove: `raycastFloorPoint` → `worldToPlanMm` → `resolvePlacementSnap` → ghost + snap marker + HUD. click (orbit-guard): `EventBus.emit('bim:place-wall-3d', {point})`. Ο τοίχος στέκει στο storey datum → **χωρίς per-click z** (απλούστερο από MEP).

**Ghost (3D):**
- `bim-3d/placement/WallPlacementGhost.ts` — διαβάζει `wallPreviewStore`, χτίζει το preview μέσω **`generateWallPreview`** (το 2D ghost SSoT) και το ρεντάρει με **`wallToMesh`** (translucent). Το 3D ghost ΕΙΝΑΙ το 2D ghost, σε WebGL. Επιστρέφει το `WallHudMeta` για το overlay.

**COL/alignment traces (3D — Φάση 3):**
- `systems/tracking/ambient-tracking-compose.ts` — **NEW pure SSoT** `composeTrackingSnap` (merge acquired+ambient → `resolveTrackingSnap` → adaptive quantize). Το 2D `drawing-hover-handler` **refactored** να το καλεί (zero behavior change· οι inline `resolveTrackingSnap`/`adaptiveDistanceStep`/`quantizeAlongPath` αντικαταστάθηκαν από την ΜΙΑ κλήση). Δηλαδή 2D και 3D μοιράζονται τον **ίδιο** tracking-εγκέφαλο.
- `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` + `useWallTool.ts` — δημοσίευση `getSceneEntities()` στο bridge (mirror του `getSceneUnits`) ώστε το 3D να τροφοδοτεί τον **ίδιο** ambient member set (`collectAmbientAlignmentAnchors`) με το 2D.
- `bim-3d/viewport/tracking/tracking-3d-store.ts` — non-reactive payload (high-freq paths/intersections/markers/snappedPoint/label· ADR-040), mirror `wall-3d-hud-store`.
- `bim-3d/viewport/tracking/Tracking3DOverlay.tsx` — Canvas2D overlay (mirror `WallHudOverlay3D`): RAF + camera-gate, projection μέσω `makePlacementOverlayProjector` (το **ήδη** projection-agnostic SSoT του ADR-544), καλεί τους **ΙΔΙΟΥΣ** `paintAlignmentPaths`/`paintIntersections`/`paintTrackingMarkers`/`paintTooltip` + `getCurrentTrackingPalette`. Mount στο `BimViewport3D`.
- `bim-3d/placement/use-bim3d-wall-placement.ts` — `resolvePlacement` (κοινό onMove+onClick): OSNAP → ambient `composeTrackingSnap` (scene units, camera-derived `scenePerPx`) → override του scene point (ghost ≡ commit) + publish στο `tracking-3d-store`· clear σε miss/leave/teardown.

**HUD/διαστάσεις (3D — Φάση 2):**
- `canvas-v2/preview-canvas/wall-hud-paint.ts` — **refactor projection seam**: η διάταξη μετακινήθηκε στο `paintWallHudCore(ctx, meta, specLabel, proj: WallHudProjector)`. Το `paintWallHud` (2D) είναι πλέον thin adapter που χτίζει projector από `(transform, viewport)` → **μηδέν αλλαγή 2D συμπεριφοράς** (ISO-129 dim + affine projection). Νέο `paintProjectedAlignedDim` (projected dim line μέσω κοινών overlay SSoTs) για το 3D.
- `bim-3d/viewport/wall-hud/wall-3d-hud-store.ts` — non-reactive payload (high-freq HUD meta· ADR-040).
- `bim-3d/viewport/wall-hud/WallHudOverlay3D.tsx` — Canvas2D overlay (mirror `BimGripOverlay2D`): RAF 60fps, projection μέσω `makeGripPlanToCanvas`, καλεί τον **ίδιο** `paintWallHudCore`. Mount στο `BimViewport3D`. Spec label = το **ίδιο** i18n key `tools.wall.hudSpec` (μηδέν νέο key, N.11).

## 2D pipeline trace (τεκμηρίωση — τι αναπαράγεται)

1. **Tool activation**: `useSpecialTools` → `useWallTool` (FSM phases idle→awaitingStart→awaitingEnd→commit· polyline/curve).
2. **Click flow**: `mouse-handler-up` → `onCanvasClick(point)` (wall: ΧΩΡΙΣ findSnapPoint, anti double-snap ADR-514).
3. **Ghost**: `generateWallPreview` → `makeWallGhostBeforeClick` / `makeWallWysiwygGhost` → `buildWallEntity` (preview ≡ commit).
4. **COL/alignment**: `systems/tracking/tracking-resolver.ts` + `ambient-alignment-source.ts` (pure resolvers· `activePaths`).
5. **Δυναμικές διαστάσεις**: `wall-hud-paint.ts` (`paintWallHud`) + `length-angle-lock` + `RadialCommandRing`.
6. **Snap (OSNAP)**: `getGlobalSnapEngine().findSnapPoint` + face-snap `resolveWallEndpointSnap`/`resolveBimCursorSnap`.
7. **Commit/persistence**: `commitStraightFromState` → `addWallToScene` → emit `drawing:entity-created` → `useWallPersistence` → Firestore.

## Consequences

- ✅ Σχεδίαση τοίχου στο 3D με **τον ίδιο** FSM/builders/geometry/snap/commit/persistence — μηδέν διπλότυπο.
- ✅ WYSIWYG ghost (ίδιος `wallToMesh`)· OSNAP markers (ήδη)· ζωντανές διαστάσεις (ίδιος `paintWallHudCore`).
- ✅ 2D αμετάβλητο: το `paintWallHud` κρατά πανομοιότυπη υπογραφή+συμπεριφορά (thin adapter).
- ⚠️ **Γνωστή απόκλιση (τεκμηριωμένη):** η ISO-129 dim line (arrowheads/extension lines, `renderPreviewDimension`) είναι θεμελιωδώς affine (uniform `transform.scale`) και ΔΕΝ προβάλλεται μέσα από perspective camera. Στο 3D η dim line είναι η **κοινή overlay γραμμή** (`paintProjectedAlignedDim`, ίδιο line-style/χρώμα/αριθμός με τις 2D listening dims). Τα νούμερα/ετικέτες/format/διάταξη είναι ΚΟΙΝΑ.
- ✅ **COL/alignment traces στο 3D — ΥΛΟΠΟΙΗΘΗΚΑΝ (Φάση 3):** Revit-style ambient alignment lines κατά τη σχεδίαση τοίχου στο 3D, με τον **ίδιο** tracking-εγκέφαλο (`composeTrackingSnap`, NEW SSoT extracted από το 2D) και τους **ίδιους** painters (`tracking-paint`, ήδη projection-agnostic μέσω ADR-544). Το snapped point εφαρμόζεται ΠΡΙΝ το ghost ΚΑΙ το commit (preview ≡ commit). Τα OSNAP markers δούλευαν ήδη (ADR-542).
- ⚠️ **Περιορισμός (τεκμηριωμένος):** στο 3D τροφοδοτείται μόνο η **ambient** πηγή (auto, Revit-style) — η manual hover-acquisition των 1s (`TrackingPointStore`, AutoCAD-style) ΔΕΝ τρέχει στο 3D (καμία 3D acquisition timer)· τα `acquired` points περνούν αυτούσια αν υπάρχουν, αλλά συνήθως κενά. Polar (F8/F10) είναι off στο 3D (μόνο H/V COL traces) μέχρι να εκτεθεί 3D ortho/polar surface. Follow-up.

## Verification

- Tests: `use-bim3d-wall-placement.test.ts` (8 — arm/disarm, OSNAP raw/snapped, 2-click, orbit-guard, teardown· mock camera+bridge ενημερωμένα για ambient), `wall-hud-paint-projector.test.ts` (4), `ambient-tracking-compose.test.ts` (6 — null/projection/quantize/intersection/ambient-merge), `tracking-3d-store.test.ts` (4 — set/clear).
- Browser (`/dxf/viewer`): 2D μηδέν regression· 3D «Τοίχος» → ghost + snap markers + ζωντανές διαστάσεις + 2-κλικ commit + persist (refresh)· ταυτόσημος committed τοίχος 2D vs 3D.
- ⚠️ N.17: μην τρέξεις tsc αν τρέχει άλλος (shared tree).

## Changelog

- **2026-06-27** — Αρχική υλοποίηση. Φάση 1 (πυρήνας: event + listener + `use-bim3d-wall-placement` + `WallPlacementGhost` + register). Φάση 2 (HUD: projector seam `paintWallHudCore`/`paintProjectedAlignedDim` + `wall-3d-hud-store` + `WallHudOverlay3D` + mount). UNCOMMITTED.
- **2026-06-27** — **Φάση 3 (COL/alignment traces 3D) ΥΛΟΠΟΙΗΘΗΚΕ — UNCOMMITTED.** SSoT audit (grep) → εύρημα: ο ADR-544 agent (κολώνα) είχε ήδη κάνει το `tracking-paint` projection-agnostic + τον `makePlacementOverlayProjector`, αλλά **δεν** τροφοδοτούσε tracking στο 3D (§8 του). Reuse ΟΛΗΣ αυτής της υποδομής + του `resolveTrackingSnap`/`collectAmbientAlignmentAnchors`/`adaptiveDistanceStep`. NEW pure `composeTrackingSnap` (extracted από το 2D handler — zero behavior change, ΕΝΑΣ εγκέφαλος 2D+3D) + `tracking-3d-store` + `Tracking3DOverlay` (mirror `WallHudOverlay3D`). `getSceneEntities` δημοσιεύτηκε στο wall bridge ώστε 3D ambient = 2D ambient. 18/18 jest GREEN (10 νέα + 8 Φάση-1 με ενημερωμένο mock). tsc SKIP (N.17, shared tree). Εκκρεμεί: browser-verify (2D μηδέν regression + 3D COL traces), commit (Giorgio· stage code+tests+ADR-040+ADR-543).
