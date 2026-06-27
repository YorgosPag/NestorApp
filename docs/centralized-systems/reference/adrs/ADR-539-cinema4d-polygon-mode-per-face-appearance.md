# ADR-539 — Cinema 4D «Polygon Mode»: Per-Face Appearance (χρώμα/υλικό ανά όψη) σε δομικά solids

**Status:** 🟢 Φ1 (MVP, slab) COMMITTED · Φ1.5 (foundation) + Φ2 (drag-drop/holes/custom-color/hover) IMPLEMENTED UNCOMMITTED 2026-06-27 · **Date:** 2026-06-27
**Type:** Feature (DXF/BIM Viewer — 3D appearance). Cinema 4D Maxon-grade per-polygon material.
**Builds on:** ADR-534 (soffit finish — per-face πρότυπο) · ADR-416 (multi-layer slab solid) · ADR-417 (parametric roof prism) · ADR-511 (wall-covering material catalog) · ADR-040 (3D/canvas perf)
**Related:** ADR-535/536/537/538 (3D viewport selection/grips/hover) · ADR-375 (per-element style override) · ADR-413 (PBR materials)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στη σελίδα `/dxf/viewer`, στον **3D κάμβα**, ο μηχανικός θέλει να εφαρμόζει διαφορετικό
**χρώμα ή υλικό** σε **μεμονωμένη όψη (face)** ενός δομικού στοιχείου. Παράδειγμα: μια
πλάκα οροφής έχει **πάνω όψη**, **κάτω όψη** και **πολλές περιμετρικές πλευρές**, και θέλει
να βάφει/ντύνει την καθεμία **ξεχωριστά**.

Το ζητούμενο UX είναι **ακριβώς όπως η Cinema 4D Maxon** (επιβεβαιωμένο με screenshot, R15):
1. Επιλέγω το αντικείμενο (π.χ. πλάκα οροφής).
2. Πατάω πλήκτρο **«Polygon»** (mode toggle) → ενεργοποιούνται όλες οι όψεις.
3. Κάνω κλικ σε **μία όψη** → επιλέγεται (highlight).
4. Από μια **βιβλιοθήκη** σέρνω (drag) ένα «ύφος» (χρώμα ή υλικό) πάνω στην όψη → η όψη
   παίρνει τις ιδιότητες του υλικού.

**Αποφάσεις Giorgio (AskUserQuestion 2026-06-27):**
- **Λεπτομέρεια όψης:** κάθε όψη ξεχωριστά (Πάνω / Κάτω / **κάθε** περιμετρική πλευρά).
- **Τι εφαρμόζεται:** ΚΑΙ σκέτο χρώμα ΚΑΙ υλικό από κατάλογο.
- **Τρόπος (UX):** Cinema 4D «Polygon mode» + drag-drop από βιβλιοθήκη.
- **Εύρος:** **όλα** τα δομικά solids (slab, roof, wall, column, beam, foundation).

## 2. Ευρήματα έρευνας (SSoT audit — τι ΥΠΑΡΧΕΙ ήδη)

| Ευρημα | Αρχείο / σημείο | Σημασία |
|--------|-----------------|---------|
| **Per-face πρότυπο υπάρχει ήδη** | `attachSoffitFinish` (`bim-3d/converters/bim-three-slab-converter.ts:75`, ADR-534) | Βάφει κάτω παρειά ceiling με ξεχωριστό thin mesh + χρώμα από `wall-covering-material-catalog`. Per-face σε μικρογραφία → πρότυπο. |
| **Slab geometry = ΕΝΑ material** | `slabToMesh` (ExtrudeGeometry, κανένα `addGroup`) | Πρέπει να προστεθεί per-face group path. |
| **Roof = ρητό index building** | `buildPrismIndex` (`roof-to-three.ts:105`) | bottom cap + top cap + perimeter side quads, `for i: j=(i+1)%n`. **Ντετερμινιστικό side ordering** → θεμέλιο face-key SSoT. |
| **Raycaster αγνοεί face** | `raycastBimGroup` (`systems/raycaster/BimEntityRaycaster.ts:51`) | Επιστρέφει μόνο `{bimId, bimType}`· το `intersection.face.materialIndex` (διαθέσιμο από THREE) **αγνοείται**. |
| **Highlight per-object** | `BimSelectionHighlighter` + `SelectionOutlinePass` | Silhouette ανά bimId, ΟΧΙ per-face → χρειάζεται face overlay. |
| **3D context-menu pattern** | `Grip3DContextMenuStore` + `Grip3DVertexContextMenu.tsx` | Πρότυπο micro-store + Radix menu. |
| **Material catalogs** | `wall-covering-material-catalog.ts`, `MaterialLibraryService.ts` (`bim_materials`), `material-catalog-defs.ts`, `MaterialCatalog3D.ts` | Πηγές χρώματος/υλικού — reuse. |
| **Color picker** | `ui/color/EnterpriseColorDialog.tsx` | Custom color (hex/rgb/hsl). |
| **Base έχει ήδη top-level override** | `BimEntity.styleOverride?` (`bim/types/bim-base.ts:145`) | Ίδιο επίπεδο με το νέο `faceAppearance?`. |

