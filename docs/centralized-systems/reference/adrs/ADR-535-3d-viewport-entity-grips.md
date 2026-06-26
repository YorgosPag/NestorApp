# ADR-535 — Λαβές (grips) επεξεργασίας οντοτήτων στην 3D προβολή

**Status:** 🟢 Φ1+Φ2+Φ3a+Φ4(hide-gizmo) IMPLEMENTED (UNCOMMITTED) · Φ3b (slab-opening) + Φ4 (toggle/context-menu) DEFER · **Date:** 2026-06-26
**Type:** Feature (DXF/BIM Viewer — 3D viewport editing). Revit/Forge-grade per-vertex sketch editing.
**Builds on:** ADR-402 (3D Viewport BIM Element Editing — gizmo port) · ADR-404 (tilt rings) · ADR-408 (endpoint shape handles / Revit DOF) · ADR-363 (BIM drawing mode — 2D slab/wall/opening grips) · ADR-183 (Unified Grip System) · ADR-366 (3D coordinate transforms) · ADR-040 (canvas performance / leaf renderers)
**Related:** ADR-049 (unified move SSoT DXF+BIM) · ADR-417/419/436 (roof / floor-finish / foundation grips — γενίκευση)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-26)

Στην **τρισδιάστατη προβολή**, όταν ο χρήστης επιλέγει μια οντότητα (π.χ. **πλάκα οροφής**), εμφανίζεται
**μόνο το gizmo μετασχηματισμού** (βελάκια μετακίνησης + τόξα περιστροφής, ADR-402/404). **ΔΕΝ** εμφανίζονται
οι **λαβές (grips)** — τα μικρά τετράγωνα στις κορυφές/μέσα πλευρών που στην **2D κάτοψη** επιτρέπουν
**ανά-κορυφή / ανά-πλευρά** επεξεργασία του περιγράμματος (μετακίνηση κορυφής, εισαγωγή κορυφής σε πλευρά).

**Ζητούμενο:** να εμφανίζονται **και στην 3D** οι λαβές, ώστε ο χρήστης να επεξεργάζεται κάθε κορυφή
ξεχωριστά — όπως στη 2D (Revit «Edit Sketch» / Forge vertex handles).

**Απάντηση έρευνας: ΝΑΙ, εφικτό και αρχιτεκτονικά καθαρό.** Δεν είναι bugfix αλλά **κανονικό feature** (νέο
3D grip-overlay subsystem). Ωστόσο **το 80% της υποδομής υπάρχει ήδη** και επαναχρησιμοποιείται αυτούσιο.

---

## 2. Τι ισχύει σήμερα — ευρήματα βαθιάς έρευνας

### 2.1 Δύο ανεξάρτητα συστήματα επεξεργασίας, ΚΟΙΝΟ command SSoT

| | **2D κάτοψη** | **3D viewport** |
|---|---|---|
| Επεξεργασία | grips ανά-κορυφή/πλευρά **+** whole-entity | **gizmo** ανά-οντότητα (move/rotate/tilt/resize/endpoint) |
| Σχεδίαση | `UnifiedGripRenderer` (canvas 2D) | `BimGizmoOverlay` (Three.js meshes) |
| Hit-test | `GripInteractionDetector` (screen-space) | `testGizmoHit` (raycaster vs hitbox meshes) |
| Commit | `commitDxfGripDragModeAware` → per-kind adapters | `buildEditCommand` → `MoveEntityCommand`/`RotateEntityCommand` |
| **Κοινό** | **`MoveEntityCommand` / `RotateEntityCommand` / `UpdateSlabParamsCommand` … (view-agnostic)** | **ίδια** |

**Το κενό είναι ΜΟΝΟ στο layer εμφάνισης/αλληλεπίδρασης**, όχι στη γεωμετρία ή στα commands.

### 2.2 ΚΡΙΣΙΜΟ εύρημα — οι λαβές υπολογίζονται ΗΔΗ μέσα στην 3D

Το `bim3d-edit-interaction-handlers.ts` (γρ. 301-306, μέσα στο `buildDragSnapFn`) **ήδη καλεί**:

```ts
const offsets = targets.flatMap((t) =>
  computeDxfEntityGrips(t.entity as unknown as DxfEntityUnion).map((g) => ({
    x: g.position.x - anchorPlan.x,
    y: g.position.y - anchorPlan.y,
  })),
);
```

Δηλαδή το `computeDxfEntityGrips(entity)` (το **2D SSoT** για τις λαβές) **τρέχει ήδη στην 3D** — απλώς
οι θέσεις χρησιμοποιούνται ως **σημεία snap**, ΟΧΙ ως ορατές διαδραστικές λαβές. **Οι θέσεις των λαβών
είναι διαθέσιμες δωρεάν.**

