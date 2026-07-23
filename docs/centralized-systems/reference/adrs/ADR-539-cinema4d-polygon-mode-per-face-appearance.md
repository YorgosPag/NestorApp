# ADR-539 — Cinema 4D «Polygon Mode»: Per-Face Appearance (χρώμα/υλικό ανά όψη) σε δομικά solids

**Status:** 🟢 Φ1 (MVP, slab) COMMITTED · Φ1.5 (foundation) + Φ2 (drag-drop/holes/custom-color/hover) + Φ3a-f (column/roof/wall/**beam**/2D-fill/context-menu) IMPLEMENTED UNCOMMITTED 2026-06-27 — **Φ3 ΟΛΟΚΛΗΡΩΘΗΚΕ (όλα τα δομικά solids faced)** · **Date:** 2026-06-27
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
| **Φ3d** | **beam** (box single-piece· `beamToMesh` faced branch `buildBeamCoreBody` → `buildFacedSolidBody`· 6-point persistence + gate· MVP: I-shape/multi-cutback = legacy) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3 (ΟΛΟΚΛΗΡΩΘΗΚΕ)** | slab + foundation + column + roof + wall + beam = όλα τα δομικά solids faced (+ 2D fill Φ3e + context-menu Φ3f) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ4a** | keyboard copy/paste εμφάνισης όψης (Ctrl+C/V face) + **entity-level** copy/paste (Ctrl+Shift+C/V, όλες οι όψεις, ένα undo) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ4b** | multi-face select (Shift) + N overlays + batch command (ένα undo) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ4c** | `bmat_*` library drag swatches + `faceAppearanceColorHex` resolve extend | ⬜ PLANNED |
| **Φ4d** | per-face PBR textures (γέφυρα `MaterialCatalog3D`, ADR-413) — `resolveFaceMaterial` delegate σε `getFaceMaterial3D`/`getFaceColorMaterial3D` (reuse `getMaterial3D`) + `buildFacedPrism` UVs | ✅ DONE (2026-07-21, βλ. ADR-679 Φ2b) |
| **Φ5** | **panel πάντα ορατό + entity-level drag-drop** (Giorgio 2026-07-22): το `PolygonMaterialPanel` δεν κρύβεται πια πίσω από κουμπί «Όψεις» + επιλογή· τρία modes (ΣΩΜΑ/ΣΟΒΑΣ entity-level, ΠΟΛΥΓΩΝΑ per-face)· drag-drop βάφει ΟΛΗ την οντότητα (C4D) | 🟢 IMPLEMENTED UNCOMMITTED |

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

**Νέα (Φ4a):** `bim-3d/ui/read-face-appearance.ts` · `bim-3d/ui/is-typing-in-form-field.ts` ·
`bim-3d/ui/apply-entity-face-appearance-map.ts` · `bim-3d/viewport/polygon-clipboard-key.ts` ·
`bim-3d/viewport/use-polygon-clipboard-shortcuts.ts` ·
`core/commands/entity-commands/SetEntityFaceAppearanceMapCommand.ts`. **Τροποποίηση (Φ4a):**
`bim-3d/stores/FaceContextMenuStore.ts` (+`entityClipboard`) · `bim-3d/viewport/grips/FaceContextMenu.tsx`
(dedupe read) · `bim-3d/shortcuts/use3DShortcuts.ts` (dedupe guard) · `bim-3d/viewport/BimViewport3D.tsx` (mount).

**Νέα (Φ4b):** `bim-3d/converters/should-render-faced.ts` (SSoT faced-gate· cross-entity).
**Τροποποίηση (Φ4b):** `bim-3d/stores/PolygonMode3DStore.ts` (+`selectedFaces` set, `toggleFace`, `clearFaces`,
anchor `selectedFace`) · `bim-3d/systems/selection/FaceSelectionHighlighter.ts` (`setTargets` N overlays) ·
`bim-3d/scene/ThreeJsSceneManager.ts` (`setSelectedFaces` + `setSelectedFace` delegate) ·
`bim-3d/ui/apply-face-appearance.ts` (+`applyFaceAppearanceToFaces` = `CompositeCommand`) ·
`bim-3d/ui/PolygonMaterialPanel.tsx` (apply σε ΟΛΕΣ τις όψεις + multi-hint) ·
`bim-3d/viewport/use-bim3d-pointer-handlers.ts` (Shift-toggle) ·
`bim-3d/viewport/use-polygon-clipboard-shortcuts.ts` (paste-face σε ΟΛΕΣ) · i18n `polygonMode.hintMultiFace` ·
**6 converters** (slab/structural[column+beam]/wall/foundation/roof → `shouldRenderFaced` SSoT, cross-entity facing).
**Base+override ενοποίηση (Φ4b):** `bim/types/face-appearance-types.ts` (+`BASE_FACE_KEY '*'`) ·
`bim-3d/materials/face-appearance-material.ts` (`resolveFaceMaterial` base fallback) ·
`bim/utils/bim-face-plan-fill.ts` (`topFacePlanFill` base fallback) · `bim-3d/ui/PolygonMaterialPanel.tsx`
(no-face → βάψε ΟΛΟ το στοιχείο) · i18n `polygonMode.hintWholeElement`/`clearWhole`.