## 3. Απόφαση (Google-level, SSoT, μηδέν διπλότυπα)

### 3.1 Face-key SSoT (ντετερμινιστικό, κοινό για όλα τα solids)
```ts
type FaceKey =
  | 'top' | 'bottom'
  | `side:${number}`            // ακμή i του canonical outline (i = buildPrismIndex order)
  | `sub:${number}:${string}`;  // per-«νερό» roof (sub-solid prefix)
```
Το `side:i` αντιστοιχεί στο ίδιο ντετερμινιστικό edge ordering του `buildPrismIndex`.

### 3.2 Shared per-face appearance model στο `BimEntity` base (ΟΧΙ ανά params)
Cosmetic override (Revit «Paint on face»), δεν συμμετέχει στο geometry derivation → ζει στο
base δίπλα στο `styleOverride`. Μηδέν διπλότυπα ανά kind.
```ts
// bim/types/face-appearance-types.ts (νέο)
interface FaceAppearance { readonly materialId?: string; readonly colorHex?: string; }
type FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>;
// bim/types/bim-base.ts → BimEntity:
readonly faceAppearance?: FaceAppearanceMap;
```

### 3.3 Geometry per-face = `BufferGeometry.addGroup()` + `material[]` (ΟΧΙ ξεχωριστά meshes)
Νέος shared helper `bim-3d/converters/bim-three-faced-prism.ts` (γενίκευση `buildPrismIndex`):
επιστρέφει `{ geometry (με groups), faceKeyByMaterialIndex: FaceKey[] }`. materialIndex
`0=bottom, 1=top, 2+i=side:i`. Αποθηκεύεται στο `mesh.userData.faceKeyByMaterialIndex`.
**Trade-off (slab-openings/holes):** το ρητό path δεν έχει holes → MVP χωρίς openings·
`triangulateShape(contour, holes)` στη Φ2. Ένα mesh, 1 draw call, trivial raycast.

### 3.4 Raycasting face-level
Νέα `raycastBimFace` **δίπλα** στην `raycastBimGroup` (zero regression): διαβάζει
`hit.face.materialIndex` → lookup στο `faceKeyByMaterialIndex`. `RaycastHit` + `faceKey?`.
Ενεργό **μόνο** σε Polygon mode (`use-bim3d-pointer-handlers.ts` branch).

### 3.5 Highlight όψης
Νέος `FaceSelectionHighlighter` — overlay sub-mesh από το index range του group (translucent
emissive + polygon offset, αποφυγή z-fight). Το OutlinePass είναι per-object → δεν κάνει για face.

### 3.6 UX
- `PolygonMode3DStore` (micro-store, mirror `Grip3DContextMenuStore`): `active`, `selectedFace`.
- Toggle κουμπί «Polygon» στο 3D toolbar (ενεργό μόνο με επιλεγμένο solid).
- `PolygonMaterialPanel.tsx` = βιβλιοθήκη swatches (reuse `listWallCoveringMaterials` +
  `MaterialLibraryService` + «Custom color»→`EnterpriseColorDialog`).
- **Drag-drop = HTML5** (`dataTransfer: application/x-bim-material`): drag ξεκινά εκτός
  canvas → δεν συγκρούεται με OrbitControls. Canvas root `onDragOver`+`onDrop` →
  `raycastBimFace(x,y)` → apply. **MVP fallback = click-to-apply** (κλικ face → κλικ swatch).

### 3.7 Apply + persist
Νέο **generic** `SetFaceAppearanceCommand` (extends `MergeableUpdateCommand`) — 1 command για
6 kinds (το `faceAppearance` είναι base field, δεν αλλάζει geometry). Persistence αυτόματη
μέσω των debounced `use<Kind>Persistence` (έλεγχος ότι ο serializer δεν whitelist-άρει πεδία).
Re-render: ο converter διαβάζει `entity.faceAppearance` → group path· absent → legacy
single-material (byte-for-byte, zero regression για τα ~30 slab tests).

## 4. Φασικό roadmap

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1 (MVP)** | **slab** · click-to-apply · `face-appearance-types` · `faceAppearance?` base · `buildFacedPrism` (χωρίς holes) · `slabToMesh` group path · `raycastBimFace` · `PolygonMode3DStore`+toggle · `FaceSelectionHighlighter` · `SetFaceAppearanceCommand`+persist · `PolygonMaterialPanel` | 🟢 COMMITTED (slab) |
| **Φ1.5** | **foundation** (πέδιλα/θεμέλια) · converter faced branch + persistence wiring · `buildFacedSolidBody` shared SSoT (Boy-Scout extraction· slab+foundation delegate) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ2** | HTML5 drag-drop · holes (slab-openings) · `EnterpriseColorDialog` custom color · face hover | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3a** | **column** (κατακόρυφο prism· converter faced branch + 8-point persistence round-trip + gate) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3b** | **roof** (per-«νερό» `sub:${i}:top`· κάθε face mesh pickable+paintable· reuse `resolveFaceMaterial` + persistence + gate) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3e** | **2D plan fill** — η βαμμένη `faceAppearance['top']` γίνεται χρώμα γεμίσματος στην κάτοψη (slab/foundation/column· SSoT `topFacePlanFill`) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3f** | **face context-menu** — δεξί-κλικ σε όψη (Polygon Mode) → καθαρισμός / αντιγραφή / επικόλληση εμφάνισης (mirror `Grip3DVertexContextMenu`) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3c** | **wall** (απλός flat path: single-layer straight· κλειστό footprint ring `buildWallFootprintRing` → `buildFacedSolidBody`· 6-point persistence + gate· MVP: πολυστρωματικοί/με κουφώματα = legacy) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3 (υπόλοιπο)** | beam (Φ3d) — Plan Mode πρώτα (οριζόντιο prism· γενίκευση axis) | ⬜ PLANNED |
| **Φ4** | multi-face select (Shift) · copy/paste appearance · `bmat_*` drag · per-face PBR textures | ⬜ PLANNED |