### 2.3 Καθαρός μετασχηματισμός συντεταγμένων (SSoT)

`bim-3d/viewport/coordinate-transforms.ts` — απλές, καθαρές συναρτήσεις:

```ts
dxfPlanToWorld(x_mm, y_mm, elev_mm) → THREE.Vector3   // DXF (mm, Z=υψόμετρο) → world (m, Y-up)
worldToDxfPlan(pos: THREE.Vector3)  → { x, y, z }     // αντίστροφο (mm)
```

Σύμβαση (ADR-366): `world.x = x_mm·0.001`, `world.y = elev_mm·0.001`, `world.z = -y_mm·0.001`.
**Μία οριζόντια κάτοψη ⇒ επίπεδο σταθερού `world.y`** = ιδανικό για projection drag πλάκας.

### 2.4 Το gizmo είναι το ΤΕΛΕΙΟ πρότυπο (template) — 3 καθαρά layers

| Layer | Αρχείο | Ρόλος — τι θα αντιγράψω για τα grips |
|---|---|---|
| **Overlay** (scene-side) | `bim-3d/gizmo/bim-gizmo-overlay.ts` | meshes στη σκηνή + **screen-constant scale** (`dist·tan(fov/2)·k`) + hover paint + show/hide. Pure Three.js, **zero React/store** (ADR-040 leaf). |
| **Controller** (FSM) | `bim-3d/gizmo/bim-gizmo-controller.ts` | raycast hit-test → hover/drag, project ray, live follow. |
| **Drag bridge** (pure math) | `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` | ray→plane projection → `delta` σε **Point2D (mm)** μέσω `worldToDxfPlan`. + **snap** (`applySnap`). |
| Hit-test | `bim-3d/gizmo/gizmo-hit-test.ts` | `raycaster.intersectObjects(hitboxes)` + priority → nearest/best. |
| Lifecycle hook | `bim-3d/animation/use-bim3d-edit-interaction.ts` | mount overlay+controller, AbortController pointer listeners, **auto-on-selection**, re-anchor on resync. |
| Pointer bodies | `bim-3d/animation/bim3d-edit-interaction-handlers.ts` | `onEditPointerDown/Move/Up` — beginDrag, live preview, **dispatch command on release**. |
| Live preview | `bim-3d/animation/bim3d-edit-live-preview.ts` + `-apply.ts` + `-preview-rebuild.ts` | per-frame **geometry rebuild μέσω converter SSoT** (resize/endpoint/tilt). `captureResize` → `applyResize(buildXxxPreviewObject(...))`. |

### 2.5 Το commit path των 2D grips είναι ΗΔΗ view-agnostic

`hooks/grips/grip-commit-adapters.ts` → `commitDxfGripDragModeAware(grip, delta, deps, mode)` δρομολογεί
με βάση τον discriminator `grip.<kind>GripKind`:

- `slabGripKind` → `commitSlabGripDrag` → `UpdateSlabParamsCommand`
- `roofGripKind` → `commitRoofGripDrag`, `floorFinishGripKind` → `commitFloorFinishGripDrag`,
  `slabOpeningGripKind` → `commitSlabOpeningGripDrag`, `columnGripKind`, `wallGripKind`, … (όλα έτοιμα).

Το **3D ήδη χτίζει** τον scene-manager adapter: `createSceneManagerAdapter(buildDeps(levels, levelId))`
(`bim3d-edit-interaction-handlers.ts` γρ. 449). Άρα ένα 3D grip drag = **(α)** φτιάξε `UnifiedGripInfo`
από το `GripInfo`, **(β)** υπολόγισε `delta` (mm), **(γ)** κάλεσε το **ίδιο** `commitDxfGripDragModeAware`.
Η σκηνή **re-syncαρει αυτόματα** (όπως move/rotate) και τα hosted openings cascade δωρεάν.

### 2.6 Slab grips — η δομή (`bim/slabs/slab-grips.ts`)

`getSlabGrips(entity)` → `2N` λαβές:
- `[0..N)` → `slab-vertex-i` (μετακίνηση κορυφής i, XY, z διατηρείται)
- `[N..2N)` → `slab-edge-midpoint-i` (εισαγωγή νέας κορυφής στο μέσο της πλευράς i + delta)

`GripInfo`: `{ entityId, gripIndex, type:'vertex'|'midpoint', position:{x,y} (mm), movesEntity:false, slabGripKind }`.
Pure transform: `applySlabGripDrag(gripKind, {originalParams, delta, rectilinear?})` → νέα `SlabParams`
(η γεωμετρία recompute-άρεται από το `UpdateSlabParamsCommand` → `computeSlabGeometry`, **όχι** εδώ).