**Τροποποίηση:** `bim/types/bim-base.ts` · `bim-3d/converters/bim-three-slab-converter.ts` ·
`bim-3d/systems/raycaster/BimEntityRaycaster.ts` · `bim-3d/scene/ThreeJsSceneManager.ts` ·
`bim-3d/viewport/use-bim3d-pointer-handlers.ts` · `bim-3d/viewport/BimViewport3D.tsx` ·
slab persistence serialize path (αν whitelist).

## 7. Changelog

- **2026-07-23 (Φ7 — STAIR SUB-ELEMENT FULL-APPEARANCE PAINT, Revit «Paint»/C4D parity, IMPLEMENTED UNCOMMITTED)** —
  Bug report Giorgio (3ο iteration): οι υποενότητες σκάλας ΕΠΙΛΕΓΟΝΤΑΙ (Φ6) αλλά το **drag-drop / swatch
  χρώματος/υλικού/υφής ΔΕΝ τις άλλαζε**. Ρίζα: η σκάλα έχει **δικό της, περιορισμένο** μοντέλο υλικών —
  `params.materials`/`perTreadOverrides[i].material` = **`string` preset id** (`oak`/`marble`/`mat-*`),
  ΟΧΙ `FaceAppearance`· κανένα colorHex/textured, κανένα slot για waist. Το per-face apply path γράφει
  `FaceAppearance` που η σκάλα δεν διαβάζει → «δεν το αντιλαμβάνεται».

  **Απόφαση (Giorgio):** FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι (Revit «Paint on face» βάφει
  μεμονωμένες όψεις σκάλας με ΠΛΗΡΕΣ material· Cinema 4D material tag σε polygon selection). →
  **Ενοποίηση του stair material model με το per-face `FaceAppearance` SSoT.** Υλοποίηση (7 code + 1 helper):
  - `stair-types.ts` — `StairPerTreadOverride`/`StairPerRiserOverride` += `appearance?: FaceAppearance`·
    νέο `StairPerComponentAppearanceOverride` + params `perLandingOverrides`/`perWaistOverrides` (keyed by
    `stairComponentIndex`). Legacy `material: string` διατηρείται (back-compat).
  - `stair-material-resolver.ts` — step-0 cascade: appearance override ΚΕΡΔΙΖΕΙ, resolved μέσω νέου κοινού
    `resolveStairAppearanceMaterial` (= ΤΟ ΙΔΙΟ SSoT με το per-face solid resolve: `getFaceMaterial3D`
    textured / `getFaceColorMaterial3D`+`faceAppearanceColorHex` color)· αλλιώς → υπάρχον preset/structure
    cascade **αμετάβλητο**. Επέκταση override lookup για landing.
  - `StairToThreeConverter.ts` (landing per-index mat) + `stair-waist-slabs.ts` (waist per-flight mat μέσω
    `resolveStairAppearanceMaterial(perWaistOverrides[gi])`, fallback structural default).
  - **Νέος writer `apply-stair-sub-element-appearance.ts`** — γράφει το appearance στο σωστό override
    record (immutable merge, διατηρεί material/nosing + άλλα indices) → `UpdateStairParamsCommand` (ΕΝΑ undo,
    geometry recompute). `value=null` → clear.
  - Routing: `PolygonMaterialPanel.apply()` (επιλεγμένο sub-element → writer) + `use-polygon-drag-drop.onDrop`
    (stair sub-part hit → writer + anchor selection).
  - **SSoT cleanup (Boy-Scout, N.18):** το inline `levelAdapter` ήταν διπλό ×3 (apply-face/finish/stair) →
    κεντρικοποιήθηκε σε `current-level-adapter.ts` (`currentLevelAdapter`), και τα 3 το εισάγουν.

  Persistence: τα stair params serializ-άρονται **wholesale** (`stripUndefinedDeep`, stair-firestore-service)
  → τα νέα πεδία persist αυτόματα, το clear→undefined αφαιρείται. Tests: resolver appearance (8) + writer
  merge/routing (7) πράσινα· regression 47/47· jscpd clean. **Follow-up:** yellow hover-preview σκάλας υπό
  «ΠΟΛΥΓΩΝΑ»· ΣΩΜΑ/ΣΟΒΑΣ paint ολόκληρης σκάλας (τώρα μόνο per-sub-element υπό ΠΟΛΥΓΩΝΑ). ⚠️ ADR-358 ΔΕΝ
  ενημερώθηκε (committed merge markers).