## 5. Συνέπειες

- **Θετικά:** ένα SSoT (`FaceAppearanceMap` + `buildFacedPrism` + `SetFaceAppearanceCommand`)
  καλύπτει και τα 6 solids· reuse soffitFinish/roof-prism/material-catalog/EnterpriseColorDialog·
  μηδέν διπλότυπα· legacy render αναλλοίωτο όταν `faceAppearance` absent.
- **Trade-offs:** (α) holes/openings αναβάλλονται στη Φ2· (β) base type touch (optional →
  ασφαλές)· (γ) εγκατάλειψη ExtrudeGeometry υπέρ ρητού index για όσα solids μπαίνουν σε
  polygon mode (reuse roof pattern).
- **Architecture guards:** αγγίζει canvas/3D αρχεία → ADR-040 **CHECK 6B/6D** απαιτεί stage
  ADR-040 + ADR-539. N.7.1 (αρχεία <500γρ, functions <40), N.11 (i18n labels), N.2 (zero `any`).

## 6. Critical files

**Νέα:** `bim/types/face-appearance-types.ts` · `bim-3d/converters/bim-three-faced-prism.ts` ·
`bim-3d/materials/face-appearance-material.ts` · `bim-3d/stores/PolygonMode3DStore.ts` ·
`bim-3d/systems/selection/FaceSelectionHighlighter.ts` · `bim-3d/ui/PolygonMaterialPanel.tsx` ·
`core/commands/entity-commands/SetFaceAppearanceCommand.ts`.

**Τροποποίηση:** `bim/types/bim-base.ts` · `bim-3d/converters/bim-three-slab-converter.ts` ·
`bim-3d/systems/raycaster/BimEntityRaycaster.ts` · `bim-3d/scene/ThreeJsSceneManager.ts` ·
`bim-3d/viewport/use-bim3d-pointer-handlers.ts` · `bim-3d/viewport/BimViewport3D.tsx` ·
slab persistence serialize path (αν whitelist).

## 7. Changelog

- **2026-06-27 (Φ3f FIX — right-click pre-empted by 2D entity menu, browser-found)** — Σε Polygon
  Mode το δεξί-κλικ σε όψη έβγαζε το **γενικό** `EntityContextMenu` (Join/Χωρισμός/Απομόνωση/Delete),
  ΟΧΙ το per-face menu. **Root cause:** ο 2D handler `useCanvasContextMenu.handleNativeContextMenu`
  είναι **capture-phase** native listener σε ancestor του `BimViewport3D` canvas → τρέχει ΠΡΙΝ τον
  bubble-phase 3D React `onContextMenu` και, με tool='select' + επιλεγμένο entity, άνοιγε το entity
  menu + `stopPropagation` (ο 3D handler δεν έτρεχε ποτέ). **Fix:** guard στην κορυφή του handler —
  `if (usePolygonMode3DStore.getState().active) return;` (early-return ΧΩΡΙΣ preventDefault/
  stopPropagation → το event πέφτει στον 3D face handler). Event-time getter read (ADR-040 compliant).
  Ο 3D τοίχος/κολώνα/πλάκα κ.λπ. πλέον δείχνουν σωστά το μενού όψης· εκτός Polygon Mode το entity
  menu λειτουργεί ως πριν. ⚠️ `useCanvasContextMenu.ts` = ADR-040 αρχείο → stage ADR (το ADR-539 αρκεί
  για CHECK 6D).