---

## 3. Απόφαση

**Προσθήκη ΠΑΡΑΛΛΗΛΟΥ 3D grip-overlay subsystem**, αντίγραφο της τριάδας του gizmo (overlay / controller /
drag-bridge), που **επαναχρησιμοποιεί αυτούσια** όλα τα υπάρχοντα SSoT: `computeDxfEntityGrips`,
`coordinate-transforms`, ο screen-constant scale, τα view-agnostic commit adapters, ο live-preview μηχανισμός.

**Δεν αντικαθιστά το gizmo** — το gizmo μένει για whole-entity move/rotate/tilt· οι λαβές προστίθενται ως το
**affordance reshape** ανά-κορυφή. Συνυπάρχουν (οι κορυφές είναι στην περίμετρο, το gizmo στο κέντρο).

### 3.1 Pilot = ΠΛΑΚΑ (slab) μόνο

Όπως ζήτησε ο Giorgio (στιγμιότυπο = πλάκα οροφής). Η αρχιτεκτονική όμως είναι **type-agnostic** (δουλεύει
πάνω σε `GripInfo`), οπότε η επέκταση σε **roof / floor-finish / slab-opening** (που ήδη έχουν vertex+midpoint
grips ΚΑΙ commit adapters στη 2D) είναι **σχεδόν δωρεάν** (Φάση 3 — απλώς προσθήκη των gripKinds στο φίλτρο).

### 3.2 Γιατί ΟΧΙ απλώς «render τα gizmo handles ως grips»

Το gizmo είναι **παραμετρικό ανά-οντότητα** (Revit DOF, ADR-408 Φ1): η πλάκα έχει σκόπιμα **κανένα** resize
handle — «footprint → 2D per-vertex sketch» (σχόλιο `bim-gizmo-overlay.ts` γρ. 85). Οι λαβές περιγράμματος
είναι **διαφορετικό DOF** (μεταβλητός αριθμός κορυφών), γι' αυτό χρειάζεται ξεχωριστό overlay, όχι επέκταση
του σταθερού handle-set του gizmo.

---

## 4. Σχέδιο υλοποίησης (φασικό)

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1** | 3D grip overlay (slab) — εμφάνιση λαβών + hit-test + **single-commit-on-release** (χωρίς live ghost) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ2** | **Live preview** (η πλάκα ξαναχτίζεται ανά frame ενώ σέρνεις την κορυφή) + **snap** (reuse snap engine) + **Shift→rectilinear** | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ3a** | Γενίκευση: **roof + floor-finish** (ίδιο overlay, +gripKinds στο φίλτρο + per-vertex elevation + live preview builders) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ3b** | Γενίκευση: **slab-opening** (ειδική — ξαναχτίσιμο host slab με τη μετακινημένη τρύπα, πρότυπο `buildOpeningHostWallPreview`) | DEFER |
| **Φ4 (μερικό)** | **Hide gizmo όσο είσαι σε reshape** (`setVisible(false/true)` στο grip pointerdown/up/cancel) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ4 (υπόλοιπο)** | Edit-mode toggle «Επεξεργασία σκίτσου» + context-menu «διαγραφή / εισαγωγή κορυφής» (reuse `removeVertexFrom*` + λογική `useGripContextMenuController`, νέο 3D popup + i18n N.11) | DEFER |

### 4.1 Ροή συντεταγμένων (η καρδιά)

```
ΕΜΦΑΝΙΣΗ:
  GripInfo[] = computeDxfEntityGrips(entity)            // ήδη διαθέσιμο, mm κάτοψης
  φίλτρο → reshape grips (slabGripKind: vertex/midpoint)
  world = dxfPlanToWorld(g.position.x, g.position.y, elevMm)   // elevMm = top της πλάκας
  → μικρό camera-facing τετράγωνο (billboard) + hitbox στο world, screen-constant scale

DRAG:
  ray ∩ οριζόντιο επίπεδο (normal = world +Y) στο elevMm  → worldPoint
  worldToDxfPlan(worldPoint) → {x,y}  →  delta = {x - gripStart.x, y - gripStart.y}  (mm)

COMMIT (release):
  gripInfo: UnifiedGripInfo = { source:'dxf', entityId, slabGripKind, position, type, gripIndex, movesEntity:false }
  commitDxfGripDragModeAware(gripInfo, delta, buildDeps(levels, levelId), 'stretch')
  → commitSlabGripDrag → UpdateSlabParamsCommand → scene re-sync (αυτόματο)
```

