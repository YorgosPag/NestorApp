# ADR-539 — Cinema 4D «Polygon Mode»: Per-Face Appearance (χρώμα/υλικό ανά όψη) σε δομικά solids

**Status:** 🟢 Φ1 (MVP) IMPLEMENTED (UNCOMMITTED 2026-06-27· slab click-to-apply) · **Date:** 2026-06-27
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
| **Φ1 (MVP)** | **slab** · click-to-apply · `face-appearance-types` · `faceAppearance?` base · `buildFacedPrism` (χωρίς holes) · `slabToMesh` group path · `raycastBimFace` · `PolygonMode3DStore`+toggle · `FaceSelectionHighlighter` · `SetFaceAppearanceCommand`+persist · `PolygonMaterialPanel` | 🟢 IMPLEMENTED (slab· foundation→Φ1.5) |
| **Φ2** | HTML5 drag-drop · holes (slab-openings) · `EnterpriseColorDialog` custom color · face hover | ⬜ PLANNED |
| **Φ3** | full scope (wall/column/beam/foundation/roof converters → faced groups) · roof `sub:i:*` · 2D plan fill από `faceAppearance['top']` · context-menu σε face | ⬜ PLANNED |
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