- **2026-06-27 (Φ3c — WALL, IMPLEMENTED UNCOMMITTED)** — Επέκταση του per-face appearance στον
  **τοίχο** (κατακόρυφο prism· solid-agnostic core, μηδέν νέα γεωμετρία). MVP scope: ΜΟΝΟ ο απλός
  flat path (single-layer straight, χωρίς ανοίγματα/profile)· πολυστρωματικοί/με κουφώματα τοίχοι
  ακολουθούν τα group paths → legacy render (όπως multilayer slab/attached column):
  - **Footprint ring SSoT (Boy-Scout N.0.2):** `bim-three-shape-helpers.ts` νέος pure
    `buildWallFootprintRing(outer, inner)` (outer forward + inner backward) — ΕΝΑ source ΚΑΙ για το
    `THREE.Shape` cross-section (legacy solid) ΚΑΙ για το faced prism ring. Ο `buildWallShape`
    έγινε delegate (μηδέν behavior change· ίδια traversal). Έτσι τα `side:i` indices του faced
    τοίχου ταυτίζονται με το legacy solid.
  - **Converter:** `BimToThreeConverter.ts` νέος helper `buildWallCoreBody` (mirror
    `buildColumnCoreBody`) — faced branch (`facedByAppearance || facedByPolygonTarget`) →
    `buildFacedSolidBody(ring, heightM, fa, material)`, αλλιώς legacy `buildWallShape` +
    `extrudeAndRotate` + `ensureWorldUvs`. Το faced prism έχει IDENTICAL local span `[0, height·
    MM_TO_M]` με το legacy → η `position.y` (base datum ADR-402) μένει αναλλοίωτη. Το tilt
    (ADR-404 `applyWallTilt`) εφαρμόζεται και στα δύο geometries (ίδιο local Y span → ίδιο shear).
    Ο simple-path return (`applyStructuralCoreVisibility3D`) μένει αμετάβλητος.
  - **Persistence (6 σημεία, mirror column Φ3a):** `WallDoc` / `WallSaveInput` / `WallUpdateInput`
    += `faceAppearance?` · `saveWall` + `updateWall` Firestore-safe writes · `entityToSaveInput`
    (`wall-firestore-service.ts`) + `docToEntity` round-trip + `wallUpdatePatch`
    (`wall-persistence-helpers.ts`) += `faceAppearance` (κρίσιμο: ο wall persist χρησιμοποιεί
    `updateDoc` για re-edits → χωρίς αυτό η βαφή χανόταν σε reload· ο paint persist περνά από
    `bim:entities-attached` → `useBimEntityMovedPersistEffect` → `wallUpdatePatch`). Το `WallEntity`
    κληρονομεί ήδη `faceAppearance` από το base `BimEntity` (`bim-base.ts`) → μηδέν type change.
  - **Gate:** `POLYGON_FACED_KINDS += 'wall'` στο `PolygonModeToggle3D.tsx`. `SetFaceAppearanceCommand`
    + `raycastBimFace` είναι kind-agnostic → καμία αλλαγή. Μηδέν νέα i18n keys.
  - **Tests:** `wall-faced-3d.test.ts` (5 — multi-material όταν painted, identical datum vs legacy,
    legacy σε empty map, faced σε polygon-target, legacy σε άλλο target) GREEN + regression
    `wall-opening-coordinator` (9) = 0 break. **CHECK 6B/6D δεν πιάνουν** αυτά τα paths
    (`bim-3d/converters/`, `bim/walls/`, `hooks/data/`)· το ADR-539 staged ούτως ή άλλως.

- **2026-06-27 (Φ3f — FACE CONTEXT-MENU, IMPLEMENTED UNCOMMITTED)** — Δεξί-κλικ σε όψη (σε Polygon
  Mode) → menu εμφάνισης όψης (Revit «Paint on face» right-click). Mirror του `Grip3DVertexContextMenu`:
  - **Store** `bim-3d/stores/FaceContextMenuStore.ts` (mirror `Grip3DContextMenuStore`): open/screen/
    target {bimId, faceKey} + **clipboard** (copy/paste appearance, επιβιώνει του open/close).
  - **Leaf** `bim-3d/viewport/grips/FaceContextMenu.tsx`: 1×1 anchor + Radix dropdown με 3 ενέργειες
    μέσω του SHARED SSoT `applyFaceAppearance` (undoable, scene re-sync): «Καθαρισμός όψης» (value=null),
    «Αντιγραφή εμφάνισης» (clipboard = live face appearance από το scene), «Επικόλληση εμφάνισης»
    (apply clipboard· disabled όταν άδειο).
  - **Handler:** `use-bim3d-pointer-handlers.ts` νέο `handleContextMenu` — σε Polygon Mode raycast face
    → select + `show()` στο menu (preventDefault → όχι native menu)· miss → hide. Wired στο
    `BimViewport3D` `onContextMenu` + mount `<FaceContextMenu/>`. **N.7.1:** το `BimViewport3D` ξεπέρασε
    τις 500γρ με τα νέα mounts → συμπίεση verbose JSX comments → **500γρ** (εντός ορίου).
  - **i18n:** `polygonMode.contextMenu.{title,clear,copy,paste,aria}` σε el+en (N.11· keys-first).
  - **Tests:** `FaceContextMenuStore.test.ts` (3 — show anchor, hide κρατά clipboard, setClipboard
    set/clear) GREEN.