**Σημείωση elevation:** η Φ1 χρησιμοποιεί **ένα** επίπεδο (top της πλάκας, από `worldToDxfPlan(anchor).z`
ή το slab top). Λοξές/πολυεπίπεδες κορυφές (per-vertex z) → Φ2+.

### 4.2 Νέα αρχεία (όλα < 500 γρ., functions < 40 γρ. — N.7.1)

```
bim-3d/grips/
  bim-grip-overlay-3d.ts        // overlay: meshes στη σκηνή, screen-constant scale, hover, show/hide
                                // (αντίγραφο BimGizmoOverlay· REUSE GIZMO_SCREEN_SCALE math)
  grip-mesh-factory-3d.ts       // GripInfo[] → camera-facing square visuals + hitboxes (billboard)
  grip-3d-hit-test.ts           // raycaster vs grip hitboxes → nearest (mirror testGizmoHit, χωρίς priority)
  bim-grip-controller-3d.ts     // FSM hover→drag, ray∩plane projection, live follow
  grip-plane-projection.ts      // PURE: ray ∩ οριζόντιο plane(elev) → Point2D delta (mm). Jest-friendly.
  grip-3d-commit.ts             // GripInfo→UnifiedGripInfo + delta → commitDxfGripDragModeAware(buildDeps)
  grip-3d-reshape-grips.ts      // PURE φίλτρο: ποια GripInfo είναι «reshape» (vertex/midpoint, !movesEntity)
animation/
  bim3d-grip-preview-rebuild.ts // Φ2: buildSlabReshapePreviewObject(id, gripKind, deltaMm)
                                // = applySlabGripDrag → computeSlabGeometry → converter SSoT → THREE.Object3D
                                // (mirror buildEndpointMovePreviewObject)
```

### 4.3 Wiring στα υπάρχοντα (touch, με staged ADR — CHECK 6B/6D)

- **`use-bim3d-edit-interaction.ts`** — mount `BimGripOverlay3D` + `BimGripController3D` δίπλα στο gizmo·
  στο `applyActiveState`: όταν single-select **slab** → υπολόγισε grips, θέσε τες στο overlay, show.
  (Multi-select → hide grips, μόνο gizmo. Mirror του `setActiveHandles`/`refreshLinearEndpointHandles`.)
- **`bim3d-edit-interaction-handlers.ts`** — στο `onEditPointerDown`: **πρώτα** δοκίμασε grip hit
  (`gripController.beginDrag`)· αν δεν χτυπήθηκε grip → πέσε στο υπάρχον `controller.beginDrag` (gizmo).
  Στο `onEditPointerMove/Up`: αν τρέχει grip drag → grip path, αλλιώς gizmo path.
  Reuse `createSceneManagerAdapter(buildDeps(...))` + `emitStructuralChangeAfterEdit` (ADR-459 Φ7).

### 4.4 Συνύπαρξη gizmo ↔ grips (priority)

- Idle: εμφανίζονται **και τα δύο** (gizmo στο κέντρο, grips στην περίμετρο).
- Pointer-down: **grip hit-test πρώτα** (μικροί στόχοι, πιο specific)· αν αστοχήσει → gizmo.
- Κατά το grip drag: **κρύψε το gizmo** (mirror του `collapseToMoveHandles`), επανέφερε στο release
  (`restoreConfiguredHandles`). Και αντίστροφα: gizmo move drag → κρύψε grips.

---

## 5. Πίνακας επαναχρησιμοποίησης SSoT (μηδέν διπλότυπο)

| Ανάγκη | Υπάρχον SSoT — reuse | Νέο; |
|---|---|---|
| Θέσεις λαβών | `computeDxfEntityGrips` / `getSlabGrips` | ❌ reuse |
| mm ↔ world | `dxfPlanToWorld` / `worldToDxfPlan` | ❌ reuse |
| Screen-constant scale | `GIZMO_SCREEN_SCALE` + `dist·tan(fov/2)·k` (gizmo overlay) | ❌ reuse |
| Raycast | `THREE.Raycaster` + pattern του `testGizmoHit` | ⚠️ thin νέο (nearest) |
| Drag → νέα params | `applySlabGripDrag` (pure) | ❌ reuse |
| Commit | `commitDxfGripDragModeAware` → `commitSlabGripDrag` → `UpdateSlabParamsCommand` | ❌ reuse |
| Scene adapter | `createSceneManagerAdapter(buildDeps(...))` | ❌ reuse |
| Structural emit | `emitStructuralChangeAfterEdit` | ❌ reuse |
| Live geometry rebuild | `captureResize` + `applyResize` + converter SSoT (mirror `buildEndpointMovePreviewObject`) | ⚠️ thin νέο builder |
| Snap (Φ2) | `getGlobalSnapEngine` + `makeResizeSnapFn` + `syncSnapEngineViewportFor3D` | ❌ reuse |
| Render loop | `manager.markSceneDirty()` + `UnifiedFrameScheduler` (ADR-040/366) | ❌ reuse |