- **2026-07-23 (Φ6 — STAIR SUB-ELEMENT SELECTION ΕΝΟΠΟΙΗΜΕΝΟ ΚΑΤΩ ΑΠΟ «ΠΟΛΥΓΩΝΑ», IMPLEMENTED UNCOMMITTED)** —
  Bug report Giorgio (2 iterations):
  - **(1)** «αν και ΔΕΝ έχω πατήσει ΠΟΛΥΓΩΝΑ, μπορώ να επιλέξω πολύγωνα» — το μπλε tread ΔΕΝ ήταν per-face
    (το per-face picking είναι σωστά κλειδωμένο σε `active` παντού: `use-bim3d-pointer-handlers` κλικ/δεξί,
    `bim3d-pointer-scheduler` hover, `use-polygon-drag-drop`, `use-polygon-clipboard-shortcuts`). Ήταν το
    **ADR-358 Q19 stair sub-element «click-into»** (body-mode, 2ο κλικ), που χρησιμοποιεί **ΤΟ ΙΔΙΟ μπλε**
    `0x2ea1ff` (`StairSubElementHighlighter.ts` = `FaceSelectionHighlighter.ts`) → φαινόταν σαν διαρροή.
  - **(2)** Με ΠΟΛΥΓΩΝΑ πατημένο, ΔΕΝ επιλεγόταν μεμονωμένο πάτημα/ρίχτι/πλατύσκαλο/πλάκα — μόνο ολόκληρη
    η σκάλα. Ρίζα: μια παραμετρική σκάλα ΔΕΝ είναι faced-prism (`StairToThreeConverter` κρατά ξεχωριστά
    tread/riser/landing/waist meshes με `stairComponent` tags), άρα το `raycastBimFace` δεν έβρισκε
    `faceKey` → κλικ = clear.

  **Απόφαση (Giorgio):** ΟΛΗ η sub-element επιλογή ζει **κάτω από «ΠΟΛΥΓΩΝΑ»** (solids → per-face· σκάλα →
  per-component). Εκτός «ΠΟΛΥΓΩΝΑ» το κλικ επιλέγει ΠΑΝΤΑ ολόκληρη τη σκάλα. Υλοποίηση (4 code files):
  - `BimEntityRaycaster.ts` — το `raycastBimFace` μεταφέρει πλέον τα `stairSubElementFields` (stairPart +
    index) στο entityFallback (mirror `raycastBimGroup`), ώστε ένα non-faced stair hit να είναι drill-able.
  - `use-bim3d-pointer-handlers.ts` — polygon branch: (α) faceKey → per-face· (β) stair sub-part → επιλογή
    sub-element (host stair ensured-selected → `subStore.selectSub`)· (γ) miss → clear. **Αφαιρέθηκε** το
    body-mode `alreadySole` drill-in → εκτός Πολυγώνων = ολόκληρη σκάλα.
  - `stair-sub-element-selection-store.ts` — `StairSubPart` += `'waist'` (πλάκα σκάλας) + `isStairSubPart`.
  - `StairToThreeConverter.ts` — waist meshes ταγκάρονται με 0-based `stairComponentIndex` (1/flight),
    ώστε να είναι individually pickable όπως tread/riser/landing.

  Το `waist` έχει **3D-only** halo (όπως το `riser`: κανένα plan-polygon → καμία 2D fill). Το 2D click-into
  (δικός του handler, canonical `ToolStateStore`) αμετάβλητο. Hover-preview της σκάλας υπό «ΠΟΛΥΓΩΝΑ» =
  follow-up (selection δουλεύει· δεν υπάρχει ακόμη yellow sub-element hover). ⚠️ Το **ADR-358** ΔΕΝ
  ενημερώθηκε: το αρχείο του έχει **committed git merge markers** (`>>>>>>> Stashed changes`, 9 markers) —
  χρειάζεται χειροκίνητο cleanup από Giorgio πριν αγγιχτεί.
- **2026-07-22 (Φ5 — PANEL ΠΑΝΤΑ ΟΡΑΤΟ + ENTITY-LEVEL DRAG-DROP, IMPLEMENTED UNCOMMITTED)** — Giorgio:
  «όταν μπαίνω στον 3D κάμβα να ανοίγει ΑΜΕΣΩΣ το πάνελ υλικών, χωρίς να επιλέξω οντότητα + πατήσω
  Όψεις». Ανασχεδιασμός του mode μοντέλου σε **τρία** modes (το panel toggle δείχνει τρία κουμπιά):
  - **ΣΩΜΑ** (`body`, entity-level): drag-drop/swatch βάφει ΟΛΟ το σώμα (`applyEntityFaceAppearanceMap`
    + `entireElementFaceMap`, base `'*'`)· το κλικ στον κάμβα μένει **κανονική επιλογή οντότητας**
    (grips/properties παίζουν κανονικά).
  - **ΣΟΒΑΣ** (`finish`, entity-level): βάφει τον σοβά σε ΟΛΕΣ τις κάθετες όψεις — νέο SSoT
    `applyFinishToWholeElement` (διαβάζει `finishFootprintVertices` → `side:0..n-1` →
    `applyFinishFaceOverrideToFaces`, ΕΝΑ undo). Κλικ = κανονική επιλογή.
  - **ΠΟΛΥΓΩΝΑ** (`polygon`, per-face): το παλιό «active» Polygon Mode — κλικ επιλέγει όψη/τρίγωνο,
    drag-drop βάφει μεμονωμένη όψη. **Μόνο εδώ** γίνεται faced resync.

  **Κλειδί ελάχιστου ρίσκου:** `active` = derived (`targetLayer === 'polygon'`), ώστε ΟΛΑ τα υπάρχοντα
  face-picking call-sites (`shouldRenderFaced`, pointer handlers, snap scheduler, clipboard, 2D
  context-menu) να μείνουν αμετάβλητα — ενεργά μόνο σε per-face mode. Το κουμπί «Όψεις»
  **αφαιρέθηκε** (το `PolygonModeToggle3D` κρατά μόνο faced-render lifecycle + store reset)· το panel
  render-άρει πάντα (αφαιρέθηκε το `if (!active) return null`). Τα κουμπιά ΣΩΜΑ/ΣΟΒΑΣ έγιναν μικρότερα
  (grid-cols-3). Boy-Scout SSoT: `finishFootprintVertices`/`FinishPaintableEntity` μετακινήθηκαν στο
  `finish-face-override-ops.ts` (το command τα κάνει import)· `faceAppearanceToFinishOverride`
  εξήχθη κοινό (panel + drag-drop). Νέα i18n: `polygonMode.layerPolygon`/`hintBodyWhole`/`hintFinishWhole`.
  **Files:** `PolygonMode3DStore.ts` · `PolygonMaterialPanel.tsx` · `use-polygon-drag-drop.ts` ·
  `PolygonModeToggle3D.tsx` · `apply-finish-face-override.ts` · `finish-face-override-ops.ts` ·
  `SetFinishFaceOverrideCommand.ts` · `bim3d.json` (el+en). Tests: store 3-mode + finish-ops whole-element.
  Pending: browser verify + commit.