- **2026-06-27 (Φ3e — 2D PLAN TOP-FACE FILL, IMPLEMENTED UNCOMMITTED)** — Στην κάτοψη το solid
  φαίνεται από πάνω → η βαμμένη ΑΝΩ όψη (`faceAppearance['top']`) γίνεται το χρώμα γεμίσματος του
  σώματος (Revit «Paint on face» seen in plan):
  - **SSoT color extraction (Boy-Scout N.0.2):** το ιδιωτικό `faceColorHex` του 3D material resolver
    εξήχθη σε `bim/utils/face-appearance-color.ts` (`faceAppearanceColorHex` — colorHex wins, αλλιώς
    catalog `getWallCoveringColor`)· ΚΑΙ ο 3D resolver ΚΑΙ το 2D fill το καλούν (μηδέν διπλότυπο).
  - **Νέο SSoT** `bim/utils/bim-face-plan-fill.ts` `topFacePlanFill(entity, bgHex?)` → translucent
    poché (`hexToRgba` alpha 0.55) + `adaptFillTintForCanvas` (ΙΔΙΟ background-adaptive layer με το
    `resolveBimBodyFill`), ή `null` χωρίς `top` paint.
  - **Wiring:** `SlabRenderer` / `ColumnRenderer` / `FoundationRenderer` → `topFacePlanFill(e) ??
    <legacy body fill>` (ένα injection point ο καθένας). Το roof (per-«νερό» `sub:i:top`, χωρίς
    ενιαίο `top`) ΔΕΝ καλύπτεται — out of scope (multi-νερό κάτοψη = future).
  - **CHECK 6D:** οι 2D renderers ζουν στο `bim/renderers/` (ΟΧΙ `rendering/entities/`) → δεν πιάνει·
    το ADR-539 staged ούτως ή άλλως.
  - **Tests:** `bim-face-plan-fill.test.ts` (9 — color SSoT priority, null χωρίς top, rgba fill,
    distinct colors) + regression Slab/Column hatch + envelope + foundation-to-three (refactored
    color) = 0 break (57 GREEN).

- **2026-06-27 (Φ3b — ROOF, IMPLEMENTED UNCOMMITTED)** — Per-«νερό» appearance στη **στέγη**. Το roof
  ΔΕΝ χρησιμοποιεί `buildFacedSolidBody` (έχει sloped sub-solids ανά νερό· κρατά το proven
  `buildPrismIndex` + DNA/relief/tile pipeline) — αντί:
  - **Converter** `roof-to-three.ts`: `RoofFaceMeshContext += faced + faceAppearance`· `roofToMesh`
    υπολογίζει `faced = hasAppearance || isPolygonTarget`· ο per-face loop έγινε **indexed**
    (`faces.forEach((face, i) => …)`)· extract `buildFaceMeshes` (collect τα 1..n meshes ενός νερού)
    + νέος `applyRoofFacePaint(meshes, i, ctx)`: σε faced roof κάθε mesh του νερού i παίρνει
    `userData.faceKeyByMaterialIndex = ['sub:${i}:top']` (single-material → materialIndex 0 → ο
    `raycastBimFace` το επιλύει) και, αν `faceAppearance['sub:${i}:top']` υπάρχει, το flat painted
    material (reuse `resolveFaceMaterial` SSoT) αντικαθιστά το legacy κεραμίδι/DNA look. Μη-faced
    roof = byte-for-byte legacy (κανένα faceKey στα meshes). Ridge caps/eaves μένουν legacy (trim).
  - **Persistence (8 σημεία, mirror column/foundation):** `RoofDoc` / `RoofSaveInput` /
    `RoofUpdateInput` += `faceAppearance?` · `saveRoof` + `updateRoof` Firestore-safe writes ·
    `entityToSaveInput` + `docToEntity` round-trip · `useRoofPersistence` `updateRoof` patch +=
    `faceAppearance` (το roof persist χρησιμοποιεί `updateDoc` για re-edits· params-only diff-merge
    δεν κλομπάρει τη βαφή). **Gate:** `POLYGON_FACED_KINDS += 'roof'`.
  - **Tests:** `roof-faced-3d.test.ts` (4 — legacy μη-tagged, polygon-target distinct `sub:i:top`
    keys, paint sub:0 flat override, άλλα νερά αβαφή) GREEN + regression roof-ridge-cap = 0 break.
    tsc SKIP (άλλος agent tsc, N.17)· verified via ts-jest.

- **2026-06-27 (Φ3a — COLUMN, IMPLEMENTED UNCOMMITTED)** — Επέκταση του per-face appearance στην
  **κολώνα** (κατακόρυφο prism· solid-agnostic core, μηδέν νέα γεωμετρία):
  - **Converter:** `bim-three-structural-converters.ts` νέος helper `buildColumnCoreBody` — faced
    branch (`facedByAppearance || facedByPolygonTarget`) → `buildFacedSolidBody(verts, heightM,
    fa, getElementMaterial3D('column'))`, αλλιώς legacy `extrudeAndRotate`. Το faced prism έχει
    IDENTICAL local span `[0, effectiveHeightMm·MM_TO_M]` με το legacy → η `position.y` (base datum
    ADR-402/488) μένει αναλλοίωτη. Το tilt (ADR-404 `applyColumnTilt`) εφαρμόζεται και στα δύο
    geometries (ίδιο local Y span → ίδιο shear). Ο σοβάς/οπλισμός (`composeColumnWithFinish` /
    `attachColumnRebar`) wrap-άρουν αμετάβλητα — additive siblings, ανεξάρτητα του core body.
    Ο attached-prism path (top/baseProfile) μένει legacy (MVP — όπως multilayer slab).
  - **Persistence (8 σημεία, mirror foundation Φ1.5):** `ColumnDoc` / `ColumnSaveInput` /
    `ColumnUpdateInput` += `faceAppearance?` · `saveColumn` + `updateColumn` Firestore-safe writes ·
    `entityToSaveInput` + `columnDocToEntity` round-trip · `useColumnPersistence.persistOnce`
    `updateColumn` patch += `faceAppearance` (κρίσιμο: ο column persist χρησιμοποιεί `updateDoc` για
    re-edits → χωρίς αυτό η βαφή χανόταν σε reload).
  - **Gate:** `POLYGON_FACED_KINDS = {'slab','foundation','column'}` στο `PolygonModeToggle3D.tsx`.
  - **Tests:** `column-faced-3d.test.ts` (5 — faced render/material-array, IDENTICAL datum, empty-map
    legacy, polygon-target chicken-and-egg, different-target legacy) GREEN· regression
    column-base-continuity / structural-finish / storey-ceiling / units / SetFaceAppearance = 0 break
    (47 GREEN). tsc SKIP — άλλος agent έτρεχε tsc (N.17)· verified via ts-jest type-check.