---

## 6. Κίνδυνοι / ανοιχτά σημεία (να επιβεβαιωθούν στην υλοποίηση)

1. **`buildDeps` vs `DxfCommitDeps` συμβατότητα** — το gizmo path τρέφει `createSceneManagerAdapter(buildDeps(...))`,
   τα grip adapters τρέφουν `createSceneManagerAdapter(deps: DxfCommitDeps)` + χρησιμοποιούν `deps.execute`,
   `deps.moveEntities`, `deps.onToolChange`. **Να ελεγχθεί** ότι το `buildDeps` παρέχει τα πεδία που χρειάζεται
   ο stretch/slab path (κατά πάσα πιθανότητα ναι — ίδιο `createSceneManagerAdapter` — αλλά να επιβεβαιωθεί
   `execute`/`moveEntities`). Αν λείπουν → thin adapter στο `grip-3d-commit.ts`.
2. **Elevation επιπέδου drag** — Φ1: ένα επίπεδο (slab top). Λοξή πλάκα/per-vertex z → Φ2.
3. **Επικάλυψη grip ↔ gizmo στην οθόνη** — όταν κορυφή πέφτει κοντά στο κέντρο (μικρή πλάκα). Λύση: grip-first
   priority + collapse gizmo κατά το drag (§4.4).
4. **Billboard κορυφών vs occlusion** — οι λαβές πρέπει να φαίνονται «πάνω» από την πλάκα (depthTest off,
   `renderOrder` σαν το gizmo snap-marker). Mirror `createSnapMarker` (depth-test off).
5. **`UnifiedGripInfo` shape** — να επιβεβαιωθεί ποια ακριβώς πεδία απαιτεί ο `commitSlabGripDrag`
   (`source`, `entityId`, `slabGripKind`, `position`, `type`, `gripIndex`, `movesEntity`). Map 1:1 από `GripInfo`.
6. **Φ2 rectilinear (Shift)** — το `applySlabGripDrag` δέχεται `rectilinear` (ortho). Να περαστεί `e.shiftKey`.

---

## 7. Testing (Google presubmit-grade, colocated jest)

- `grip-plane-projection.test.ts` — ray ∩ plane(elev) → σωστό mm delta (γνωστά rays/κάμερα).
- `grip-mesh-factory-3d.test.ts` — `GripInfo[]` → σωστές world θέσεις (`dxfPlanToWorld`) + πλήθος hitboxes.
- `grip-3d-reshape-grips.test.ts` — φιλτράρει σωστά vertex/midpoint, αγνοεί whole-entity/center grips.
- `grip-3d-commit.test.ts` — `GripInfo`→`UnifiedGripInfo` + delta → καλεί `commitDxfGripDragModeAware`
  με σωστό gripKind (mock deps· επιβεβαίωση ότι φτάνει `commitSlabGripDrag`).
- Φ2: `bim3d-grip-preview-rebuild.test.ts` — `applySlabGripDrag` → νέα params → object χτίζεται.
- **tsc (N.17):** ΕΝΑ tsc τη φορά — έλεγχος διεργασίας ΠΡΙΝ. Προτίμηση colocated jest για επαλήθευση.

---

## 8. Συμμόρφωση (pre-commit / αρχιτεκτονική)

- **ADR-040 / CHECK 6B/6D/6C:** το `BimGripOverlay3D` είναι **pure-THREE leaf** — **καμία** `useSyncExternalStore`,
  καμία store subscription· οδηγείται από το interaction hook (mirror `BimGizmoOverlay`). Render μόνο μέσω
  `markSceneDirty` + `UnifiedFrameScheduler`. Επειδή αγγίζονται bim-3d edit αρχεία → **stage αυτό το ADR (535)
  + ADR-040** στο commit.
- **N.7.1:** όλα τα νέα αρχεία < 500 γρ., functions < 40 γρ. (split factory/projection/commit/hit-test).
- **N.2/N.11:** zero `any` (proper THREE/GripInfo types)· καμία hardcoded string (visual-only, χωρίς labels Φ1).
- **N.6 / enterprise-id:** δεν δημιουργούνται νέα Firestore docs — μόνο `UpdateSlabParamsCommand` (υπάρχον).

---

## 9. Συμπέρασμα έρευνας