- **2026-07-21 (Φ4d — cross-ref → ADR-679 Φ2b — PER-FACE PBR TEXTURES, DONE)** — Το `resolveFaceMaterial`
  (`bim-3d/materials/face-appearance-material.ts`) ήταν flat-colour-only ακόμη κι όταν το `FaceAppearance`
  έδειχνε σε textured `materialId`. Έγινε **thin delegate** (ZERO νέο type/builder/system): `colorHex` →
  `getFaceColorMaterial3D(hex)` (flat matte DoubleSide, cached ανά hex, **νικά** το `materialId` — κρατά
  τη 2D/3D χρωματική συμφωνία)· `materialId` (χωρίς `colorHex`) → **gated**: ΜΟΝΟ βιβλιοθήκης `bmat_*` υλικό
  με ανεβασμένο albedo ΚΑΙ realistic-materials ON → `getFaceMaterial3D(materialId)` = **reuse** του ήδη
  texture-aware `getMaterial3D` (ADR-413, preload→resync wired) τυλιγμένο σε DoubleSide variant (ορατότητα
  τοιχωμάτων τρύπας)· wall-covering (ADR-511)/δάπεδο (ADR-419) ids, οποιοδήποτε id με realistic OFF ή χωρίς
  ανεβασμένη υφή, ΚΑΙ χωρίς override → **ΑΜΕΤΑΒΛΗΤΟ** legacy flat-colour path (`faceAppearanceColorHex`:
  colorHex wins, αλλιώς materialId→catalog color). Το gate αποτρέπει regression: χωρίς αυτό το
  `getMaterial3D('paint-red')` θα έπεφτε στο `resolveMaterialKey` default `mat-concrete` και θα έβαφε μια
  wall-covering όψη σαν σκυρόδεμα. Νέα στο `MaterialCatalog3D.ts`:
  `getFaceMaterial3D`/`getFaceColorMaterial3D` + `FACE_DOUBLE_SIDED` (WeakMap, auto-invalidate στο texture
  resync swap) + `FACE_COLOR_CACHE` (disposed στο `disposeMaterialCatalog3D`). **Side-fix (leak):** το παλιό
  `resolveFaceMaterial` έχτιζε **fresh, uncached** material ανά βαμμένη όψη σε κάθε scene rebuild
  (`BimSceneLayer.clearGroup` disposes μόνο geometry, ποτέ materials) — πλέον cached. **Επίσης:** τα faced
  solids (slab/column/beam/foundation/wall, `bim-three-faced-prism.ts::buildFacedPrism`) είχαν **ΜΗΔΕΝ
  uv/uv2** → προστέθηκε `setBoxWorldUvs(flat)` μετά το `computeVertexNormals()` (το roof είχε ήδη UVs).
  **UI slice (ολοκληρώνει Φ2b end-to-end — data model + render + UI):** το `PolygonMaterialPanel.tsx`
  (Σώμα layer) δίνει πλέον **ΤΡΙΑ** swatch groups (Cinema 4D Material Manager parity): (1) textured
  catalog PBR υλικά — νέο `FACE_TEXTURE_MATERIAL_IDS` = brick/stone/wood/tile/concrete/metal/plaster/
  roof-tile, (2) τα `bmat_*` βιβλιοθήκης υλικά του χρήστη (μέσω **reuse** `useMaterialLibrary`), (3) τα
  υπάρχοντα wall-covering flat paints (διατηρούνται). Catalog+library swatches δείχνουν πραγματική
  υφή-thumbnail μέσω **reuse** `<MaterialSwatch>`. Drag-drop + click-apply αναλλοίωτα (ίδιο
  `FaceAppearance.materialId` path). Νέο pure helper `bim-3d/ui/polygon-material-swatches.ts`
  (`FACE_TEXTURE_MATERIAL_IDS` + `buildLibraryMaterialSwatches`). i18n: `constructionMaterials.mat-brick`/
  `mat-stone` (el+en, dxf-viewer-shell). **Gate extension:** `MaterialCatalog3D.hasFaceTexture` επεκτάθηκε
  — επιστρέφει true ΚΑΙ για catalog `mat-*`/`elem-*` id με texture slug (`textureSlugForKey(resolveMaterialKey(id))`),
  πέρα από `bmat_*` με albedo· ξένα wall-covering/finish paint ids (όχι `mat-`/`elem-`) παραμένουν
  εκτός → flat colour (καμία `mat-concrete` πτώση). Reuse (μηδέν διπλότυπο): `MaterialSwatch`,
  `useMaterialLibrary`, `constructionMaterialLabelKey`, `MATERIAL_TEXTURE_MAP`. Αποτέλεσμα: όψη βαμμένη
  με textured catalog ή library υλικό δείχνει πλέον την υφή της σε 3D (realistic ON).
  Detail: **ADR-679 changelog (Φ2b)**.