- **2026-06-27 (Φ2 — DRAG-DROP / HOLES / CUSTOM COLOR / FACE HOVER, IMPLEMENTED UNCOMMITTED)** — Η Cinema 4D
  υπογραφή. Τέσσερα increments, FULL SSoT reuse:
  - **(α) HTML5 drag-drop υλικού πάνω σε όψη** (Giorgio το ζήτησε ρητά): νέο SSoT
    `bim-3d/ui/polygon-material-dnd.ts` (MIME `application/x-bim-material` + serialize/parse
    `FaceAppearance`). Τα swatches του `PolygonMaterialPanel` έγιναν `draggable` (drag χωρίς προ-επιλογή
    όψης). Drop target = νέο hook `bim-3d/viewport/use-polygon-drag-drop.ts` (`onDragOver`/`onDrop` →
    `raycastBimFace` → apply· live yellow face-highlight στο dragover «κουμπώνει στην όψη»). Wiring 3
    γραμμές στο `BimViewport3D` root div (κρατά <500). Το drag ξεκινά ΕΚΤΟΣ canvas → καμία σύγκρουση
    OrbitControls. **Click-to-apply διατηρείται** ως fallback.
  - **(β) Holes / slab-openings στο faced path:** `buildFacedPrism(topRing, depthM, holes?)` —
    `THREE.ShapeUtils.triangulateShape(contour, holes)` (cap cut-outs) + hole-wall side faces με νέο
    FaceKey variant `hole:${h}:${k}` (SSoT union). Winding: τα holes normalize-άρονται στο ΑΝΤΙΘΕΤΟ
    του contour (`ShapeUtils.isClockWise`) → ίδιο wall-formula με τα outer δίνει normals ΜΕΣΑ στο κενό
    (ExtrudeGeometry pattern). `buildFacedSolidBody` + `buildFacedSlabBody` παίρνουν `holes?`· ο slab
    converter περνά τα ΗΔΗ-διαθέσιμα `openings` ως `Vector2(x, −y)` (ίδιο cap-plane transform).
  - **(γ) Custom color** μέσω `EnterpriseColorDialog`: κουμπί «Προσαρμοσμένο χρώμα» στο panel →
    dialog → `onChangeEnd` → `apply({ colorHex })`. i18n `polygonMode.customColor`/`customColorTitle`
    (el+en ΠΡΩΤΑ, N.11).
  - **(δ) Face hover preview:** 2ος `FaceSelectionHighlighter` instance (κίτρινος `0xffd400`,
    constructor color/opacity params) ως `ThreeJsSceneManager.faceHoverHighlighter` + `setHoveredFace`.
    Στο `pickHover` (use-bim3d-pointer-handlers), σε Polygon Mode, highlight την όψη κάτω από τον κέρσορα
    (mirror ADR-538). Καθαρισμός σε mouse-leave.
  - **SSoT apply:** νέο `bim-3d/ui/apply-face-appearance.ts` — ΕΝΑ wiring (`createLevelSceneManagerAdapter`
    + `getGlobalCommandHistory` + `SetFaceAppearanceCommand`), κοινό για click / custom-color / drag-drop
    (το παλιό inline του panel αφαιρέθηκε).
  - **Tests:** `bim-three-faced-prism.test.ts` (+4 holes), `polygon-material-dnd.test.ts` (6, νέο) →
    GREEN· regression slab-slope/multilayer/units + SetFaceAppearanceCommand + Φ1.5 = 0 break.
  - **N.7.1:** `ThreeJsSceneManager.ts` ανέβηκε στο όριο → συμπιέστηκε σε **499** γρ· `BimViewport3D.tsx`
    **498**. Νέα αρχεία όλα <135γρ.
  - **FIX 1 (browser-report Giorgio): κλικ στην ΠΑΝΩ όψη έβαφε την ΚΑΤΩ.** Root (diagnostic test): τα
    cap normals ήταν **αντεστραμμένα** — η `top` όψη (cap στο `y=thicknessM`, ορατή προς ουρανό) είχε normal
    προς τα **κάτω** → με FrontSide ήταν back-face-culled όταν κλικ από πάνω → η ακτίνα «έπεφτε» στο κάτω cap
    → επιστρεφόταν `bottom`. **Λύση:** flip του cap winding στο `buildFacedIndex` (bottom `a→b→c` = −Y,
    top `a→c→b` = +Y) + μόνιμο regression test (avg normal.y top>0.5, bottom<−0.5).
  - **FIX 2 (browser-report Giorgio): η τρύπα δεν επιλεγόταν/βαφόταν.** Root: πάνω από κάθε opening υπάρχει
    ένα **αόρατο pick-mesh** (`bimType='slab-opening'`, ADR-535) που «έκλεβε» το κλικ — ο `raycastBimFace`
    επέστρεφε το πρώτο hit (το pick-mesh, χωρίς `faceKey`) → ο handler καθάριζε την επιλογή. **Λύση:** ο
    `raycastBimFace` πλέον επιστρέφει το **πρώτο hit με `faceKey`** (faced face wins)· non-faced hits = fallback
    μόνο αν κανένα faced. Έτσι το τοίχωμα της τρύπας κερδίζει το αόρατο opening mesh.
  - **FIX 3 (defense-in-depth): hole-wall culling.** Τα faced υλικά έγιναν **`DoubleSide`**
    (`ensureDoubleSided(baseMat)` — ΕΝΑ shared body clone· `resolveFaceMaterial` painted `side: DoubleSide`)
    ώστε οι παρειές της τρύπας να είναι ορατές + επιλέξιμες + βάψιμες από μέσα ανεξαρτήτως winding.
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (drag swatch→όψη· πλάκα με άνοιγμα σε Polygon Mode δείχνει το κενό +
    **τοιχώματα επιλέξιμα/βάψιμα**· custom color dialog· yellow hover) + commit (Giorgio· stage
    **ADR-040 + ADR-539**, CHECK 6B/6D).