Το feature είναι **εφικτό, αρχιτεκτονικά καθαρό, και χαμηλού ρίσκου** γιατί:
- **οι θέσεις λαβών υπολογίζονται ήδη στην 3D** (`computeDxfEntityGrips`, §2.2),
- **οι μετασχηματισμοί mm↔world είναι έτοιμο SSoT** (§2.3),
- **το gizmo είναι τέλειο template** για overlay/controller/drag (§2.4),
- **το commit είναι ήδη view-agnostic** — re-sync αυτόματο (§2.5).

Το πραγματικά νέο = **~7 thin αρχεία** (overlay/factory/hit-test/controller/projection/commit/filter) + wiring
2 υπαρχόντων + (Φ2) ένας preview builder. Pilot = **πλάκα**· γενίκευση σε roof/floor-finish/slab-opening σχεδόν δωρεάν.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-26 | **Φ3a + Φ4(hide-gizmo) ΥΛΟΠΟΙΗΣΗ — γενίκευση grips σε roof + floor-finish + απόκρυψη gizmo κατά reshape (UNCOMMITTED).** Οι λαβές επεξεργασίας περιγράμματος δουλεύουν πλέον **και σε στέγη + επικάλυψη δαπέδου** (όχι μόνο πλάκα), με live reshape preview + snap + Shift→ortho — όπως η πλάκα. **ΠΛΗΡΗΣ SSoT reuse (μηδέν διπλότυπο, επιβεβαιωμένο με grep audit):** (1) **Φίλτρο** `reshapeGripsForSlab` → **`reshapeGripsForFootprint`** — κρατά ΟΠΟΙΟΔΗΠΟΤΕ footprint discriminator (`slab/roof/floorFinish/slabOpening`), πάντα `!movesEntity`. (2) **`toUnifiedGrip`** (`grip-3d-commit`) προωθεί 1:1 και τα 3 νέα gripKinds → ο **ήδη type-agnostic** `commitDxfGripDragModeAware` δρομολογεί στο σωστό adapter (`commitRoofGripDrag`/`commitFloorFinishGripDrag`). (3) **Live preview builders** σε **ΝΕΟ** `bim3d-grip-preview-builders.ts` (N.7.1 split — ο slab builder μεταφέρθηκε εκεί μαζί με roof+ff· `bim3d-preview-rebuild.ts` 475→~430 γρ.): `buildRoofReshapePreviewObject` = `applyRoofGripDrag`→`computeRoofGeometry`→`roofToMesh`· `buildFloorFinishReshapePreviewObject` = `applyFloorFinishGripDrag`→`floorFinishToMesh` — **ghost === commit** (ίδια SSoT με τα `Update*ParamsCommand`). (4) **`applyGripReshapePreview`** dispatch ανά gripKind. (5) **Per-vertex elevation** ανά τύπο: slab→`slabTopZmmAt` (υπήρχε)· **roof→`roofZmm`** (lower-envelope SSoT· περιφερειακές κορυφές στο `basePivotZ`/γείσο, midpoint σε αετωματική ακμή ανηφορίζει — ίδια height field με `computeRoofGeometry`)· floor-finish→επίπεδο FFL (`box.max.y` ακριβές). (6) **`refreshReshapeGrips`** widened σε `RESHAPE_BIM_TYPES = {slab,roof,floor-finish}`. **Wiring ΗΔΗ type-agnostic** (το pointerdown capture/snap απλώς λεγόταν `slabId` → rename `entityId`· `buildGripReshapeSnapFn`/`captureResize` ήδη type-agnostic). **Φ4 hide-gizmo:** στο grip pointerdown → `ctx.overlay.setVisible(false)` (Revit «Edit Sketch»: το gizmo παραμερίζεται)· pointerup/cancel → `setVisible(true)`. **ΜΟΝΑΔΕΣ (audit-flagged risk):** slab/roof/floor-finish δημιουργούνται όλα σε **mm** (`buildDefaultFloorFinishParams` sceneUnits='mm'· το `?? 'm'` του converter είναι μόνο legacy fallback) → το grip pipeline (raw params units → `dxfPlanToWorld` ως mm) είναι συνεπές, όπως ο slab. **Tests:** `reshapeGripsForFootprint` (+roof/ff/slab-opening cases), `grip-3d-commit` (+roof/ff forward), **ΝΕΟ** `bim3d-grip-preview-builders.test.ts` (roof+ff: headline «ghost===commit», edge-midpoint insert, no-op/unknown/multi-floor null). **167/167 jest GREEN** (grips + animation suites, μηδέν regression). **Φ3b (slab-opening: host-slab rebuild)** + **Φ4 (toggle + context-menu κορυφής)** DEFER. 🔴 browser-verify (επίλεξε στέγη/επικάλυψη στο 3D → σύρε κορυφή/μέσο πλευράς· tilt στέγης → οι λαβές στο γείσο/κορφιά· gizmo κρύβεται κατά το reshape) + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Δημιουργία ADR.** Βαθιά έρευνα κώδικα (2D grips, 3D gizmo, coordinate transforms, commit path, live preview). Status: RESEARCH COMPLETE — εγκεκριμένο για υλοποίηση σε νέα συνεδρία. Καμία αλλαγή κώδικα ακόμη. |
| 2026-06-26 | **Φ1 visual refinement (Giorgio, μετά browser-verify «λαβές εμφανίζονται»).** Οι λαβές από flat billboarded τετράγωνο (`PlaneGeometry`) → **axis-aligned κύβος** (`BoxGeometry`, πραγματικά 3D από κάθε γωνία· αφαιρέθηκε το billboard στο `updateScale`). Περίγραμμα λευκό → **λεπτό μαύρο** (`GRIP_3D_OUTLINE_COLOR=0x000000`· WebGL caps line width=1px άρα ήδη το λεπτότερο — το «χοντρό» ήταν το λευκό χρώμα). 2 αρχεία (`grip-mesh-factory-3d.ts` + `bim-grip-overlay-3d.ts`), 14 jest GREEN. |
| 2026-06-26 | **Φ1 solid-cube self-occlusion (Giorgio: μόνο ορατές ακμές, όχι οι πίσω).** Ο κύβος ήταν «διάφανο wireframe» (`depthTest:false` → όλες οι 12 ακμές, μαζί οι 3 πίσω). FIX: opaque κύβος `depthTest+depthWrite ON` (self-occlusion: οι μπροστινές όψεις κρύβουν τις πίσω ακμές) + `polygonOffset` στη fill (η μαύρη γραμμή κερδίζει το depth test χωρίς z-fight) + outline `depthTest:true`. Ο κύβος **πατάει πάνω** στην επιφάνεια (children lift +½ side, όχι μισοχωμένος). `grip-mesh-factory-3d.ts`, 14 jest GREEN. 🔴 browser-verify. |
| 2026-06-26 | **Φ2 fix — per-vertex υψόμετρο λαβών σε ΚΕΚΛΙΜΕΝΗ πλάκα (Giorgio browser-verify: «έγειρα την πλάκα με το gizmo και οι λαβές πετάνε»).** Το Φ1 τοποθετούσε ΟΛΕΣ τις λαβές σε ΕΝΑ ενιαίο υψόμετρο (`box.max.y`)· σε tilted πλάκα κάθε κορυφή έχει διαφορετικό top-Z (slope plane) → οι λαβές πετούσαν πάνω/μακριά από την επιφάνεια. **FIX (full SSoT):** κάθε λαβή κάθεται στο **δικό της** υψόμετρο μέσω του υπάρχοντος `slabTopZmmAt(params, planPoint)` (ο ΙΔΙΟΣ `slabSlopeOffsetZmm` που καταναλώνει το `applySlabSlope` του converter → grip === rendered surface) + building base. **Αλλαγές:** `createGrip3DMeshes(grips, elevationMmFor)` & `BimGripOverlay3D.setGrips(grips, elevationMmFor)` δέχονται resolver `(grip)=>elevMm` αντί ενιαίου `planeWorldY`· `refreshReshapeGrips` χτίζει `slabGripElevationMmFor` (διαβάζει slab από `Bim3DEntitiesStore` = ίδια πηγή με το mesh· fallback `box.max.y`)· ο controller προβάλλει το drag στο οριζόντιο επίπεδο **της ίδιας της λαβής** (`gripStartWorld.y`, όχι ενιαίο plane)· το slope ξαναϋπολογίζει το z της μετακινημένης κορυφής στο preview/commit. Οπτικά tweaks Φ1 (solid cube/occlusion) αμετάβλητα. 4 `setGrips([],0)`→`setGrips([])`. **21/21 jest GREEN** (+1 per-vertex factory test). 🔴 browser-verify (tilt → drag κορυφής στην κεκλιμένη επιφάνεια) + commit. |
| 2026-06-26 | **Φ2 ΥΛΟΠΟΙΗΣΗ — Live reshape preview + snap + Shift→rectilinear (UNCOMMITTED).** Η πλάκα πλέον αναμορφώνεται **ζωντανά ανά frame** καθώς σέρνεις την κορυφή (όχι μόνο στο release), η κορυφή **κουμπώνει** (μαγνήτης) σε κοντινά χαρακτηριστικά, και **Shift→ορθογώνιος** περιορισμός. **ΠΛΗΡΗΣ SSoT reuse (μηδέν διπλότυπο):** (1) **builder** `buildSlabReshapePreviewObject` colocated στο `bim3d-preview-rebuild.ts` — αδελφός του `rebuildSlab`, **μόνη αλλαγή** το param-transform (`applySlabGripDrag` αντί `computeSlabResizeParams`)· reuse αυτούσια `slabToMesh`/openings-filter/`baseElevationOf`/multi-floor guard → **ghost === commit**. (2) **Live swap** μέσω του υπάρχοντος `Bim3DEditLivePreview.captureResize`(pointerdown)/`applyResize`(per-frame)/`commit`/`reset` — ίδιος μηχανισμός με το gizmo resize. (3) **Snap:** νέο `buildGripReshapeSnapFn` (colocate στο `bim3d-edit-drag-snap.ts`) = reuse `getGlobalSnapEngine`+`makeResizeSnapFn`+`syncSnapEngineViewportFor3D` (3D-derived pixel tolerance· entityId self-exclude)· ο `BimGripController3D.updateDrag` εφαρμόζει το snap στην κορυφή (mirror `BimGizmoDragBridge.applySnap`: world→plan→snap→world στο ίδιο elevation) και ξανα-υπολογίζει το delta από `gripStart→snapped`. (4) **Shift→rectilinear:** το preview builder διαβάζει την **ΙΔΙΑ** πηγή Shift με το commit (`ShiftKeyTracker.getSnapshot()` που ήδη διαβάζει το `commitSlabGripDrag`) → preview === commit ακόμα και με τον ortho modifier. **Wiring (`bim3d-edit-interaction-handlers.ts`):** grip pointerdown→`captureResize`+inject snapFn· pointermove→`applyGripReshapePreview` (per-frame mesh rebuild)· pointerup→`commit()`/`reset()` βάσει committed· cancel→`reset()`. **N.7.1 split:** το handlers ξεπερνούσε τις 500 γρ. → εξήχθη όλη η reshape-grip λογική (`refreshReshapeGrips`+`applyGripReshapePreview`+`commitGripReshape`) σε νέο colocated **`bim3d-grip-drag.ts`** (type-only `EditInteractionCtx` import → μηδέν runtime cycle)· handlers 508→438 γρ. **Tests:** νέο `__tests__/bim3d-grip-preview-rebuild.test.ts` (6 tests, headline = «preview === commit»: geometry του builder ταυτίζεται byte-for-byte με `applySlabGripDrag`+`slabToMesh`· + vertex enlarge / edge-midpoint insert / no-op / unknown-id / multi-floor null). **20/20 jest GREEN** (14 Φ1 + 6 Φ2). 🔴 browser-verify + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ1 ΥΛΟΠΟΙΗΣΗ (COMMITTED).** 7 thin αρχεία σε `bim-3d/grips/`: `grip-plane-projection.ts` (ray∩horizontal-plane→plan-mm, PURE), `grip-3d-reshape-grips.ts` (φίλτρο slab reshape grips, PURE), `grip-3d-hit-test.ts` (raycaster→nearest gripIndex), `grip-mesh-factory-3d.ts` (GripInfo[]→camera-facing squares+hitboxes via `dxfPlanToWorld` SSoT), `bim-grip-overlay-3d.ts` (scene leaf: screen-constant scale reuse `snapMarkerScreenScale`, hover, show/hide — zero store/React per ADR-040), `bim-grip-controller-3d.ts` (FSM hover→drag→idle, 1:1 cursor follow), `grip-3d-commit.ts` (→`commitDxfGripDragModeAware`→`commitSlabGripDrag`). **Wiring:** `use-bim3d-edit-interaction.ts` (mount overlay+controller, `refreshReshapeGrips` σε selection/resync, dispose) + `bim3d-edit-interaction-handlers.ts` (grip-first hit-test στο pointerdown, grip path σε move/up/cancel/wheel, `refreshReshapeGrips` export). **Risk #1 (§6.1) ΛΥΘΗΚΕ:** `buildDeps.execute` είναι no-op (gizmo path τρέχει `getGlobalCommandHistory().execute` μόνο του) → override `execute` με real history dispatcher στο `grip-3d-commit`. **Risk #5:** `UnifiedGripInfo` map 1:1 (`type` 'midpoint'→'edge'). **Διπλό-emit απεφεύχθη:** `commitSlabGripDrag` ήδη κάνει `emitBimEntityParamsUpdated('slab')` → ΔΕΝ καλείται `emitStructuralChangeAfterEdit`. Gizmo+grips συνυπάρχουν (grip-first priority). Pilot=slab. 14 jest GREEN (4 suites). 🔴 browser-verify + tsc + commit (stage ADR-040+535, CHECK 6B/6D). Φ2 (live preview+snap) / Φ3 (roof/floor-finish/slab-opening) / Φ4 (edit-mode UX) DEFER. |