- **2026-07-19 (cross-ref → ADR-679 Φ2a — UNIFIED COLOR REGISTRY)** — Ο `faceAppearanceColorHex` (ο SSoT
  «χρώμα όψης», 3D painted + 2D plan fill) έλυνε το `materialId` **μόνο** μέσω `getWallCoveringColor` →
  όψη βαμμένη με υλικό δαπέδου/library υλικό έβγαινε γκρι. Πλέον δείχνει στον ενοποιημένο
  `bim/materials/material-color-registry::getMaterialColorById` (extensible provider-registry): wall-covering
  (ADR-511) + δάπεδα (ADR-419) στατικά + library `bmat_*` (δηλωμένο late από `user-material-registry`).
  **Body/2D path σημασιολογικά αμετάβλητο για wall-covering ids** (ίδιο hex)· απλώς αναγνωρίζονται και οι
  υπόλοιποι κατάλογοι. Καμία αλλαγή στο `FaceAppearance` type/store. Detail: **ADR-679 changelog (Φ2a)**.

- **2026-07-19 (UI — Cinema 4D «Material Manager» bottom bar)** — Το `PolygonMaterialPanel` μετακινήθηκε από πλαϊνό panel **πάνω δεξιά** (`absolute right-3 top-20 w-52`, κάθετο grid-2) σε **φαρδιά οριζόντια μπάρα υλικών στη ΒΑΣΗ** του 3D κάμβα (`absolute inset-x-0 bottom-0`, flex row), όπως ο Material Manager του Cinema 4D (Giorgio 2026-07-19). Layout: αριστερά cluster (τίτλος + hint + σώμα/σοβάς toggle), κέντρο οριζόντια scroll-able σειρά thumbnails (`w-14`, swatch `h-9 w-9` + label από κάτω), δεξιά cluster (προσαρμοσμένο χρώμα + καθαρισμός). **Καμία αλλαγή σε logic/apply/drag-drop/i18n** — μόνο JSX/CSS restructure· ADR-040 leaf αμετάβλητο.
- **2026-07-02 (cross-ref → ADR-449 Slice C 2D)** — Το **2D** ισοδύναμο του per-face paint υλοποιήθηκε ως ξεχωριστό εργαλείο `finish-paint` (Revit «Paint») **ΟΧΙ** ως αντιγραφή αυτού του store: το 2D έχει canonical `ToolStateStore`, οπότε το «active» = `activeTool==='finish-paint'` (μηδέν δεύτερος mode-μηχανισμός)· αυτό το 3D store κράτησε δικό του `active` ΜΟΝΟ επειδή το 3D δεν έχει tool-state σύστημα. Κοινός πυρήνας 2D+3D: `applyFinishFaceOverrideToFaces` (writer) + `FINISH_MATERIAL_OPTIONS`/`getMaterialFlatColorHex` (swatches) + `EnterpriseColorDialog`. Πλήρες detail: **ADR-449 changelog (δ.PART-B-Slice-C-2D-wiring)**.
- **2026-07-02 (cross-ref → ADR-449 Slice C)** — Το polygon mode απέκτησε **layer target** (`PolygonMode3DStore.targetLayer: 'body'|'finish'`) ώστε το ΙΔΙΟ face-pick + `PolygonMaterialPanel` + `EnterpriseColorDialog` να βάφει ΕΙΤΕ το **σώμα** (`FaceAppearance`, εδώ) ΕΙΤΕ τον **σοβά** (`spec.faceOverrides`, ADR-449). Το `PolygonMaterialPanel` πήρε toggle «Σώμα|Σοβάς» + finish swatches· το `apply` route-άρει σε `applyFinishFaceOverrideToFaces` όταν layer='finish'. **Body path αμετάβλητο (byte-for-byte).** Πλήρες detail: **ADR-449 changelog (δ.PART-B-Slice-C-3D)**. Το `side:i` faceKey (`buildFacedPrism`) → `finishFaceRef` της ακμής i = η γέφυρα των δύο layer.
- **2026-06-27 (Φ4b — MULTI-FACE SELECT + BATCH PAINT = ΕΝΑ UNDO, IMPLEMENTED UNCOMMITTED)** — «Advanced polygon
  editing» layer (2/4): Cinema 4D «Polygon Mode» multi-select. Shift+κλικ προσθέτει/αφαιρεί όψεις, N highlight
  overlays ταυτόχρονα, και κάθε βαφή/καθαρισμός/paste εφαρμόζεται σε **ΟΛΕΣ** τις επιλεγμένες όψεις με **ΕΝΑ
  atomic undo step** — cross-entity (όψεις από διαφορετικά solids) ΚΑΙ same-entity. **FULL SSoT — μηδέν νέα
  geometry, κανένα νέο command primitive· μόνο σύνθεση υπαρχόντων SSoT.**
  - **SSoT audit εύρημα (κρίσιμο):** το `CommandHistory.execute(cmd)` καλεί `cmd.execute()` και το
    `CompositeCommand.execute()` τρέχει όλα τα children forward → ένα **fresh** `CompositeCommand` που εκτελείται
    ΜΙΑ φορά δίνει ΕΝΑ undo step. ΔΕΝ χρειάστηκε νέο multi-face command (το `appendToLast` μονοπάτι του
    CompositeCommand doc είναι για ΗΔΗ-εκτελεσμένα derived children — διαφορετική περίπτωση). Same-entity
    multi-face αναιρείται σωστά: κάθε `SetFaceAppearanceCommand` κάνει **lazy snapshot** του `prev` στο πρώτο
    `execute()` και τα children τρέχουν σειριακά μέσα στο composite → reverse-order undo = nested unwind.
  - **Store (`PolygonMode3DStore`):** `selectedFaces: readonly SelectedFace3D[]` = SSoT· `selectedFace` = anchor
    (τελευταία προστιθέμενη, primary· panel custom-color seed + Φ4a entity-copy το διαβάζουν). `toggleFace`
    (add/remove key=`${bimId}|${faceKey}`)· `selectFace` κρατά replace-semantics· `clearFaces`. Μηδέν high-freq (ADR-040).
  - **Click (`use-bim3d-pointer-handlers`, ADR-040 6B/6D):** Polygon-Mode branch → `e.shiftKey ? toggleFace : selectFace`
    (mirror ΑΚΡΙΒΩΣ το entity-level `toggleBimEntity`/`selectBimEntity`)· Shift+miss κρατά το set (Cinema 4D), plain
    miss το καθαρίζει· `manager.setSelectedFaces(...)`.
  - **Highlighter (`FaceSelectionHighlighter`):** `setTargets(faces[])` κρατά **array** overlays (reuse `faceGroupRange`
    + `sliceFaceGeometry` αυτούσια)· `setTarget` = single-face convenience (hover/context-menu/drag-drop αμετάβλητα)·
    `refresh`/`dispose` σε ΟΛΑ τα overlays (μηδέν leak). Ο hover highlighter μένει single.
  - **Manager (`ThreeJsSceneManager`):** `setSelectedFaces(faces)` → `faceHighlighter.setTargets`· `setSelectedFace`
    delegate (backward-compat).
  - **Batch apply (`apply-face-appearance.ts`):** `applyFaceAppearanceToFaces(levels, faces, value|null)` — N
    `SetFaceAppearanceCommand` → `CompositeCommand` → `execute` (length≤1 → απλό command, μηδέν overhead). Κοινός
    level-scene adapter. Consumers: `PolygonMaterialPanel.apply` (swatch/custom-color/clear) + Φ4a keyboard paste-face
    → ΟΛΕΣ οι όψεις· copy-face/entity μένουν anchor.
  - **✅ ΕΝΟΠΟΙΗΣΗ object-paint + face-paint = ΕΝΑ tool (Revit/Cinema 4D «base + override», Giorgio):** «βάψε ΟΛΟ
    το στοιχείο» και «βάψε κάποιες όψεις» δεν είναι δύο μηχανισμοί — είναι **ΕΝΑ cascade πάνω σε ΕΝΑ data model**.
    Νέο reserved **base key `'*'`** (`BASE_FACE_KEY`, `face-appearance-types.ts`) μέσα στο **ΙΔΙΟ** `FaceAppearanceMap`:
    `resolve(face) = appearance[face] ?? appearance['*'] ?? base entity material`. **Μηδέν νέο field/command/persistence**
    — το `'*'` ταξιδεύει στο υπάρχον map, μέσω του υπάρχοντος `SetFaceAppearanceCommand` + `applyFaceAppearanceToFaces`.
    - **ΕΝΑ σημείο cascade:** `resolveFaceMaterial` (το καλούν ΟΛΟΙ οι faced converters + roof) + `topFacePlanFill`
      (2D κάτοψη) απέκτησαν το `?? appearance['*']` fallback. `'*'` δεν είναι pickable (`faceGroupRange.indexOf=-1`),
      δεν εμφανίζεται σε λαβές, καμία iteration των appearance keys πουθενά (verified) → zero side-effects.
    - **Panel = ΕΝΑ tool:** `PolygonMaterialPanel.apply` → N όψεις επιλεγμένες ? βάψε τις όψεις : βάψε το base
      (`targetBimId` = το ενεργό solid, set στο `setActive`). Custom-color/clear/swatch ίδιο path· clear label +
      hint προσαρμόζονται (i18n `hintWholeElement`/`clearWhole`, el+en). Όλα μέσω του ΙΔΙΟΥ batch SSoT = ΕΝΑ undo.
    - **Tests:** `face-appearance-material.test.ts` (4, cascade) + `bim-face-plan-fill.test.ts` (+2 base) GREEN.
  - **🐛 FIX cross-entity facing (browser-verify):** το faced gate ήταν `poly.active && targetBimId === id` →
    **μόνο ΕΝΑ solid** (αυτό που άνοιξε το mode) γινόταν pickable, άρα Shift+κλικ σε όψη ΑΛΛΟΥ solid δεν έπιανε
    (το `raycastBimFace` γύριζε entity-fallback χωρίς `faceKey`). **Boy-Scout κεντρικοποίηση (N.0.2):** το gate
    ήταν inline-διπλό σε **6 converters** → ΕΝΑ SSoT `bim-3d/converters/should-render-faced.ts`
    (`shouldRenderFaced(faceAppearance)` = painted **Ή** `poly.active`). Νέα πολιτική: όσο το Polygon Mode είναι
    active, **ΟΛΑ** τα solids γίνονται faced (Cinema 4D: όλες οι όψεις όλων των αντικειμένων επιλέξιμες) → cross-entity
    multi-select δουλεύει. `targetBimId` = πλέον μόνο anchor (δεν οδηγεί το facing). Άβαφο + mode off → legacy
    (zero regression· slab/column/foundation/roof faced≡legacy look άβαφα μέσω `resolveFaceMaterial` fallback).
  - **Tests:** `PolygonMode3DStore.test.ts` (8), `FaceSelectionHighlighter.test.ts` (7),
    `apply-face-appearance-batch.test.ts` (6, cross-entity + same-entity one-undo), `should-render-faced.test.ts` (3)
    — **24/24 GREEN** + regression (FaceContextMenuStore, polygon-clipboard-key, read-face-appearance, SetFaceAppearance,
    SetEntityFaceAppearanceMap, beam/column/wall/roof-faced-3d [updated: active→cross-entity faced], faced-prism)
    **0 break**. i18n `polygonMode.hintMultiFace` (el+en, `{{count}}` ICU).