- **2026-06-27 (Φ1.5 — FOUNDATION, IMPLEMENTED UNCOMMITTED)** — Επέκταση του per-face appearance σε
  **foundation** (πέδιλα/θεμέλια pad/strip/tie-beam). Η αρχιτεκτονική ήταν ήδη solid-agnostic →
  μόνο converter + persistence wiring.
  - **Boy-Scout SSoT (N.0.2):** το foundation έγινε ο 2ος caller του faced body → εξήχθη το shared
    **`buildFacedSolidBody(verts, thicknessM, appearance, baseMat)`** στο `bim-three-faced-prism.ts`
    (ΕΝΑ faced-body SSoT)· ο slab `buildFacedSlabBody` πλέον delegate-άρει (μηδέν copy-paste).
  - **Converter:** `foundation-to-three.ts` faced branch (`facedByAppearance || facedByPolygonTarget`,
    διαβάζει `usePolygonMode3DStore.getState()`)· baseMat = `getElementMaterial3D('foundation-${kind}')`.
    Το faced prism έχει **IDENTICAL local span [0, thicknessM]** με το `extrudeAndRotate` → `position.y`
    αναλλοίωτο (hang-down `(topElevationMm − thicknessMm)·MM_TO_M + base`· πέδιλο flat → κανένα hole/slope).
  - **Persistence round-trip:** `+faceAppearance` σε `FoundationDoc`/`FoundationSaveInput`/**`FoundationUpdateInput`**/
    `saveFoundation`/**`updateFoundation`**/`entityToSaveInput`/`foundationDocToEntity`. ⚠️ **Foundation-specific gap
    (vs slab):** το foundation persist χρησιμοποιεί `updateDoc` για re-edits (ADR-397 immutable createdAt), όχι
    setDoc-always όπως ο slab → το `faceAppearance` έπρεπε να μπει ΚΑΙ στο `FoundationUpdateInput`/`updateFoundation`
    ΚΑΙ στο `persist()` patch του `useFoundationPersistence.ts`, αλλιώς η βαφή χανόταν σε reload. Το foundation
    persist ήδη ακούει `bim:entities-attached` (μέσω `useBimEntityMovedPersistEffect`), που εκπέμπει το
    `SetFaceAppearanceCommand` → καμία νέα subscription.
  - **Gate:** `POLYGON_FACED_KINDS = {'slab', 'foundation'}` στο `PolygonModeToggle3D.tsx`.
  - **Tests:** `bim-three-faced-prism.test.ts` (+4 `buildFacedSolidBody`), `foundation-to-three.test.ts`
    (+3 faced), `foundation-firestore-service.test.ts` (+4 round-trip) → **41/41 GREEN** (3 suites).
  - **Generic (μηδέν foundation-specific αλλαγή):** `SetFaceAppearanceCommand` + `PolygonMaterialPanel`
    (level-scene adapter) δουλεύουν για foundation αυτούσια (base-field writer).
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (foundation → Όψεις → click όψη → swatch → χρώμα → refresh → undo) + commit
    (Giorgio· stage **ADR-040 + ADR-539**, CHECK 6B/6D).
