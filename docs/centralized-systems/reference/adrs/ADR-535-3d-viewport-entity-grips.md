# ADR-535 — Λαβές (grips) επεξεργασίας οντοτήτων στην 3D προβολή

**Status:** 🟢 Φ1+Φ2+Φ3a+Φ3b+Φ4(hide-gizmo+context-menu)+Φ5(2D-overlay)+Φ5b(GPU depth occlusion)+Φ6(twin top/bottom grips)+Φ7(κολόνες)+Φ8(τοίχοι)+Φ9(δοκάρια)+**Φ10(move-follow)** IMPLEMENTED (UNCOMMITTED) · Φ4 (edit-mode toggle) DEFER · **Date:** 2026-06-26 (Φ10: 2026-06-29)
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
| **Φ3b** | Γενίκευση: **slab-opening** (ειδική — single-selectable invisible pick mesh + ξαναχτίσιμο host slab με τη μετακινημένη τρύπα, πρότυπο `buildOpeningHostWallPreview`) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ4 (μερικό)** | **Hide gizmo όσο είσαι σε reshape** (`setVisible(false/true)` στο grip pointerdown/up/cancel) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ4 (context-menu)** | Context-menu κορυφής «διαγραφή / εισαγωγή κορυφής» (shared SSoT `buildFootprintVertexOpCommand`, νέο 3D popup `Grip3DVertexContextMenu` + i18n N.11) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ5** | Λαβές = **Canvas2D overlay πάνω από το WebGL** με τον **ΙΔΙΟ** 2D `UnifiedGripRenderer` (μία πηγή draw → ίδιο μέγεθος/σχήμα/χρώμα, συνεχές zoom, screen-space hit-test). Λαβές ON TOP (χωρίς occlusion) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ5b** | **Depth occlusion** λαβών (μόνο πρώτο πλάνο, Revit/Maxon-grade **GPU depth-buffer** — κρατά τον Canvas2D overlay SSoT· CPU raycast απέτυχε) | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ6** | **Δίδυμες λαβές πάνω + κάτω** (twin top/bottom): κάθε λαβή κορυφής/μέσου ζωγραφίζεται **και** στην κάτω παρειά· σύρσιμο κάτω = **ΙΔΙΟ** reshape με πάνω (ίδιο plan vertex, ΙΔΙΟ command). Flat 2N index space (`0…N-1` top, `N…2N-1` bottom)· bottom elevation = SSoT `slabUndersideZmmAt`/roof `−thickness`/finish `−thicknessMm`· occlusion Φ5b ΔΩΡΕΑΝ κρύβει την κάτω από πάνω (& αντίστροφα). Revit/Maxon-grade | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ7 (κολόνες)** | **Reshape λαβές για ΚΟΛΟΝΕΣ** (οικογένεια #1 «Δομικά»): cross-section reshape (γωνία/πλευρά/παραμετρικά/poly-vertex) μέσω του ΗΔΗ type-agnostic commit· gate+filter+`toUnifiedGrip` forward+`buildColumnReshapePreviewObject` (reuse `columnPreviewProfiles`)· elevation = mesh AABB. center+rotation→gizmo | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ8 (τοίχοι)** | **Reshape λαβές για ΤΟΙΧΟΥΣ** (οικογένεια #2 «Δομικά», ίδιο pattern Φ7): cross-section reshape (γωνία/πάχος/μήκος/endpoint/curve/poly-vertex)· gate+filter (εξαίρεση `wall-rotation`)+`toUnifiedGrip` forward+`buildWallReshapePreviewObject` (reuse `wallPreviewProfiles`+`wallPreviewTopClip`, **τα openings ακολουθούν**)· `currentPos = grip.position+delta` (byte-parity με `commitWallGripDrag`)· elevation = mesh AABB (boy-scout `bboxSurfaceElevations` κοινό column+wall). midpoint+rotation→gizmo | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ9 (δοκάρια)** | **Reshape λαβές για ΔΟΚΑΡΙΑ** (οικογένεια #3 «Δομικά», ίδιο pattern Φ7/Φ8): cross-section reshape (γωνία/πλάτος/μήκος-άκρα/endpoint/curve/poly-vertex)· gate+filter (εξαίρεση `beam-rotation`)+`toUnifiedGrip` forward+`buildBeamReshapePreviewObject`· `currentPos = grip.position+delta` (byte-parity με `commitBeamGripDrag`)· elevation = mesh AABB (κοινό `bboxSurfaceElevations`). midpoint+rotation→gizmo. **+ αφαίρεση των σιελ endpoint rings** (`ENDPOINT_HANDLES_BY_TYPE` -= `beam`) — οι 2D λαβές καλύπτουν πλέον το μήκος/πλάτος | ✅ **DONE** (UNCOMMITTED 2026-06-26) |
| **Φ10 (move-follow)** | **Οι λαβές ακολουθούν RIGID το στοιχείο κατά το gizmo MOVE drag** (big-player handle-follow, Revit/Cinema 4D/Figma — πριν έμεναν στατικές στην αρχική θέση ενώ το mesh έφευγε). Το **ΙΔΙΟ** live `t` world-translation που κινεί το mesh (`getLivePreview`→`applyLivePreview`, με axis-lock) εφαρμόζεται ως world-offset στις λαβές. SSoT: νέο `liftGripPlanToWorld` (plan+elev+offset→world) που τροφοδοτεί **ΚΑΙ** τον draw projector **ΚΑΙ** τον GPU occluder (μηδέν ghost/occlusion drift)· non-reactive `liveMoveWorld` στο `grip3DOverlayInteraction` (ADR-040 zero React state)· set στο `applyLivePreview` move-branch, clear στο single-exit `settleAfterEditDrag` + `resetGrip3DInteraction` (commit re-sync re-seats). **rotate/resize → λαβές στατικές (DEFER, μηδέν regression).** 5 jest | ✅ **DONE** (UNCOMMITTED 2026-06-29) |
| **Φ11 (κεκλιμένος τοίχος)** | **Οι TOP λαβές κεκλιμένου (battered) τοίχου ακολουθούν τη σεσμηρισμένη πάνω παρειά** (πριν «πετούσαν» στο `box.max.y` πάνω από τη βάση). Το tilt είναι **shear** (ADR-404: βάση σταθερή, κορυφή ⟂ στη run κατά `height·tan(angle)`, ύψος αμετάβλητο) → νέο `wallGripSurfaceElevations` καλεί τον `wallTiltShearAt` SSoT (ΙΔΙΟ shear με mesh+τομή), το plan-mm delta → world-offset (`dxfPlanToWorld`) που εφαρμόζεται **ΜΟΝΟ** στις top grips. Reuse Φ10: `liftGripPlanToWorld` + νέο `addGripWorldOffsets` (top = move+tilt, bottom = move)· occluder probe-άρει στο ΙΔΙΟ shifted σημείο. `topWorldShift` low-freq στο store. Κατακόρυφος τοίχος → null (fast path). column/beam tilt = flagged follow-up. 3 jest | ✅ **DONE** (UNCOMMITTED 2026-06-29) |
| **Φ-endpoint-SSoT** | **Πλήρης ενοποίηση των endpoint rings** (τυρκουάζ): wall αφαιρέθηκε από `ENDPOINT_HANDLES_BY_TYPE` (parity με beam Φ9)· η αλήθεια «ποιοι τύποι έχουν endpoint rings» γίνεται **ΜΙΑ πηγή** μέσω νέου `hasEndpointHandles` gate που διαβάζει ο positioner (`refreshLinearEndpointHandles`) — δεν τοποθετεί πια κρυμμένες λαβές (dead-offset). Διαγραφή dead `refreshStructuralEndpointHandles` + `linear-endpoint-world.ts`. Μόνο `mep-segment` κρατά endpoint handles | ✅ **DONE** (UNCOMMITTED 2026-06-29) |
| **Φ9+ (θεμέλια)** | Υπόλοιπες οικογένειες Δομικών, Plan Mode ανά μία (ίδιο pattern) | TODO |
| **Φ4 (υπόλοιπο)** | Edit-mode toggle «Επεξεργασία σκίτσου» (χαμηλή προτεραιότητα — οι grips ήδη εμφανίζονται στο selection) | DEFER |

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
| 2026-06-27 | **Φ9 fix — δοκάρι έδειχνε μπλε+ΠΡΑΣΙΝΕΣ reshape λαβές (UNCOMMITTED).** Giorgio: «οι κολόνες μόνο μπλε, τα δοκάρια μπλε+πράσινες (εκτός gizmo)· στο 2D αποκλειστικά μπλε». **ΡΙΖΑ:** τα beam straight grips έρχονται από `axis-box-grips` με τις resize λαβές width/length-edge ως type **`'edge'`** (`bim/grips/axis-box-grips.ts`)· ο `GripColorManager` χρωματίζει **cold `'edge'` → πράσινο** (insert-midpoint convention). Στο 2D ο `BeamRenderer.getGrips` map-άρει `else→'vertex'` → μπλε, αλλά το 3D overlay (`BimGripOverlay2D`→`buildTwinSurfaceConfigs`) περνούσε το **raw** `grip.type='edge'` → πράσινο. Οι κολόνες δεν επηρεάζονται (edges = `'vertex'`)· τα slab insert grips είναι `'midpoint'` (≠ `'edge'`) → ήδη μπλε. **Fix:** στο `buildTwinSurfaceConfigs` render-type normalization `'edge'→'vertex'` (square μπλε, match 2D + κολόνες)· τα `'midpoint'` insert grips μένουν ως έχουν (δεν είναι resize). 1 αρχείο (`grip-3d-twin-overlay.ts`) + test (+1 case render-type). 5/5 twin-overlay GREEN. 🔴 browser-verify (δοκάρι 3D → ΟΛΕΣ οι reshape λαβές μπλε, μόνο το gizmo RGB) + commit. |
| 2026-06-26 | **Φ9 ΥΛΟΠΟΙΗΣΗ — reshape λαβές 3D για ΔΟΚΑΡΙΑ + αφαίρεση σιελ endpoint rings (οικογένεια #3 «Δομικά», UNCOMMITTED).** Giorgio: «στην πλάκα οροφής βλέπω λαβές πάνω + δίδυμες κάτω· θέλω το ΙΔΙΟ και στα δοκάρια, και να εξαφανίσεις τα σιελ δαχτυλίδια στις άκρες — να δείχνεις τις λαβές που έχει το δοκάρι στον 2D καμβά». Συνέχεια Φ7/Φ8, **ίδιο pattern ακριβώς** (το δοκάρι = γραμμικό μέλος, αδελφός του τοίχου). **ΕΥΡΗΜΑ SSoT audit (3 Explore agents + read ΠΡΙΝ τον κώδικα): το σύστημα ήταν ΗΔΗ type-agnostic** — ο `commitDxfGripDragModeAware` ΕΧΕΙ ήδη κλάδο `if (grip.beamGripKind) commitBeamGripDrag(...)` (grip-commit-adapters:255), τα `GripInfo.beamGripKind` + `UnifiedGripInfo.beamGripKind` υπάρχουν, ο `getBeamGrips` (axis-box SSoT, ίδιος με wall) εκπέμπει corner/width/length-edge/endpoint/poly-vertex. Έλειπαν τα ΙΔΙΑ **4 σημεία σύνδεσης** + το cyan-rings cleanup. **Αλλαγές (5 code + 2 test):** (1) `grips/grip-3d-reshape-grips.ts` — `hasFootprintGripKind` += `beamGripKind`· εξαίρεση `beam-rotation` (whole-entity rotate με `movesEntity:false`, όπως wall· το `beam-midpoint` πέφτει από `!movesEntity`). (2) `grips/grip-3d-commit.ts` — `toUnifiedGrip` προωθεί `beamGripKind`. (3) `animation/bim3d-grip-preview-builders.ts` — ΝΕΟ `buildBeamReshapePreviewObject` (αδελφός wall): `applyBeamGripDrag`→`computeBeamGeometry`→`beamToMesh` (reuse s.walls/s.columns για cutback)· `currentPos = grip.position + deltaMm` (byte-parity με `commitBeamGripDrag`). (4) `animation/bim3d-grip-drag.ts` — `RESHAPE_BIM_TYPES += 'beam'`· `bboxSurfaceElevations` κλάδος += `beam` (κοινό με column/wall, mesh AABB top/bottom)· `buildGripReshapePreview` += `beamGripKind` branch (περνά `grip.position` ως anchor). (5) `gizmo/bim-gizmo-overlay.ts` — **`ENDPOINT_HANDLES_BY_TYPE` -= `beam`** → εξαφανίζονται οι σιελ (teal `GIZMO_ENDPOINT_COLOR`) torus endpoint rings· το μήκος/πλάτος καλύπτεται πλέον από τις 2D reshape λαβές (αλλιώς διπλή/συγκρουόμενη λαβή μήκους). **Generic controller/overlay/hit-test/occlusion (Φ5/Φ6) + commit logic ΑΜΕΤΑΒΛΗΤΑ.** **Tests:** `grip-3d-reshape-grips.test.ts` (+3: beam reshape grips kept· midpoint+rotation dropped· toUnifiedGrip forwards beamGripKind)· `bim-gizmo-overlay.test.ts` (beam μετακινήθηκε στη λίστα «NO endpoint handles»)· `bim3d-grip-preview-builders.test.ts` (+4: beam width drag ghost===commit, zero-delta/unknown-id/multi-floor → null). **67/67 (reshape+gizmo) + 20/20 (preview-builders) GREEN, μηδέν regression.** tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε μέσω ts-jest full type-check (preview-builders import graph + νέα beam imports = μηδέν TS diagnostic). **Follow-up (flagged):** κεκλιμένα/host-clipped δοκάρια (το mesh AABB top = soffit όταν το κόβει πλάκα οροφής· per-corner top = εκτός MVP, όπως column/wall). **Επόμενη οικογένεια:** θεμέλια (ίδιο pattern). 🔴 browser-verify (επίλεξε δοκάρι 3D → λαβές γωνιών/πλάτους/μήκους πάνω+κάτω κεντραρισμένες, ΧΩΡΙΣ σιελ δαχτυλίδια· σύρε→live reshape· release→ίδιο με 2D· μετακίνηση/περιστροφή ολόκληρου μένει στο gizmo) + commit=Giorgio (stage 5 code + 2 test + ADR-535, CHECK 6B/6D). |
| 2026-06-26 | **Φ8 ΥΛΟΠΟΙΗΣΗ — reshape λαβές 3D για ΤΟΙΧΟΥΣ (οικογένεια #2 «Δομικά», UNCOMMITTED).** Συνέχεια Φ7 (κολόνες), **ίδιο pattern ακριβώς**, **Plan Mode ανά οικογένεια**. Επιλέγεις τοίχο στο 3D → λαβές γωνιών/πάχους/μήκους/endpoints/curve/poly-vertex (πάνω+κάτω έδρα, twin Φ6) → σύρσιμο → live reshape ghost **με τα openings (πόρτες/παράθυρα) να ακολουθούν** → release commit, **ΙΔΙΟ με 2D**. **ΕΥΡΗΜΑ SSoT audit (grep/read ΠΡΙΝ τον κώδικα, επαλήθευση handoff στο shared tree): όπως και στις κολόνες, το σύστημα ήταν ΗΔΗ ~type-agnostic** — ο `commitDxfGripDragModeAware` ΕΧΕΙ ήδη κλάδο `if (grip.wallGripKind) commitWallGripDrag(...)` (γρ.213), τα `GripInfo.wallGripKind` + `UnifiedGripInfo.wallGripKind` υπάρχουν, και το `bim3d-preview-rebuild.ts` έχει ήδη πλήρες wall preview (resize+tilt+endpoint) με attach profiles + openings + topClip. Έλειπαν τα ΙΔΙΑ **4 σημεία σύνδεσης**. **WALL-SPECIFIC gotchas (≠ κολόνες):** (α) το `WallGripDragInput` απαιτεί `currentPos` (REQUIRED, για thickness/rotation resolve) → παράγωγο `currentPos = grip.position + deltaMm`, **byte-identical με το `commitWallGripDrag`** (anchor = `grip.position` για κάθε non-rotation kind)· (β) `wall-rotation` εκπέμπεται με `movesEntity:false` (axis-box-grips:303) → **ρητή εξαίρεση** στο filter (το `wall-midpoint` πέφτει ήδη από `!movesEntity`)· (γ) ο preview ξαναχτίζει με **openings + `wallPreviewProfiles` + `wallPreviewTopClip`** (οι τρύπες ακολουθούν τον reshaped τοίχο)· (δ) `computeWallGeometry(next, wall.kind)` θέλει το `kind` (straight/curved/polyline). **Αλλαγές (4 code + test):** (1) `grips/grip-3d-reshape-grips.ts` — `hasFootprintGripKind` += `wallGripKind`· εξαίρεση `wall-rotation`. (2) `grips/grip-3d-commit.ts` — `toUnifiedGrip` προωθεί `wallGripKind` (αλλιώς ξέφευγε σε λάθος stretch path). (3) `animation/bim3d-grip-preview-builders.ts` — ΝΕΟ `buildWallReshapePreviewObject` (αδελφός column): `applyWallGripDrag`→`computeWallGeometry`→`wallToMesh` **reuse `wallPreviewProfiles`+`wallPreviewTopClip`** (export-αρίστηκαν από `bim3d-preview-rebuild.ts`, η ΙΔΙΑ SSoT που χρησιμοποιεί το resize/tilt/endpoint preview) + openings → ghost === commit, σωστό σε attached/stepped τοίχο. (4) `animation/bim3d-grip-drag.ts` — `RESHAPE_BIM_TYPES += 'wall'`· `buildGripReshapePreview` += `wallGripKind` branch (περνά `grip.position` ως anchor). **🧹 BOY-SCOUT SSoT (N.0.2):** το `columnGripSurfaceElevations(box)` του Φ7 + το wall ήταν πανομοιότυπα (bbox top/bottom) → γενικεύτηκαν σε ΕΝΑ `bboxSurfaceElevations(box)`, καλείται και για column ΚΑΙ για wall (+ μελλοντικά beam/foundation), μηδέν διπλότυπο. **Generic controller/overlay/hit-test/occlusion (Φ5/Φ6) ΑΜΕΤΑΒΛΗΤΑ.** **Tests:** επέκταση `grip-3d-reshape-grips.test.ts` (+3: wall reshape grips kept· midpoint+rotation dropped· toUnifiedGrip forwards wallGripKind· regression wallGripKind undefined). **11/11 reshape-grips suite + 22/22 preview-builders/rebuild suites GREEN** (μηδέν regression). tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full type-check (preview-builders + preview-rebuild import graph με τα νέα wall imports + exported functions = μηδέν TS diagnostic, κανένας import cycle). **Follow-up (flagged):** κεκλιμένοι/host-attached τοίχοι (per-corner top μέσω `resolveWallTopProfile`) — εκτός MVP, η bbox-flat λύση καλύπτει την κοινή περίπτωση. **Επόμενες οικογένειες Δομικών:** δοκάρια → θεμέλια (ίδιο pattern). 🔴 browser-verify (επίλεξε τοίχο 3D → λαβές γωνιών/πάχους/μήκους πάνω+κάτω κεντραρισμένες· σύρε→live reshape **με τα openings να ακολουθούν**· release→ίδιο με 2D· straight/curved/polyline· μετακίνηση/περιστροφή ολόκληρης μένει στο gizmo) + commit=Giorgio (stage 4 code + test + ADR-535, CHECK 6B/6D). |
| 2026-06-26 | **Φ7 ΥΛΟΠΟΙΗΣΗ — reshape λαβές 3D για ΚΟΛΟΝΕΣ (οικογένεια #1 «Δομικά», UNCOMMITTED).** Giorgio «να βλέπω λαβές και στις ΑΛΛΕΣ οντότητες, όχι μόνο πλάκες/οροφές» → επιλογή **Δομικά**, **Plan Mode ανά οικογένεια**· πρώτη = **κολόνα** (πιο συχνά-επεξεργαζόμενο, πλουσιότερες 2D λαβές). Επιλέγεις κολόνα στο 3D → λαβές γωνιών/πλευρών/παραμετρικών (πάνω+κάτω έδρα, twin Φ6) → σύρσιμο → live reshape ghost → release commit, **ΙΔΙΟ με 2D**. **ΕΥΡΗΜΑ SSoT audit (2 Explore agents ΠΡΙΝ τον κώδικα): το σύστημα ήταν ΗΔΗ ~type-agnostic** — ο `commitDxfGripDragModeAware` ΕΧΕΙ ήδη κλάδο `if (grip.columnGripKind) commitColumnGripDrag(...)`, το `GripInfo.columnGripKind` + `UnifiedGripInfo.columnGripKind` υπάρχουν, και το `bim3d-preview-rebuild.ts` έχει ήδη πλήρες column preview (resize+tilt) με attach top/base profiles. Έλειπαν **4 σημεία σύνδεσης**. **Αλλαγές (4 code + test):** (1) `grips/grip-3d-reshape-grips.ts` — `hasFootprintGripKind` += `columnGripKind`· ρητή εξαίρεση `column-rotation` (whole-entity rotate → το κατέχει το gizmo, όπως το `column-center` που πέφτει ήδη από το `!movesEntity`). (2) `grips/grip-3d-commit.ts` — `toUnifiedGrip` προωθεί `columnGripKind` (πριν έπεφτε σιωπηλά → ο commit ξέφευγε σε λάθος stretch path)· μετά απ' αυτό ο **ήδη υπάρχων** commit δρομολογεί σωστά, ΜΗΔΕΝ νέα commit logic. (3) `animation/bim3d-grip-preview-builders.ts` — ΝΕΟ `buildColumnReshapePreviewObject` (αδελφός του slab): `applyColumnGripDrag`→`computeColumnGeometry`→`columnToMesh` **reuse του `columnPreviewProfiles`** (export-αρίστηκε από `bim3d-preview-rebuild.ts`, η ΙΔΙΑ attach top/base SSoT που χρησιμοποιεί το resize/tilt preview) → ghost === commit, σωστό σε attached/stepped κολόνα· `floorElevationMm=0` (single-floor resync convention)· `ColumnGripDragInput` δεν έχει `rectilinear` (ο rect-grip engine χειρίζεται τους περιορισμούς του). (4) `animation/bim3d-grip-drag.ts` — `RESHAPE_BIM_TYPES += 'column'`· `gripSurfaceElevationsFor` δέχεται πλέον ολόκληρο το `box` (THREE.Box3) και ο **column resolver** δίνει top=`box.max.y`, bottom=`box.min.y` (κατευθείαν από το **rendered mesh AABB** = byte-consistent, μηδέν drift, μηδέν νέα Z-math — σωστό για επίπεδη πάνω/κάτω έδρα, η συντριπτική πλειονότητα)· `buildGripReshapePreview` += `columnGripKind` branch. **Generic controller/overlay/hit-test/occlusion (Φ5/Φ6) ΑΜΕΤΑΒΛΗΤΑ.** **Tests:** επέκταση `grip-3d-reshape-grips.test.ts` (+4: column reshape grips kept· center+rotation dropped· toUnifiedGrip forwards columnGripKind· regression footprint families). **212/212 GREEN** (grips+animation suites, μηδέν regression, baseline 219→ τώρα 8 στο reshape-grips suite). tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full type-check (filter+commit+preview-builders modules μηδέν TS diagnostic, κανένας import cycle). **Follow-up (flagged):** κεκλιμένες/host-attached κολόνες (per-corner top μέσω `resolveColumnTopProfile`/`resolveColumnBaseProfile`) — εκτός MVP, η bbox-flat λύση καλύπτει την κοινή περίπτωση. **Επόμενες οικογένειες Δομικών:** τοίχοι → δοκάρια → θεμέλια (ίδιο pattern, Plan Mode ανά μία). 🔴 browser-verify (επίλεξε κολόνα 3D → λαβές γωνιών/πλευρών πάνω+κάτω κεντραρισμένες· σύρε→live reshape· release→ίδιο με 2D· rect/L/T/I/U/circular/polygon· μετακίνηση ολόκληρης μένει στο gizmo) + commit=Giorgio (stage 4 code + test + ADR-535, CHECK 6B/6D). |
| 2026-06-26 | **Φ6 ΥΛΟΠΟΙΗΣΗ — δίδυμες λαβές πάνω + κάτω επιφάνειας (twin grips top/bottom, UNCOMMITTED).** Οι λαβές reshape μιας footprint οντότητας (slab/roof/floor-finish/slab-opening) εμφανίζονταν **μόνο στην ΠΑΝΩ** παρειά. Πλέον κάθε λαβή κορυφής/μέσου-πλευράς έχει **δίδυμη ακριβώς από κάτω** — ο χρήστης πιάνει όποια βολεύει (π.χ. κοιτώντας την πλάκα από κάτω) για μεγαλύτερη ακρίβεια (Revit / Maxon Cinema 4D). **Σύρσιμο κάτω λαβής = ΙΔΙΟ ΑΚΡΙΒΩΣ reshape με πάνω** (μετακινεί το **plan vertex**, **ΔΕΝ** αλλάζει το πάχος): top & bottom δίδυμο = ίδιο `Point2D` + ίδιο `*GripKind` → **ΙΔΙΟ command** (`commitGrip3DReshape` αμετάβλητο, μηδέν διπλό command path). **Αρχιτεκτονική (handoff §2-3):** το elevation είναι keyed-on-`Point2D` (`elevFor(p)`) → ένας projector είναι αμφίσημος για top/bottom στο ίδιο σημείο → **2 render passes** (top projector / bottom projector), μηδέν αλλαγή στο `UnifiedGripRenderer` contract. **Index model: flat 2N** (`0…N-1` top, `N…2N-1` bottom· base vertex = `flat % N`, surface = `flat>=N`) — κρατά αμετάβλητο το shape του non-reactive `grip3DOverlayInteraction` (πλήρως `number` indices + `boolean[]` visibility, ADR-040 zero React state). **FULL SSoT audit (handoff §4, grep ΠΡΙΝ τον κώδικα): bottom-surface helpers ΥΠΗΡΧΑΝ ΗΔΗ** → reuse: slab/slab-opening `slabUndersideZmmAt` (slab-slope SSoT, = top−thickness, ίδιο που καταναλώνει ο `slabHostInput`)· roof `roof.params.thickness` (κάθετα)· floor-finish `floorFinish.params.thicknessMm` — **μηδέν νέα thickness math**. **Occlusion Φ5b ΔΩΡΕΑΝ:** τα `worlds` διπλασιάστηκαν σε **2N** (N top + N bottom) → το GPU depth κρύβει την κάτω λαβή όταν κοιτάς από πάνω (πίσω από την πλάκα) & την πάνω από κάτω, αυτόματα, χωρίς νέο occluder. **Αλλαγές (5 αρχεία + 1 ΝΕΟ pure + 2 test):** `stores/Grip3DOverlayStore.ts` (`elevFor`→`topElevFor`+`bottomElevFor`, `setGrips(grips,top,bottom)`, doc flat-2N)· `grips/grip-3d-screen-hit-test.ts` (extract `nearestProjectedIndex` core SSoT + ΝΕΟ `findTwinGripAtScreen` 2N flat)· **ΝΕΟ** `grips/grip-3d-twin-overlay.ts` (PURE `buildTwinSurfaceConfigs` per-surface pass — dragged vertex κινεί ΚΑΙ τις δύο παρειές, force-show μόνο την ακριβή σερνόμενη, cull occluded· κρατά το leaf λεπτό + testable)· `animation/bim3d-grip-drag.ts` (`gripElevationMmFor`→`gripSurfaceElevationsFor` returning `{top,bottom}`, 4 resolvers με reuse των bottom SSoT)· `grips/bim-grip-controller-3d.ts` (twin hit-test 2 projectors→flat index· `beginDrag`/`gripAt` surface-aware: `flat%N` vertex, `flat>=N?bottomElevFor:topElevFor` plane· commit αμετάβλητο)· `viewport/grips/BimGripOverlay2D.tsx` (2 passes με 2 projectors + 2N occlusion worlds· σέβεται το πρόσφατο camMoving guard του ξένου agent). **Tests:** ΝΕΑ `grip-3d-twin-overlay` (5: idle cold, hover-warms-only-surface, drag-moves-both-faces-hot, cull-but-not-dragged) + επέκταση `grip-3d-screen-hit-test` (4 twin: flat-index top/bottom, nearest-across-surfaces, accept-skips-occluded, miss/empty). **219/219 GREEN** (grips+animation+stores, μηδέν regression· baseline 211). tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full type-check (store+hit-test+twin-overlay+drag-glue+controller μηδέν TS diagnostic· overlay tsx μεταγλωττίστηκε, μόνο firebase runtime). 🔴 browser-verify (πλάκα: λαβές πάνω+κάτω· από κάτω→κάτω ορατές/πάνω κρυφές· σύρε κάτω→ίδιο reshape με πάνω) + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ5b ΥΛΟΠΟΙΗΣΗ — Revit/Maxon-grade GPU depth occlusion λαβών (UNCOMMITTED).** Οι λαβές της 3D εμφανίζονται πλέον **μόνο στο πρώτο πλάνο**: λαβή κρυμμένη πίσω από στερεή επιφάνεια (άλλη οντότητα **Ή** το ίδιο το σώμα της επιλεγμένης) ΔΕΝ φαίνεται **ούτε επιλέγεται** — πλάκα οροφής από κάτω→πάνω λαβές κρυμμένες, από πάνω→ορατές (απόφαση Giorgio Option B «πλήρες βάθος, μόνο πρώτο πλάνο»). **Απόφαση δρόμου (AskUserQuestion + SSoT audit): Δρόμος Α — GPU depth-buffer που ΚΡΑΤΑ τον Canvas2D overlay SSoT** (μηδέν 2ος grip-renderer)· ο Δρόμος Β (in-scene billboards) απορρίφθηκε γιατί θα διπλασίαζε τον render code του Φ5 (anti-SSoT + ρίσκο οπτικού regression). **ΓΙΑΤΙ GPU (όχι CPU raycast):** το audit έδειξε ότι **δεν υπάρχει υπάρχον per-frame depth για reuse** (το `SSAOPass` τρέχει μόνο σε idle + internal· το `OutlinePass` του ADR-536 κάνει depth-aware occlusion αλλά για ακμές, ξένο αρχείο) — και το CPU raycast είχε ήδη αποτύχει (coplanar self-cull). **ΥΛΟΠΟΙΗΣΗ (FULL SSoT, 2 ΝΕΑ αρχεία που κατέχει το Φ5):** (1) **`grips/grip-3d-depth-occlusion-math.ts`** PURE (jest-friendly): `projectGripToProbe` (world→{screen-UV, eye-space viewZ, offscreen})· `isGripOccluded(gripViewZ, sceneViewZ, biasM)` = η ΙΔΙΑ απόφαση με το shader (jest parity)· `decodeGripVisibility` (RGBA→bool[], offscreen→πάντα ορατή)· `probeSlotClipX`. (2) **`grips/grip-3d-depth-occluder.ts`** GPU class `GripDepthOccluder`: **depth pre-pass** των στερεών σε `DepthTexture` (μη-στερεά Line/Points/Sprite κρύβονται ώστε μόνο επιφάνειες να κρύβουν· `overrideMaterial=MeshBasicMaterial colorWrite:false` = φθηνό· mirror του section-stencil RT/override pattern) → **probe pass** N λαβών ως 1px `Points` σε N×1 RT, fragment δειγματίζει το scene-depth στο grip UV και συγκρίνει eye-space Z με bias 5mm· **το βάθος-math = THREE `#include <packing>` `perspectiveDepthToViewZ`** (SSoT, μηδέν hand-rolled formula· το bias λύνει το coplanar self-cull που είχε ρίξει το CPU raycast) → **readback N pixels**, **CACHED** (recompute μόνο όταν αλλάζει κάμερα/πλήθος grips· static selection ή drag με παγωμένη κάμερα = μηδέν GPU κόστος)· ortho κάμερα→skip (όλες ορατές). **Wiring (μηδέν νέο subsystem):** ο overlay RAF (`BimGripOverlay2D`, η ΜΟΝΗ θέση που τρέχει τον occluder) υπολογίζει visibility→γράφει στο **non-reactive** `grip3DOverlayInteraction.visibility` (ADR-040 zero React state, νέο πεδίο + `isGrip3DVisible` helper + reset)→**cull** στο config loop (η σερνόμενη λαβή ΠΑΝΤΑ ορατή)· ο controller `hitTest` περνά `isGrip3DVisible` ως το **ήδη υπάρχον `accept` predicate** του `findGripAtScreen` → κρυμμένη λαβή ούτε ζωγραφίζεται ούτε επιλέγεται (ΕΝΑ occlusion SSoT). **Tests:** ΝΕΑ `grip-3d-depth-occlusion-math` (16: projection centre/behind/offscreen, occlusion rule incl. coplanar-bias band, RGBA decode, slot→clipX)· ΝΕΟ `grip-3d-depth-occluder.smoke` (3: construct/dispose + empty/ortho fast-paths χωρίς WebGL — type-check όλου του GPU module μέσω ts-jest). **211/211 GREEN** (grips+animation+stores, μηδέν regression· baseline 176). tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full type-check (math+occluder+controller+store· το overlay tsx μεταγλωττίστηκε χωρίς TS diagnostic, μόνο firebase/jsdom runtime). 🔴 browser-verify (πλάκα από κάτω→πάνω λαβές κρυμμένες, από πάνω→ορατές, πίσω από τοίχο→κρυμμένες· σερνόμενη πάντα ορατή) + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ5 ΥΛΟΠΟΙΗΣΗ — λαβές 3D = Canvas2D overlay με ΕΝΑΝ render code (occlusion DEFER → Φ5b) (UNCOMMITTED).** Οι λαβές στην 3D **έπαψαν να είναι 3D κύβοι-mesh** (`BoxGeometry` στη σκηνή· τρία προβλήματα browser-verified: πατούσαν πάνω/δεν κεντράρονταν, διαφορετικό μέγεθος/εμφάνιση από τη 2D, κλιμακωτό zoom γιατί `updateScale` μόνο σε events). Πλέον είναι **2D σύμβολα σε overlay `<canvas>` πάνω από το WebGL** που ζωγραφίζεται με τον **ΙΔΙΟ ΑΚΡΙΒΩΣ** `UnifiedGripRenderer` + τα **ΙΔΙΑ** settings (`getGripPreviewStyle`) του 2D καμβά → **μία πηγή αλήθειας draw**: ίδιο 7px τετράγωνο, ίδια χρώματα/hover-warmth, τέλειο κεντράρισμα στις κορυφές, **συνεχές (per-frame) zoom**. **SSoT reuse (μηδέν διπλότυπο, grep-verified):** ο 2D `UnifiedGripRenderer.renderGripSetBatched` αυτούσιος (mirror `GripPhaseRenderer.renderStandardGrips`: configs `type:grip.type??'vertex'`, `shape:'square'` — τα footprint grips δεν φέρουν `shape`, ίδιο με τη 2D)· projection reuse `dxfPlanToWorld`+`worldToScreen`· precedent overlay `CropRegionOverlay` (RAF 60fps, DPR, canvas-local rebase). **ΝΕΑ thin αρχεία:** `grips/grip-3d-screen-project.ts` (PURE `makeGripPlanToCanvas`: plan-mm→canvas-local px, behind-camera→`GRIP_OFFSCREEN`· **ΕΝΑ projection SSoT** για overlay+hit-test)· `grips/grip-3d-screen-hit-test.ts` (PURE `findGripAtScreen` nearest-wins screen-space, αντικαθιστά τον raycaster)· `stores/Grip3DOverlayStore.ts` (LOW-freq zustand `{grips,elevFor}` + **non-reactive** mutable `grip3DOverlayInteraction {hoverIndex,drag.livePlanPos}` — ADR-040 zero React state, mirror HoverStore· ο RAF το διαβάζει imperatively → μηδέν re-render)· `viewport/grips/BimGripOverlay2D.tsx` (React leaf, mount στο `BimViewport3D`). **Refactor:** ο `BimGripController3D` → **screen-space** (hit-test/hover/`gripAt`/drag-begin μέσω του projector· το drag projection ray∩horizontal-plane **ΜΕΝΕΙ 3D**)· διαβάζει grips+elevFor από το store, γράφει hover/livePlanPos στο interaction. `GripElevationMmFor (grip)=>mm` → **`PlanElevationMmFor (Point2D)=>mm`** (4 resolvers: slab/roof/slab-opening/floor-finish). `refreshReshapeGrips` → store `setGrips`. Αφαιρέθηκαν όλα τα `updateScale` (δεν υπάρχει screen-constant mesh). **Occlusion — DEFER σε νέο session (ΑΝΟΙΧΤΟ, βλ. `HANDOFFS/HANDOFF_2026-06-26_adr535-phase5b-grip-depth-occlusion.md`):** δοκιμάστηκε CPU raycast-per-grip (`grip-3d-occlusion.ts`) σε ΠΟΛΛΕΣ παραλλαγές — όλες ΑΠΕΤΥΧΑΝ browser: full-depth (ΧΩΡΙΣ self-exclude) έκοβε **ΚΑΙ τις μπροστινές** λαβές (root: οι λαβές μάλλον «βυθίζονται» λίγο κάτω από τη rendered επιφάνεια → το raycast τις βλέπει κρυμμένες ακόμα κι από πάνω)· `selfIds` exclude-self έδειχνε λαβές «μέσα από» το σώμα· back-face cull μέσω καθέτου έκρυβε τα πάντα κάτω από τον ισημερινό. **Απόφαση Giorgio (AskUserQuestion): Option B «πλήρες βάθος, μόνο πρώτο πλάνο» — αλλά το CPU raycast είναι λάθος εργαλείο.** Ο σωστός Revit/Maxon-grade τρόπος = **GPU depth-buffer occlusion** (sample scene depth στο grip pixel + bias, ή in-scene billboarded depth-tested handles). **Το raycast occlusion ΑΦΑΙΡΕΘΗΚΕ** (`grip-3d-occlusion.ts` + test διαγράφηκαν) → **λαβές πάντα ορατές (ON TOP)** = καθαρή λειτουργική βάση. Proper occlusion = Φ5b (νέο session, SSoT audit της υπάρχουσας depth/SSAO infra ΠΡΩΤΑ). **ΔΙΑΓΡΑΦΗ:** `grip-mesh-factory-3d.ts`, `bim-grip-overlay-3d.ts` (mesh), `grip-3d-hit-test.ts` (raycaster) + `grip-mesh-factory-3d.test.ts`. **ΑΜΕΤΑΒΛΗΤΑ:** `grip-3d-commit`, `bim3d-grip-preview-builders`, `Grip3DVertexContextMenu`/`footprint-grip-ops` (Φ4), `grip-plane-projection` (drag), `Grip3DContextMenuStore`. **Tests:** ΝΕΑ `grip-3d-screen-project` (3: centre projection με rect-subtract, behind→OFFSCREEN, elevFor consulted)· `grip-3d-screen-hit-test` (4: hit/nearest-wins/miss/empty). **176/176 GREEN** (grips+animation, μηδέν regression). tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full-graph type-check (`import *` smoke σε controller/store/overlay/handlers/hook — μηδέν TS diagnostic· runtime crash μόνο firebase/jsdom). **Browser-verified (Giorgio):** λαβές σωστό μέγεθος/σχήμα = 2D· έμεινε το αίτημα occlusion → υλοποιήθηκε. 🔴 browser-verify occlusion + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ3b (slab-opening) + Φ4 (context-menu κορυφής) ΥΛΟΠΟΙΗΣΗ (UNCOMMITTED).** **(Α) Φ3b — το slab-opening επεξεργάζεται πλέον ανά-κορυφή στην 3D.** Ο πραγματικός blocker (το opening είναι ΚΕΝΟ μέσα στην πλάκα — `slabToMesh` το κόβει με `pushHoles`, δεν έχει δικό mesh → δεν επιλεγόταν) λύθηκε με **ΝΕΟ `slab-opening-pick-mesh.ts`**: αόρατο μα pickable mesh (`MeshBasicMaterial opacity:0`, `depthWrite:false`· ο raycaster αγνοεί μόνο `visible:false`, όχι opacity) που γεμίζει την τρύπα στο host-slab datum (FULL SSoT reuse `buildShape`/`extrudeAndRotate`/`hangDownMeshY`/`applySlabSlope` — coplanar με κεκλιμένη πλάκα), tagged `bimId`+`bimType='slab-opening'` → click επιλέγει το opening (`resolveBimEntityType`→`selectedBimType`→`editBimType='slab-opening'`). Wiring στο `BimSceneLayer.syncSlabs` (ένα pick mesh ανά **visible** opening). **Builder** `buildSlabOpeningReshapePreviewObject` (αδελφός του `buildOpeningHostWallPreview`): `applySlabOpeningGripDrag`→`computeSlabOpeningGeometry`→ξαναχτίζει το **HOST SLAB** με τη μετακινημένη τρύπα μέσω του ΙΔΙΟΥ `slabToMesh` → **ghost === commit**. **Wiring (`bim3d-grip-drag`):** `RESHAPE_BIM_TYPES += 'slab-opening'`· elevation = host slab top (`slabTopZmmAt` SSoT, νέο `slabOpeningGripElevationMmFor`)· `buildGripReshapePreview` += `slabOpeningGripKind` branch· **capture = HOST slab id** (νέο `resolveSlabOpeningHostSlabId`, §2.3 — η τρύπα δεν έχει δικό mesh) ενώ ο snap κρατά το opening id (self-exclude). Commit ήδη type-agnostic από Φ3a (`commitSlabOpeningGripDrag`). Boy-scout: το `slab-opening` case στο `computeDxfEntityGrips` πήρε το dual-shape fallback (mirror `slab`/`opening`) ώστε domain entity από το 3D να μην κρασάρει. **(Β) Φ4 context-menu κορυφής:** δεξί κλικ σε λαβή κορυφής→«Διαγραφή κορυφής», σε λαβή μέσου-πλευράς→«Εισαγωγή κορυφής». **ΠΛΗΡΗΣ SSoT:** ΝΕΟΣ shared builder **`systems/grip/footprint-grip-ops.ts buildFootprintVertexOpCommand`** (αδελφός του `buildPolylineVertexOpCommand`) — ΕΝΑ σπίτι για delete/insert σε ΚΑΙ τις 4 footprint οικογένειες (slab/roof/floor-finish/slab-opening) → σωστό `Update*ParamsCommand`, validated, ένα undo step. **Ο 2D `useGripContextMenuController.onSlabVertexOp` refactor-αρίστηκε να τον καλεί** (αφαιρέθηκε ~40γρ inline slab+roof duplication· boy-scout: το 2D μενού κερδίζει ΚΑΙ floor-finish+slab-opening dispatch). ΝΕΑ `removeVertexFromFloorFinish` + `removeVertexFromSlabOpening` (mirror `removeVertexFromSlab`, guard ≤3). 3D: νέο `gripAt()` (raycast→GripInfo χωρίς drag, reuse `testGrip3DHit`) στον controller· νέος low-freq `Grip3DContextMenuStore` (ADR-040 micro-leaf)· handler `onEditContextMenu` (contextmenu listener, μόνο πάνω σε grip)· ΝΕΟ leaf `Grip3DVertexContextMenu.tsx` (mirror `view-cube-context-menu`, dispatch μέσω `buildFootprintVertexOpCommand`+`createLevelSceneManagerAdapter`+global history· export `toUnifiedGrip`)· mount στο `BimViewport3D`. **i18n keys ΠΡΙΝ τον κώδικα (N.11):** `grips3d.contextMenu.{title,deleteVertex,insertVertex,aria}` el+en. **Tests:** `bim3d-grip-preview-builders` +6 slab-opening (headline «ghost===commit» = host slab rebuild με moved hole)· ΝΕΟ `footprint-grip-ops.test` (15: 4 οικογένειες × delete/add/≤3-guard + null guards)· ΝΕΟ `slab-opening-pick-mesh.test` (4: tags/invisible-pickable/datum/degenerate)· +3 `removeVertexFromSlabOpening` +3 `removeVertexFromFloorFinish`. **188/188 GREEN** (grips+animation suites, μηδέν regression, baseline ήταν 167) + 15+4+43. tsc SKIP (full-project OOM, N.17) — επαληθεύτηκε με ts-jest full type-check όλου του graph (drag/handlers/controller/component/store) + στατική. **Φ4 edit-mode toggle DEFER** (οι grips ήδη εμφανίζονται στο selection). 🔴 browser-verify (επίλεξε τρύπα πλάκας στο 3D → εμφανίζονται grips· σύρε κορυφή→ζωντανό reshape· δεξί κλικ σε κορυφή→διαγραφή/εισαγωγή) + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ3a + Φ4(hide-gizmo) ΥΛΟΠΟΙΗΣΗ — γενίκευση grips σε roof + floor-finish + απόκρυψη gizmo κατά reshape (UNCOMMITTED).** Οι λαβές επεξεργασίας περιγράμματος δουλεύουν πλέον **και σε στέγη + επικάλυψη δαπέδου** (όχι μόνο πλάκα), με live reshape preview + snap + Shift→ortho — όπως η πλάκα. **ΠΛΗΡΗΣ SSoT reuse (μηδέν διπλότυπο, επιβεβαιωμένο με grep audit):** (1) **Φίλτρο** `reshapeGripsForSlab` → **`reshapeGripsForFootprint`** — κρατά ΟΠΟΙΟΔΗΠΟΤΕ footprint discriminator (`slab/roof/floorFinish/slabOpening`), πάντα `!movesEntity`. (2) **`toUnifiedGrip`** (`grip-3d-commit`) προωθεί 1:1 και τα 3 νέα gripKinds → ο **ήδη type-agnostic** `commitDxfGripDragModeAware` δρομολογεί στο σωστό adapter (`commitRoofGripDrag`/`commitFloorFinishGripDrag`). (3) **Live preview builders** σε **ΝΕΟ** `bim3d-grip-preview-builders.ts` (N.7.1 split — ο slab builder μεταφέρθηκε εκεί μαζί με roof+ff· `bim3d-preview-rebuild.ts` 475→~430 γρ.): `buildRoofReshapePreviewObject` = `applyRoofGripDrag`→`computeRoofGeometry`→`roofToMesh`· `buildFloorFinishReshapePreviewObject` = `applyFloorFinishGripDrag`→`floorFinishToMesh` — **ghost === commit** (ίδια SSoT με τα `Update*ParamsCommand`). (4) **`applyGripReshapePreview`** dispatch ανά gripKind. (5) **Per-vertex elevation** ανά τύπο: slab→`slabTopZmmAt` (υπήρχε)· **roof→`roofZmm`** (lower-envelope SSoT· περιφερειακές κορυφές στο `basePivotZ`/γείσο, midpoint σε αετωματική ακμή ανηφορίζει — ίδια height field με `computeRoofGeometry`)· floor-finish→επίπεδο FFL (`box.max.y` ακριβές). (6) **`refreshReshapeGrips`** widened σε `RESHAPE_BIM_TYPES = {slab,roof,floor-finish}`. **Wiring ΗΔΗ type-agnostic** (το pointerdown capture/snap απλώς λεγόταν `slabId` → rename `entityId`· `buildGripReshapeSnapFn`/`captureResize` ήδη type-agnostic). **Φ4 hide-gizmo:** στο grip pointerdown → `ctx.overlay.setVisible(false)` (Revit «Edit Sketch»: το gizmo παραμερίζεται)· pointerup/cancel → `setVisible(true)`. **ΜΟΝΑΔΕΣ (audit-flagged risk):** slab/roof/floor-finish δημιουργούνται όλα σε **mm** (`buildDefaultFloorFinishParams` sceneUnits='mm'· το `?? 'm'` του converter είναι μόνο legacy fallback) → το grip pipeline (raw params units → `dxfPlanToWorld` ως mm) είναι συνεπές, όπως ο slab. **Tests:** `reshapeGripsForFootprint` (+roof/ff/slab-opening cases), `grip-3d-commit` (+roof/ff forward), **ΝΕΟ** `bim3d-grip-preview-builders.test.ts` (roof+ff: headline «ghost===commit», edge-midpoint insert, no-op/unknown/multi-floor null). **167/167 jest GREEN** (grips + animation suites, μηδέν regression). **Φ3b (slab-opening: host-slab rebuild)** + **Φ4 (toggle + context-menu κορυφής)** DEFER. 🔴 browser-verify (επίλεξε στέγη/επικάλυψη στο 3D → σύρε κορυφή/μέσο πλευράς· tilt στέγης → οι λαβές στο γείσο/κορφιά· gizmo κρύβεται κατά το reshape) + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Δημιουργία ADR.** Βαθιά έρευνα κώδικα (2D grips, 3D gizmo, coordinate transforms, commit path, live preview). Status: RESEARCH COMPLETE — εγκεκριμένο για υλοποίηση σε νέα συνεδρία. Καμία αλλαγή κώδικα ακόμη. |
| 2026-06-26 | **Φ1 visual refinement (Giorgio, μετά browser-verify «λαβές εμφανίζονται»).** Οι λαβές από flat billboarded τετράγωνο (`PlaneGeometry`) → **axis-aligned κύβος** (`BoxGeometry`, πραγματικά 3D από κάθε γωνία· αφαιρέθηκε το billboard στο `updateScale`). Περίγραμμα λευκό → **λεπτό μαύρο** (`GRIP_3D_OUTLINE_COLOR=0x000000`· WebGL caps line width=1px άρα ήδη το λεπτότερο — το «χοντρό» ήταν το λευκό χρώμα). 2 αρχεία (`grip-mesh-factory-3d.ts` + `bim-grip-overlay-3d.ts`), 14 jest GREEN. |
| 2026-06-26 | **Φ1 solid-cube self-occlusion (Giorgio: μόνο ορατές ακμές, όχι οι πίσω).** Ο κύβος ήταν «διάφανο wireframe» (`depthTest:false` → όλες οι 12 ακμές, μαζί οι 3 πίσω). FIX: opaque κύβος `depthTest+depthWrite ON` (self-occlusion: οι μπροστινές όψεις κρύβουν τις πίσω ακμές) + `polygonOffset` στη fill (η μαύρη γραμμή κερδίζει το depth test χωρίς z-fight) + outline `depthTest:true`. Ο κύβος **πατάει πάνω** στην επιφάνεια (children lift +½ side, όχι μισοχωμένος). `grip-mesh-factory-3d.ts`, 14 jest GREEN. 🔴 browser-verify. |
| 2026-06-26 | **Φ2 fix — per-vertex υψόμετρο λαβών σε ΚΕΚΛΙΜΕΝΗ πλάκα (Giorgio browser-verify: «έγειρα την πλάκα με το gizmo και οι λαβές πετάνε»).** Το Φ1 τοποθετούσε ΟΛΕΣ τις λαβές σε ΕΝΑ ενιαίο υψόμετρο (`box.max.y`)· σε tilted πλάκα κάθε κορυφή έχει διαφορετικό top-Z (slope plane) → οι λαβές πετούσαν πάνω/μακριά από την επιφάνεια. **FIX (full SSoT):** κάθε λαβή κάθεται στο **δικό της** υψόμετρο μέσω του υπάρχοντος `slabTopZmmAt(params, planPoint)` (ο ΙΔΙΟΣ `slabSlopeOffsetZmm` που καταναλώνει το `applySlabSlope` του converter → grip === rendered surface) + building base. **Αλλαγές:** `createGrip3DMeshes(grips, elevationMmFor)` & `BimGripOverlay3D.setGrips(grips, elevationMmFor)` δέχονται resolver `(grip)=>elevMm` αντί ενιαίου `planeWorldY`· `refreshReshapeGrips` χτίζει `slabGripElevationMmFor` (διαβάζει slab από `Bim3DEntitiesStore` = ίδια πηγή με το mesh· fallback `box.max.y`)· ο controller προβάλλει το drag στο οριζόντιο επίπεδο **της ίδιας της λαβής** (`gripStartWorld.y`, όχι ενιαίο plane)· το slope ξαναϋπολογίζει το z της μετακινημένης κορυφής στο preview/commit. Οπτικά tweaks Φ1 (solid cube/occlusion) αμετάβλητα. 4 `setGrips([],0)`→`setGrips([])`. **21/21 jest GREEN** (+1 per-vertex factory test). 🔴 browser-verify (tilt → drag κορυφής στην κεκλιμένη επιφάνεια) + commit. |
| 2026-06-26 | **Φ2 ΥΛΟΠΟΙΗΣΗ — Live reshape preview + snap + Shift→rectilinear (UNCOMMITTED).** Η πλάκα πλέον αναμορφώνεται **ζωντανά ανά frame** καθώς σέρνεις την κορυφή (όχι μόνο στο release), η κορυφή **κουμπώνει** (μαγνήτης) σε κοντινά χαρακτηριστικά, και **Shift→ορθογώνιος** περιορισμός. **ΠΛΗΡΗΣ SSoT reuse (μηδέν διπλότυπο):** (1) **builder** `buildSlabReshapePreviewObject` colocated στο `bim3d-preview-rebuild.ts` — αδελφός του `rebuildSlab`, **μόνη αλλαγή** το param-transform (`applySlabGripDrag` αντί `computeSlabResizeParams`)· reuse αυτούσια `slabToMesh`/openings-filter/`baseElevationOf`/multi-floor guard → **ghost === commit**. (2) **Live swap** μέσω του υπάρχοντος `Bim3DEditLivePreview.captureResize`(pointerdown)/`applyResize`(per-frame)/`commit`/`reset` — ίδιος μηχανισμός με το gizmo resize. (3) **Snap:** νέο `buildGripReshapeSnapFn` (colocate στο `bim3d-edit-drag-snap.ts`) = reuse `getGlobalSnapEngine`+`makeResizeSnapFn`+`syncSnapEngineViewportFor3D` (3D-derived pixel tolerance· entityId self-exclude)· ο `BimGripController3D.updateDrag` εφαρμόζει το snap στην κορυφή (mirror `BimGizmoDragBridge.applySnap`: world→plan→snap→world στο ίδιο elevation) και ξανα-υπολογίζει το delta από `gripStart→snapped`. (4) **Shift→rectilinear:** το preview builder διαβάζει την **ΙΔΙΑ** πηγή Shift με το commit (`ShiftKeyTracker.getSnapshot()` που ήδη διαβάζει το `commitSlabGripDrag`) → preview === commit ακόμα και με τον ortho modifier. **Wiring (`bim3d-edit-interaction-handlers.ts`):** grip pointerdown→`captureResize`+inject snapFn· pointermove→`applyGripReshapePreview` (per-frame mesh rebuild)· pointerup→`commit()`/`reset()` βάσει committed· cancel→`reset()`. **N.7.1 split:** το handlers ξεπερνούσε τις 500 γρ. → εξήχθη όλη η reshape-grip λογική (`refreshReshapeGrips`+`applyGripReshapePreview`+`commitGripReshape`) σε νέο colocated **`bim3d-grip-drag.ts`** (type-only `EditInteractionCtx` import → μηδέν runtime cycle)· handlers 508→438 γρ. **Tests:** νέο `__tests__/bim3d-grip-preview-rebuild.test.ts` (6 tests, headline = «preview === commit»: geometry του builder ταυτίζεται byte-for-byte με `applySlabGripDrag`+`slabToMesh`· + vertex enlarge / edge-midpoint insert / no-op / unknown-id / multi-floor null). **20/20 jest GREEN** (14 Φ1 + 6 Φ2). 🔴 browser-verify + commit (stage ADR-040+535, CHECK 6B/6D). |
| 2026-06-26 | **Φ1 ΥΛΟΠΟΙΗΣΗ (COMMITTED).** 7 thin αρχεία σε `bim-3d/grips/`: `grip-plane-projection.ts` (ray∩horizontal-plane→plan-mm, PURE), `grip-3d-reshape-grips.ts` (φίλτρο slab reshape grips, PURE), `grip-3d-hit-test.ts` (raycaster→nearest gripIndex), `grip-mesh-factory-3d.ts` (GripInfo[]→camera-facing squares+hitboxes via `dxfPlanToWorld` SSoT), `bim-grip-overlay-3d.ts` (scene leaf: screen-constant scale reuse `snapMarkerScreenScale`, hover, show/hide — zero store/React per ADR-040), `bim-grip-controller-3d.ts` (FSM hover→drag→idle, 1:1 cursor follow), `grip-3d-commit.ts` (→`commitDxfGripDragModeAware`→`commitSlabGripDrag`). **Wiring:** `use-bim3d-edit-interaction.ts` (mount overlay+controller, `refreshReshapeGrips` σε selection/resync, dispose) + `bim3d-edit-interaction-handlers.ts` (grip-first hit-test στο pointerdown, grip path σε move/up/cancel/wheel, `refreshReshapeGrips` export). **Risk #1 (§6.1) ΛΥΘΗΚΕ:** `buildDeps.execute` είναι no-op (gizmo path τρέχει `getGlobalCommandHistory().execute` μόνο του) → override `execute` με real history dispatcher στο `grip-3d-commit`. **Risk #5:** `UnifiedGripInfo` map 1:1 (`type` 'midpoint'→'edge'). **Διπλό-emit απεφεύχθη:** `commitSlabGripDrag` ήδη κάνει `emitBimEntityParamsUpdated('slab')` → ΔΕΝ καλείται `emitStructuralChangeAfterEdit`. Gizmo+grips συνυπάρχουν (grip-first priority). Pilot=slab. 14 jest GREEN (4 suites). 🔴 browser-verify + tsc + commit (stage ADR-040+535, CHECK 6B/6D). Φ2 (live preview+snap) / Φ3 (roof/floor-finish/slab-opening) / Φ4 (edit-mode UX) DEFER. |
| 2026-06-26 | **Perf — κρύψιμο λαβών κατά την κίνηση κάμερας (Giorgio browser-verify: «πιο γρήγορο που κρύβονται οι λαβές»).** ΕΥΡΗΜΑ: ο grip occluder (`grip-3d-depth-occluder.ts`) κάνει **full-scene depth pre-pass + `scene.traverse` ΚΑΘΕ frame** — το cache του ακυρώνεται σε **κάθε αλλαγή κάμερας** (γρ.138) → στο orbit/zoom **ξανατρέχει κάθε frame** = ένα ολόκληρο επιπλέον render της σκηνής/frame· ήταν ο **κύριος** lag στην πλοήγηση-με-επιλογή (επιβεβαιωμένο: χωρίς επιλογή smooth, με επιλογή βαρύ). **FIX (Β3, big-player CAD/BIM pattern «hide handles during navigation»):** στο `BimGripOverlay2D.tsx` ένας guard στο `draw()` ανιχνεύει κίνηση κάμερας (compare `camera.matrixWorld`+`projectionMatrix` με προηγ. frame, refs `lastCamWorldRef`/`lastCamProjRef`/`camPoseValidRef`) και **παραλείπει όλο το draw** (occluder `computeVisibility` + 2D grip draws) όσο κινείται → οι λαβές εξαφανίζονται στην κίνηση, **επανεμφανίζονται με σωστή απόκρυψη** στο settle (το continuous RAF του overlay εγγυάται settle frame, ~16ms). Η απόκρυψη σε ηρεμία **αμετάβλητη**. Giorgio approved «εξαφάνιση στην κίνηση» (δεν πειράζει λαβές όσο κινείται). 36/36 grip jest GREEN, +`import * as THREE`. UNCOMMITTED — commit=Giorgio (CHECK 6B/6D → stage ADR-535). (σχετικό: ADR-536 perf, ADR-452 section tiering.) |