- **2026-06-27 (Φ4a — KEYBOARD + ENTITY-LEVEL COPY/PASTE, IMPLEMENTED UNCOMMITTED)** — «Advanced polygon
  editing» layer (1/4): copy/paste εμφάνισης από πληκτρολόγιο + entity-level. **FULL SSoT reuse, μηδέν
  διπλότυπα** (το per-face cross-entity clipboard υπήρχε ΗΔΗ από Φ3f — δεν ξαναχτίστηκε).
  - **SSoT audit εύρημα:** το `readFaceAppearance` ήταν **private** μέσα στο `FaceContextMenu.tsx` →
    εξήχθη σε `bim-3d/ui/read-face-appearance.ts` (read counterpart του `applyFaceAppearance`· +
    `readEntityFaceAppearanceMap`). Το context-menu το ξανα-χρησιμοποιεί (Boy-Scout dedupe). Επίσης το
    inline «skip typing in input» guard του `use3DShortcuts` → SSoT `bim-3d/ui/is-typing-in-form-field.ts`
    (κοινό με τον νέο keyboard leaf).
  - **Keyboard leaf:** `bim-3d/viewport/use-polygon-clipboard-shortcuts.ts` — window keydown leaf (mirror
    `usePolygonDragDrop`: `useLevelsOptional` + store `getState`, **μηδέν React re-render**, ADR-040 leaf),
    mount στο `BimViewport3D`. Pure classifier `polygon-clipboard-key.ts` (`classifyFaceClipboardKey`,
    `event.code` → layout-independent ελληνικό πληκτρολόγιο· mirror `shortcut-dispatcher` pure-vs-hook):
    - **Ctrl/Cmd+C / Ctrl/Cmd+V** → copy/paste **ΜΙΑΣ** όψης (reuse `FaceContextMenuStore.clipboard` +
      `applyFaceAppearance`).
    - **Ctrl/Cmd+Shift+C / +V** → copy/paste **ΟΛΗΣ** entity (νέο slot `entityClipboard` στο
      `FaceContextMenuStore` + νέο whole-map writer).
    - Ενεργό ΜΟΝΟ σε Polygon Mode + `selectedFace`· `preventDefault` μόνο όταν όντως χειρίζεται.
  - **Entity-level writer:** `core/commands/entity-commands/SetEntityFaceAppearanceMapCommand.ts` — undoable
    **whole-map replace** (αντί N per-face commands → **ένα atomic undo**)· αδελφό του `SetFaceAppearanceCommand`
    σε map granularity· clone-isolation από το clipboard· reuse `signalEntitiesAttached` persist SSoT. Wiring:
    `bim-3d/ui/apply-entity-face-appearance-map.ts` (mirror `apply-face-appearance.ts`).
  - **Tests:** `SetEntityFaceAppearanceMapCommand.test.ts` (7), `polygon-clipboard-key.test.ts` (9),
    `read-face-appearance.test.ts` (7), `FaceContextMenuStore.test.ts` (+4 → entity clipboard) — **36/36 GREEN**
    + regression (keyboard-shortcuts-3d, shortcut-dispatcher-edit, polygon-material-dnd, SetFaceAppearanceCommand)
    = 0 break. i18n: **καμία** νέα visible string (keyboard, silent — match drag-drop UX· N.2/N.11 clean).
  - **ADR-040:** ο νέος leaf + `BimViewport3D` mount **δεν** πιάνονται από CHECK 6B/6D (δεν αγγίζω
    pointer-handler/HoverStore). `use3DShortcuts` dedupe = behavior-preserving.
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (Όψεις → επίλεξε όψη → Ctrl+C → άλλη όψη/entity → Ctrl+V· Ctrl+Shift+C/V
    entity-level· undo) + commit (Giorgio· stage **ADR-539** + νέα/τροποποιημένα).