- **2026-06-27 (Φ1 FIX — chicken-and-egg face picking, UNCOMMITTED)** — Bug (browser): σε **άβαφη** πλάκα
  το κλικ σε όψη δεν φώτιζε, γιατί ο faced render (που δίνει `faceKeyByMaterialIndex` → pickable όψεις)
  ήταν gated ΜΟΝΟ σε `faceAppearance` present· χωρίς βαφή → legacy single-material mesh → ο `raycastBimFace`
  δεν επέστρεφε `faceKey`. **Fix:** ο slab renders faced ΚΑΙ όταν είναι ο live Polygon-Mode target
  (`PolygonMode3DStore.targetBimId === slab.id`), με κενό appearance (ίδια εμφάνιση, αλλά pickable). Νέο
  `targetBimId` στο store (set στο `setActive(active, bimId)`)· το toggle κάνει `resyncBimScene` (το
  `bimLayer.sync()` = rebuild-all) ώστε η πλάκα να γίνει faced ↔ legacy. Αρχεία: `PolygonMode3DStore.ts`,
  `bim-three-slab-converter.ts` (gate `facedByAppearance || facedByPolygonTarget`), `BimViewport3D.tsx`
  (pass `selectedBimId` + resync σε toggle/auto-exit).
- **2026-06-27 (Φ1 MVP IMPLEMENTED, UNCOMMITTED)** — Υλοποίηση per-face appearance για **slab**,
  click-to-apply. Νέα: `bim/types/face-appearance-types.ts` (FaceKey/FaceAppearance/FaceAppearanceMap),
  `bim-3d/converters/bim-three-faced-prism.ts` (`buildFacedPrism` → groups + `faceKeyByMaterialIndex`,
  materialIndex 0=bottom/1=top/2+i=side:i, ΧΩΡΙΣ holes), `bim-3d/materials/face-appearance-material.ts`
  (`resolveFaceMaterial` reuse `getWallCoveringColor`), `bim-3d/stores/PolygonMode3DStore.ts`,
  `bim-3d/systems/selection/FaceSelectionHighlighter.ts` (overlay sub-mesh από group range, parented
  στο target mesh), `core/commands/entity-commands/SetFaceAppearanceCommand.ts` (generic base-field writer,
  reuse `signalEntitiesAttached`), `bim-3d/ui/PolygonMaterialPanel.tsx` (reuse `listWallCoveringMaterials`).
  Τροποποιήθηκαν: `bim/types/bim-base.ts` (+`faceAppearance?`), `bim-three-slab-converter.ts` (faced path
  όταν `faceAppearance` present· legacy αναλλοίωτο absent), `BimEntityRaycaster.ts` (+`raycastBimFace`,
  `RaycastHit.faceKey`), `ThreeJsSceneManager.ts` (+`raycastBimFace`/`setSelectedFace`/`faceHighlighter`
  +refresh στο sync), `use-bim3d-pointer-handlers.ts` (polygon-mode click branch), `BimViewport3D.tsx`
  (toggle + panel mount), slab persistence round-trip (`SlabDoc`/`SlabSaveInput`/`saveSlab`/`entityToSaveInput`
  /`docToEntity` +`faceAppearance`). Tests: `bim-three-faced-prism.test.ts` (6), `SetFaceAppearanceCommand.test.ts` (7) — 13/13 GREEN.
  **Ειλικρινείς αποφάσεις/περιορισμοί Φ1 (αποκλίσεις από το αρχικό plan):**
  - **Scope = slab μόνο** (όχι foundation ακόμη): όλη η αρχιτεκτονική (base field, command, prism, material,
    raycast, highlighter, store, panel) είναι solid-agnostic· το foundation χρειάζεται μόνο converter+persistence
    wiring (ίδιο pattern) → **Φ1.5**. Το toggle button gated σε `POLYGON_FACED_KINDS = {'slab'}`.
  - **`buildPrismIndex` (roof) ΔΕΝ refactored**: ο νέος `buildFacedPrism` είναι το canonical per-face SSoT,
    αλλά το roof κρατά το δικό του proven index (skipTop + tile UVs) για μηδέν regression· consolidation = **Φ3**.
  - **Holes/slab-openings**: το faced path αγνοεί openings (Φ2 — `triangulateShape(contour, holes)`).
  - **Slope/UVs**: το faced slab body δεν εφαρμόζει slab slope ούτε world UVs (flat-colour faces, Φ1).
  - **Cross-client live sync** του `faceAppearance` δεν καλύπτεται (το `slabEntityDiffersFromDoc` συγκρίνει μόνο
    `params`)· το reload round-trip (`docToEntity`) persist-άρει σωστά. Live per-face diff = Φ3.
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (slab → Όψεις → click όψη → swatch → χρώμα → refresh → undo) + tsc clean + commit
    (Giorgio· stage **ADR-040 + ADR-539**, CHECK 6B/6D).
- **2026-06-27** — ADR δημιουργήθηκε (RESEARCH/PLANNED). Έρευνα + αρχιτεκτονική απόφαση +
  φασικό roadmap. Επιβεβαίωση Cinema 4D UX από screenshot + AskUserQuestion αποφάσεις Giorgio.