- **2026-06-27 (Φ3d — BEAM, IMPLEMENTED UNCOMMITTED)** — Επέκταση του per-face appearance στο **δοκάρι**,
  τελευταίο δομικό solid → **το Φ3 ΟΛΟΚΛΗΡΩΘΗΚΕ** (slab + foundation + column + roof + wall + beam όλα faced).
  Mirror wall Φ3c / column Φ3a, **μηδέν διπλότυπα** (FULL SSoT reuse).
  - **Κρίσιμο εύρημα (SSoT audit, grep-verified):** το master handoff έλεγε «beam ΔΥΣΚΟΛΟ — το faced body
    υποθέτει ΚΑΤΑΚΟΡΥΦΗ έκταση». **Λάθος.** Το `BeamGeometry.outline` είναι **plan footprint (width×length)**
    και ο box path του `beamToMesh` κάνει `buildShape(verts)` + `extrudeAndRotate(verts, renderHeightM)` —
    **IDENTICAL pattern με column/slab**. Άρα `buildFacedSolidBody(outlineVerts, renderHeightM, fa, mat)`
    δίνει `bottom/top/side:0..3` (πάνω/κάτω/2 μακριές παρειές/2 άκρα) — ό,τι θες να βάψεις.
  - **Converter:** `bim-three-structural-converters.ts` νέος helper `buildBeamCoreBody` (mirror
    `buildColumnCoreBody`): faced branch (`faceAppearance` painted Ή live Polygon-Mode target) →
    `buildFacedSolidBody(verts, renderHeightM, fa, getElementMaterial3D('beam'))`, αλλιώς `null` → ο caller
    πέφτει στο legacy `extrudeAndRotate` (byte-for-byte). Slope (ADR-401 `applyBeamSlope`) εφαρμόζεται και
    στα δύο geometries (ίδιο local Y span [0, renderHeightM] → ίδιο shear). Η `position.y`
    (`hangDownMeshY(...beamDepthM)`) + finish skin + rebar μένουν ΑΜΕΤΑΒΛΗΤΑ (additive siblings).
  - **MVP scope (ρητό, mirror wall):** faced ΜΟΝΟ στο **box single-piece**. I-shape (`sectionKind==='I-shape'`
    → `buildSweptIBeamGeometry` custom swept, ΟΧΙ prism) → legacy. Multi-piece cutback (`computeBeamCutbackOutline`
    > 1 ring → `extrudeShapesAndRotate`) → legacy. Faced gate = single full outline Ή single trimmed ring.
  - **Persistence (6 σημεία):** `BeamDoc` / `BeamSaveInput` / `BeamUpdateInput` += `faceAppearance?` ·
    `saveBeam` + `updateBeam` Firestore-safe writes · `entityToSaveInput` (`beam-firestore-service.ts`) +
    `beamDocToEntity` round-trip (`beam-persistence-helpers.ts`) + inline `updateBeam` patch
    (`useBeamPersistence.ts`) += `faceAppearance` (κρίσιμο **updateDoc gap**: ο beam persist χρησιμοποιεί
    `updateDoc` για re-edits· χωρίς το πεδίο στο patch η βαφή χανόταν σε reload — paint folds μέσω
    `bim:entities-attached` → `useBimEntityMovedPersistEffect` → patch). Το `BeamEntity` κληρονομεί ήδη
    `faceAppearance` από `BimEntity` → **μηδέν type change** στο `beam-types.ts`.
  - **Gate:** `POLYGON_FACED_KINDS += 'beam'` στο `PolygonModeToggle3D.tsx`. `SetFaceAppearanceCommand` /
    `FaceSelectionHighlighter` / `raycastBimFace` = kind-agnostic → καμία αλλαγή.
  - **N.7.1:** `bim-three-structural-converters.ts` έφτασε 511γρ → συμπυκνώθηκαν δικά μου + γειτονικά
    verbose σχόλια (boy-scout, μηδέν απώλεια ουσίας) → **498γρ** (< 500).
  - **Tests:** `beam-faced-3d.test.ts` (6 — multi-material όταν painted, identical datum vs legacy, legacy
    σε empty map, faced σε polygon-target, legacy σε άλλο target, **legacy σε I-shape**). Regression:
    beam/wall converter + scene + persistence suites (158 tests) = 0 break. **CHECK 6B/6D δεν πιάνουν** αυτά
    τα paths (`bim-3d/converters/`, `bim/beams/`, `hooks/data/`)· το ADR-539 staged ούτως ή άλλως (N.0.1).

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
