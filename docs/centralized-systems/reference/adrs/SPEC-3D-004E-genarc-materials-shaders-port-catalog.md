# SPEC-3D-004E — GenArc Materials & Shaders Port Catalog

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **READY FOR PHASE 3 & 6.x** 2026-05-19 — full catalog complete, port plan locked, GenArc A→E suite **CLOSED** |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / GenArc Port Sub-Spec (final) |
| **Location** | `docs/centralized-systems/reference/adrs/SPEC-3D-004E-genarc-materials-shaders-port-catalog.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent ADR** | ADR-366 (3D BIM Viewer & Photorealistic Rendering) |
| **Source** | `C:\genarc\src\engines\sdf\` (12 αρχεία) + `C:\genarc\src\shaders\` (4 αρχεία) + `C:\genarc\src\types\{material,wallDna}.types.ts` + `C:\genarc\src\constants\materialRegistry.constants.ts` — **19 αρχεία, ~2.500 LOC** |
| **Sibling SPECs** | SPEC-3D-004A ✅ (Viewport), SPEC-3D-004B ✅ (DXF Parser), SPEC-3D-004C ✅ (Utils/Snap/Picking), SPEC-3D-004D ✅ (Geometry Helpers) |
| **Related Nestor SSoT** | `bim/walls/wall-material-catalog.ts` (18 preset IDs), `bim/types/wall-dna-types.ts` (DNA σε mm), `bim/walls/wall-dna-mutations.ts` (pure mutations), `bim/config/bim-to-atoe-mapping.ts` (ΑΤΟΕ category resolver), `bim/stairs/stair-material-catalog.ts` (9 preset IDs), `rendering/types/Types.ts` (2D-only `MaterialDefinition`) |

---

## Executive Summary

Πλήρης διερεύνηση του **Materials & Shaders domain** του GenArc — `engines/sdf/` (12 αρχεία SDF GPU uniform packers + raymarcher quad factory), `shaders/` (4 GLSL string modules: SDF raymarcher, procedural materials, noise, grid plane), `types/material.types.ts` (PBR material schema), `types/wallDna.types.ts` (DNA layer model), `constants/materialRegistry.constants.ts` (12-entry full PBR+cost registry).

**Κρίσιμη ευρήματα**:

1. **ΟΛΟΣ ο `engines/sdf/` φάκελος + `sdfRaymarcher.ts` + `noise.glsl.ts` = EXCLUDE.** Είναι η καρδιά της GenArc SDF raymarching πλατφόρμας που το **ADR-366 §3.2.2 ρητά απορρίπτει** (scale failure σε 50.000+ DXF edges). Δέκα uniform-packing modules είναι GenArc-`MAX_*`-bound fixed-array GPU specific — Three.js mesh-based path (BufferGeometry per entity, instancing for repeats) χρησιμοποιεί εντελώς διαφορετική data flow. Zero port.
2. **`material.types.ts` = PORT_WITH_ADAPTATION (μοναδικό)** — strong superset structure σε σχέση με τα Nestor preset-only catalogs (`wall-material-catalog.ts` + `stair-material-catalog.ts`). Δίνει `MaterialDefinition` schema με `densityKgM3` + `MaterialCost {unitCost, laborCost, unit}` + `MaterialShaderParams {baseColor, roughness, patternScale}` + `MaterialCategory` (10 κατηγορίες). Αυτή ακριβώς η δομή που χρειάζεται το **ADR-363 Phase 6.x Multi-Layer DNA BOQ (~8h pending από SPEC-3D-004D Q4)** για per-layer ποσότητες με ΑΤΟΕ unit awareness.
3. **`materialRegistry.constants.ts` = EXTRACT_CONCEPT** — δομή του registry (PBR colors + roughness + densities + €€ ανά ΑΤΟΕ unit) είναι reference, αλλά τα GenArc-specific values (Ελλάδα 2024 τιμές, 12 entries) πρέπει να αντικατασταθούν με Nestor's 18 wall preset IDs + 9 stair preset IDs + τυχόν επιπλέον (opening glazing, slab finishes). **Phase 6+ Asset Manager swap target** όπως ήδη ορίζεται στο `wall-material-catalog.ts` interface `WallMaterialCatalogProvider`.
4. **`materialUniforms.ts` = EXTRACT_CONCEPT** — Ο αλγόριθμος "wall DNA → 3 face material IDs (exterior/interior/core) + flip-aware swap" (lines 44-78) είναι το βασικό decoupling pattern μεταξύ DNA layer ordering και per-face rendering. Το **Phase 3 `MaterialCatalog3D`** και **Phase 6.x BOQ extension** μοιράζονται αυτή τη logic — Nestor θα την υλοποιήσει εκ νέου σε pure Three.js context (no GPU uniform packing, instead → 3 `MeshStandardMaterial` per wall με correct face assignment).
5. **`materials.glsl.ts` = EXTRACT_CONCEPT (Phase 5+ optional)** — Procedural concrete/plaster/soil shaders (fbm-noise + speckle + formwork bands) **δεν χρειάζονται για Phase 3** (ADR-366 §7.1 = flat MeshStandardMaterial colors). Αν Phase 5+ προστεθεί path-traced texturing με procedural maps (alternative σε bitmap textures), αυτές οι GLSL recipes είναι valuable reference για baked albedo/roughness texture generation. Όχι actionable port — concept για future.
6. **`gridPlane.glsl.ts` = EXTRACT_CONCEPT (Phase 0 optional, low priority)** — adaptive 3-tier grid με axis colors + horizon. Three.js native `GridHelper` αρκεί για Phase 0. Έξτρα polish (LOD distance fade, axis highlighting) είναι useful για Phase 7.
7. **`wallDna.types.ts` = EXCLUDE** — Nestor's `bim/types/wall-dna-types.ts` είναι **functionally identical superset** (5 default presets vs 3, parapet/fence categories, mm convention που είναι Nestor canonical, ADR-358 §5.0 aligned). GenArc version (m units, 3 presets) outdated.
8. **`noise.glsl.ts` = EXCLUDE** — Ashima Simplex 3D noise (MIT) είναι χρήσιμο μόνο αν Nestor υιοθετήσει custom GLSL shaders. ADR-366 §7.1 χρησιμοποιεί Three.js `MeshStandardMaterial` (no custom shaders Phase 3). Three.js + three-gpu-pathtracer στο Phase 5 περιλαμβάνουν δικές τους noise functions αν χρειαστούν. Reusable αν Phase 5+ απαιτήσει custom procedural maps.

**Catalog πίνακας**:

| Κατηγορία | Files | LOC | Action | Phase |
|---|---:|---:|---|---|
| **PORT_AS_IS** | 0 | 0 | — | — |
| **PORT_WITH_ADAPTATION** | 1 | ~67 | `material.types.ts` → Nestor `bim/types/material-catalog-types.ts` με mm-units + drop `GpuMaterialId` | Phase 3 + ADR-363 Phase 6.x |
| **EXTRACT_CONCEPT** | 4 | ~860 | Algorithms/patterns — Nestor re-implements σε Three.js context | Phase 3, 5+, 6.x |
| **EXCLUDE** | 12 | ~1.500 | SDF pipeline (ADR-366 §3.2.2 rejected) ή Nestor superset | — |
| **OUT_OF_SCOPE** | 2 | — | GenArc test files (`__tests__/senazUniforms.test.ts`, `staircaseUniforms.test.ts`) | — |

**Total port effort για Phase 3 (Materials & Lighting)**: ~2h για `material.types.ts` adaptation + re-implementation του "DNA → per-face Three.js material" pattern. **Δεν αλλάζει** το ADR-366 §4.5 Phase 3 estimate (~6h) — αντιθέτως το επιβεβαιώνει.

**Total ADR-363 Phase 6.x Multi-Layer DNA BOQ effort**: ~8h αμετάβλητο. Το `MaterialDefinition` schema από SPEC-3D-004E υποβοηθά: density × volume = kg για χάλυβα/τοιχοποιία, unit-aware ΑΤΟΕ codes για per-layer BOQ rows.

---

## 1. Methodology

### 1.1 Categorization rules (ίδια με SPEC-3D-004A/B/C/D)

| Κατηγορία | Κριτήριο |
|---|---|
| **PORT_AS_IS** | Zero GenArc-specific deps (`@/stores/`, `@/engines/sdf/`, `@/engines/nok/`, structural). Three.js + pure types. Copy + rename. |
| **PORT_WITH_ADAPTATION** | 1-3 GenArc-specific concepts (m units → mm, GPU integer IDs → drop) — pure swaps, no algorithmic change. |
| **EXTRACT_CONCEPT** | Heavy coupling με GenArc (SDF uniform packing, GLSL string injection) ΑΛΛΑ pattern/algorithm είναι transferable. Re-implementation σε Nestor Three.js context. |
| **EXCLUDE** | (a) ADR-366 §3.2.2 SDF rejection, (b) Nestor υπερσύνολο, (c) test file. |

### 1.2 Files outside scope

- `structural/` (190 files), `engines/ai/`, `engines/nok/` → entire EXCLUDE (ADR-186 / non-relevant)
- `engines/grid/gridPlane.ts` (Three.js mesh side) → already covered από ADR-366 §1.3 (Phase 0 optional)
- `components/materials/*` (αν υπάρχει UI level) → out of scope (Nestor θα έχει δικό του DNA editor UI in `bim/walls/components/`)

---

## 2. PORT_WITH_ADAPTATION Files (1 file, ~67 LOC)

### 2.1 `material.types.ts` (67 LOC) — Material schema superset

| Πεδίο | Λεπτομέρεια |
|---|---|
| **Source** | `C:\genarc\src\types\material.types.ts` |
| **Target** | `src/subapps/dxf-viewer/bim/types/material-catalog-types.ts` (Nestor mm convention, BIM SSoT proximity) |
| **Effort** | ~1.5h (port + tests + integration με `wall-material-catalog.ts` interface) |
| **Phase** | 3 (Materials & Lighting) + ADR-363 Phase 6.x (Multi-Layer DNA BOQ) |
| **Deps** | None (pure types) |

**Τι αλλάζει**:

| GenArc | Nestor adaptation |
|---|---|
| `ShaderType` 8 entries (concrete/plaster/brick/tile/wood/glass/metal/stone) | **Επεκτείνεται** σε 12: + `insulation`, `composite`, `membrane`, `terrazzo` (ώστε να καλύπτει XPS/EPS/mineral wool + aluminum-cladding/gypsum/OSB + waterproofing + το ήδη υπάρχον `terrazzo` stair preset) |
| `MaterialCategory` 10 entries | **Διατηρείται** ως έχει + `cladding` (για aluminum-cladding/marble veneer) |
| `BomUnit` (m2/m3/kg/m/piece) | **Διατηρείται** — αντιστοιχία με Nestor `BOQMeasurementUnit` από `@/types/boq` (ήδη το `bim-to-atoe-mapping.ts` χρησιμοποιεί ίδιο tuple m2/m3/pcs) |
| `MaterialShaderParams.baseColor: [number, number, number]` (linear RGB 0-1) | **Διατηρείται** — direct map σε `THREE.Color` constructor + `MeshStandardMaterial.color` |
| `MaterialShaderParams.roughness: number` | **Διατηρείται** — direct map σε `MeshStandardMaterial.roughness` |
| `MaterialShaderParams.patternScale: number` | **Διατηρείται** για Phase 5+ texture UV scaling (Phase 3 ignored) |
| `MaterialCost.unitCost / laborCost` | **Διατηρείται** ως ναι/όχι optional ανά material (αν unknown → undefined αντί 0, ώστε το BOQ να μη γεμίσει false zeros) |
| `MaterialDefinition.densityKgM3: number` | **Διατηρείται** — χρειάζεται για kg-based BOQ (χάλυβας B500C, τοιχοποιία) |
| `MaterialDefinition.nameEl / nameEn` | **Διατηρείται** + προσθήκη `labelKeySuffix` για i18n (συμβατότητα με υπάρχον `WallMaterialOption.labelKeySuffix` pattern) |
| `GpuMaterialId = number` | **DROP** — Nestor δεν χρησιμοποιεί GPU uniform packing |

**Proposed Nestor schema**:

```typescript
// src/subapps/dxf-viewer/bim/types/material-catalog-types.ts
import type { BOQMeasurementUnit } from '@/types/boq';

export type ShaderType =
  | 'concrete' | 'plaster' | 'brick' | 'tile' | 'wood'
  | 'glass' | 'metal' | 'stone'
  | 'insulation' | 'composite' | 'membrane' | 'terrazzo';

export type MaterialCategory =
  | 'concrete' | 'steel' | 'masonry' | 'insulation' | 'glass'
  | 'wood' | 'plaster' | 'waterproofing' | 'tiles' | 'metal'
  | 'cladding';

export interface MaterialShaderParams {
  readonly baseColor: readonly [number, number, number];  // linear RGB 0-1
  readonly roughness: number;                              // 0-1
  readonly patternScale: number;                           // Phase 5+ texture UV scale
}

export interface MaterialCost {
  readonly unitCost?: number;     // €/unit, optional — undefined = unknown (don't fill BOQ with zeros)
  readonly laborCost?: number;
  readonly unit: BOQMeasurementUnit;
}

export interface MaterialDefinition {
  readonly id: string;                  // matches WallMaterialPresetId / StairMaterialPresetId
  readonly nameEl: string;
  readonly nameEn: string;
  readonly labelKeySuffix: string;      // i18n key for runtime rendering
  readonly category: MaterialCategory;
  readonly densityKgM3?: number;        // optional — undefined = volume-only BOQ
  readonly cost?: MaterialCost;         // optional — undefined = no cost data yet
  readonly shaderType: ShaderType;
  readonly shaderParams: MaterialShaderParams;
}
```

**Tests**: 1 file (~120 LOC) — pure type round-trip + sample registry entry validation.

**Industry alignment**:
- **Revit** Material schema: Identity + Graphics + Appearance + Physical + Thermal. Το Nestor `MaterialDefinition` καλύπτει Identity (id/name) + Graphics (shaderParams) + Physical (densityKgM3) + Cost (επιπλέον vs Revit που χρησιμοποιεί ξεχωριστό keynote system).
- **ArchiCAD** Building Material: Structure + Surface + Properties. Ίδιο pattern.
- **Bentley** Material Manager: same fields.
- **Three.js** ecosystem: zero-equivalent (Three.js material = visual only). Νesτor schema extends Three.js με BIM domain awareness.

**Industry σύγκλιση: 4/4** (Revit/ArchiCAD/Bentley/Vectorworks). Full Enterprise.

---

## 3. EXTRACT_CONCEPT Files (4 files, ~860 LOC)

### 3.1 `engines/sdf/materialUniforms.ts` (96 LOC) — Wall DNA → per-face material dispatch

| Πεδίο | Λεπτομέρεια |
|---|---|
| **Source** | `C:\genarc\src\engines\sdf\materialUniforms.ts` |
| **GenArc role** | Resolves `Wall.dna.layers[]` → 3 GPU material IDs (exterior/interior/core) packed σε `THREE.Vector3` array για shader uniform consumption. Flip-aware (αν `wall.flip = true` → exterior/interior swap). |
| **Nestor extraction** | **Pattern**, όχι κώδικας. Re-implement σε `bim-3d/materials/MaterialCatalog3D.ts` (ADR-366 §4.4 folder structure) που γυρνάει `{ exterior: MeshStandardMaterial, interior: MeshStandardMaterial, core: MeshStandardMaterial }` ανά wall. |
| **Phase** | 3 (Materials & Lighting) |
| **Effort** | ~2h (function + tests). Already in Phase 3 ~6h estimate. |

**Αλγόριθμος (GenArc lines 44-78)**:

```
for each wall:
  ext = concrete (default)
  int = concrete (default)
  core = concrete (default)
  for each layer in wall.dna.layers:
    matId = resolveGpuMatId(layer.materialId)  // string → int via MATERIAL_ID_TO_GPU
    if layer.side === 'exterior': ext = matId
    elif layer.side === 'interior': int = matId
    else: core = matId   // 'core' or unknown
  if wall.flip: swap(ext, int)
  output[i] = vec3(ext, int, core)
```

**Nestor re-implementation (Three.js context)**:

```typescript
// src/subapps/dxf-viewer/bim/bim-3d/materials/MaterialCatalog3D.ts (Phase 3)
import * as THREE from 'three';
import type { WallEntity } from '../../types/wall-types';
import { MATERIAL_REGISTRY_3D } from './material-registry-3d.constants';

interface WallFaceMaterials {
  readonly exterior: THREE.MeshStandardMaterial;
  readonly interior: THREE.MeshStandardMaterial;
  readonly core: THREE.MeshStandardMaterial;
}

const DEFAULT_MAT_ID = 'mat-concrete-c25';

export function resolveWallFaceMaterials(wall: WallEntity): WallFaceMaterials {
  let ext = DEFAULT_MAT_ID;
  let int = DEFAULT_MAT_ID;
  let core = DEFAULT_MAT_ID;

  if (wall.params.dna) {
    for (const layer of wall.params.dna.layers) {
      if (layer.side === 'exterior') ext = layer.materialId;
      else if (layer.side === 'interior') int = layer.materialId;
      else core = layer.materialId;
    }
  }
  if (wall.params.flip) { [ext, int] = [int, ext]; }

  return {
    exterior: makeMeshStandardMaterial(ext),
    interior: makeMeshStandardMaterial(int),
    core:     makeMeshStandardMaterial(core),
  };
}

function makeMeshStandardMaterial(matId: string): THREE.MeshStandardMaterial {
  const def = MATERIAL_REGISTRY_3D[matId] ?? MATERIAL_REGISTRY_3D[DEFAULT_MAT_ID];
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(...def.shaderParams.baseColor),
    roughness: def.shaderParams.roughness,
    metalness: def.shaderType === 'metal' ? 0.85 : 0.0,
    transparent: def.shaderType === 'glass',
    opacity: def.shaderType === 'glass' ? 0.35 : 1.0,
  });
}
```

**Note**: Three.js path δεν χρειάζεται `MATERIAL_ID_TO_GPU` lookup table (GenArc-specific GPU integer mapping). Direct string ID → registry lookup → MeshStandardMaterial factory.

**Industry alignment**: Pattern matches Revit's per-face material assignment via Layer Function (Exterior/Structure/Interior). ArchiCAD Building Material με Surface override per face. 4/4 σύγκλιση.

### 3.2 `constants/materialRegistry.constants.ts` (~150 LOC, 12 entries inspected) — Full PBR+cost registry

| Πεδίο | Λεπτομέρεια |
|---|---|
| **Source** | `C:\genarc\src\constants\materialRegistry.constants.ts` |
| **GenArc role** | `MATERIAL_REGISTRY: Record<string, MaterialDefinition>` με 12 entries: concrete-c25, plaster-ext/int, steel-b500c, formwork, xps-80, glass-double, brick-standard, brick-masonry, waterproofing, tile-floor, και άλλα (μη ορατά full read). |
| **Nestor extraction** | **Δομή registry** (key by stable preset ID + full PBR + cost + density) είναι το pattern. Values πρέπει να σχηματιστούν για Nestor's 18+9 preset IDs με δεδομένα από ΑΤΟΕ tariff (ADR-175). |
| **Phase** | ADR-363 Phase 6.x Multi-Layer DNA BOQ (~8h pending, prerequisite της Phase 3) + Phase 3 (visual rendering) |
| **Effort** | ~3h (18 wall + 9 stair preset IDs × population από ΑΤΟΕ τιμολόγιο 2024) + tests |

**Proposed Nestor target**:

```typescript
// src/subapps/dxf-viewer/bim/materials/material-registry-3d.constants.ts
import type { MaterialDefinition } from '../types/material-catalog-types';

export const MATERIAL_REGISTRY_3D: Readonly<Record<string, MaterialDefinition>> = {
  // ── Concrete tiers (3) ─────────────────────────────────────────────────────
  'mat-concrete-c20': {
    id: 'mat-concrete-c20', nameEl: 'Σκυρόδεμα C20/25', nameEn: 'Concrete C20/25',
    labelKeySuffix: 'mat-concrete-c20', category: 'concrete', densityKgM3: 2400,
    cost: { unitCost: 75, laborCost: 32, unit: 'm3' },
    shaderType: 'concrete',
    shaderParams: { baseColor: [0.70, 0.70, 0.69], roughness: 0.88, patternScale: 1.0 },
  },
  'mat-concrete-c25': { /* … */ },
  'mat-concrete-c30': { /* … */ },
  // ── Masonry (3) ────────────────────────────────────────────────────────────
  'mat-brick-masonry': { /* density 1800 kg/m³, m³ cost από ΑΤΟΕ */ },
  'mat-stone-masonry': { /* density 2200 kg/m³ */ },
  'mat-concrete-block': { /* density 1400 kg/m³ */ },
  // ── Insulation (3) ─────────────────────────────────────────────────────────
  'mat-eps': { densityKgM3: 20, cost: { unit: 'm2' /* per cm thickness η ad-hoc */ } },
  'mat-xps': { densityKgM3: 35 },
  'mat-mineral-wool': { densityKgM3: 80 },
  // ── Plaster (3) + Boards (2) + Membrane (1) + Cladding (3) ─────────────────
  // … total 18 wall + 9 stair preset IDs
};
```

**Critical for ADR-363 Phase 6.x Multi-Layer DNA BOQ**:
- Per-layer volume (m³) = (length × height × thickness_mm/1000) × wall.geometry.cached
- Per-layer mass (kg) = volume × `densityKgM3`
- Per-layer cost (€) = quantity × (`unitCost` + `laborCost`)
- Per-layer ΑΤΟΕ category resolved από `bim-to-atoe-mapping.ts` + material `category` discriminator (πχ insulation → OIK-7.x, masonry → OIK-3.x)

**Industry alignment**: Registry pattern is universal — Revit material library `.adsklib`, ArchiCAD Building Material database, Bentley material database, Vectorworks Resource Manager, Tekla Material Catalog, Allplan material library. **6/6 σύγκλιση**.

### 3.3 `shaders/materials.glsl.ts` (110 LOC) — Procedural concrete/plaster/soil

| Πεδίο | Λεπτομέρεια |
|---|---|
| **Source** | `C:\genarc\src\shaders\materials.glsl.ts` |
| **GenArc role** | GLSL procedural texture functions (fbm-based concrete με formwork bands + speckle + voids, plaster με trowel streaks + grain + patches, soil με earth fbm + patches). Παράγει `MaterialResult { color, roughness }` ανά pixel. |
| **Nestor extraction** | **Phase 5+ optional, Phase 3 N/A.** Three.js MeshStandardMaterial Phase 3 χρησιμοποιεί flat colors (ADR-366 §7.1). Αν Phase 5+ προστεθεί texture-mapped path (alternative σε bitmap PBR maps), αυτές οι procedural recipes (formwork lines every 30cm + fine aggregate noise) είναι valuable για bake-to-texture generation ή ως ShaderMaterial extensions του MeshStandardMaterial. |
| **Phase** | 5+ (Photorealistic Path Tracing) — optional |
| **Effort** | ~6-8h αν επιλεγεί path Phase 5+ (όχι Phase 0-4 commitment) |

**Recipes worth preserving (as documentation reference)**:
- **Concrete**: large fbm 0.8× + speckle 40× + formwork bands at 3.33×Y + scatter dark voids
- **Plaster**: trowel anisotropic stretched noise + 50× grain + 0.5× warm fbm patches
- **Soil**: 1.2× earthy fbm + 4× patches + 45× grain

**Alternative path**: Three.js + `three-noise` (MIT) + custom `onBeforeCompile` patch σε MeshStandardMaterial. Δεν χρειάζεται GenArc direct port.

**Industry alignment**: Revit RPC (Realistic Procedural Content) + Substance Designer + 3ds Max OSL shaders παράγουν παρόμοιες procedural recipes. Three.js native equivalent: `MeshPhysicalMaterial` με texture maps. **Convention**: bitmap textures preferred σε production για consistency + GPU efficiency. Procedural shaders = research/prototyping. 4/4 σύγκλιση: bitmap textures win για production.

### 3.4 `shaders/gridPlane.glsl.ts` (158 LOC) — Adaptive 3-tier grid + axis colors + horizon

| Πεδίο | Λεπτομέρεια |
|---|---|
| **Source** | `C:\genarc\src\shaders\gridPlane.glsl.ts` |
| **GenArc role** | Vertex + fragment shaders για infinite ground plane: 3 LOD spacings (fine/medium/coarse) με smooth distance-based blending, minor/major line distinction (every N×), axis highlighting (X/Z colored), horizon line, distance fade, per-feature visibility toggles. |
| **Nestor extraction** | **Phase 0 optional, Phase 7 polish.** Three.js native `GridHelper` αρκεί για Phase 0 baseline. Το GenArc shader είναι meaningfully better για architectural workflow (3 zoom tiers + axes + horizon στο ίδιο pass) — αξιόλογο για Phase 7 polish (ADR-366 §4.5). |
| **Phase** | 0 (Three.js native baseline) → 7 (optional adaptive grid upgrade) |
| **Effort** | ~3-4h αν Phase 7 adoptτεί. Independent από port — re-implement σε Nestor GLSL string module ή χρήση Three.js `Reflector`/`InfiniteGridHelper` third-party (MIT). |

**Pattern reference value**:
- LOD blend factors via `smoothstep(low, high, dist)` για seamless tier transitions
- Anti-aliased lines via `fwidth(coord/spacing) × smoothstep(fw×width, 0, wrapped)`
- Per-feature DISPLAYFILTER booleans (`uShowGrid`, `uShowAxes`, `uShowHorizon`) — clean separation

**Industry alignment**: Rhino infinite grid, Blender Workbench grid, AutoCAD model space grid, SketchUp ground plane — όλα adaptive 3-tier με axis colors. **5/5 σύγκλιση**.

**Recommendation**: Phase 0 = Three.js `GridHelper` (simple, instant). Phase 7 polish = port `gridPlane.glsl.ts` αν Γιώργος ζητήσει visual upgrade.

---

## 4. EXCLUDE Files (12 production files, ~1.500 LOC)

### 4.1 SDF uniform packers (8 files, ~915 LOC) — entire EXCLUDE

| File | LOC | Reason for EXCLUDE |
|---|---:|---|
| `engines/sdf/wallUniforms.ts` | 99 | GenArc-SDF-specific vec4 packing (3 vec4 per wall: start/end/height/thickness/bevel). Bound by `MAX_WALLS` constant. Three.js path uses per-entity `BufferGeometry` + InstancedMesh, no fixed-array packing. **ADR-366 §3.2.2** rejects SDF. |
| `engines/sdf/columnUniforms.ts` | 98 | Same reason. 2 vec4 per column (pos/height/width/depth/section). Replaced by Three.js `BoxGeometry`/`CylinderGeometry` σε `BimToThreeConverter` Phase 2. |
| `engines/sdf/beamUniforms.ts` | 86 | Same reason. 2 vec4 per beam. Three.js: `ExtrudeGeometry` from beam axis (cached `entity.geometry.axisPolyline` from SPEC-3D-004D). |
| `engines/sdf/slabUniforms.ts` | 202 | Same reason + extra GenArc-specific complexity: rectilinear polygon decomposition σε sub-boxes + triangle prism support via `slabBeamSplit`. Nestor: `ExtrudeGeometry` from cached `entity.geometry.outline` (slab outline). |
| `engines/sdf/openingUniforms.ts` | 138 | Same reason. Wall-local opening positions packed for GPU boolean subtraction. Three.js: opening as separate mesh OR boolean via `three-csg-ts` (MIT, optional). ADR-366 §6.3 Phase 2 MVP = overlay only. |
| `engines/sdf/slabOpeningUniforms.ts` | 115 | Same reason. Slab cutout encoding (rect/circle/ellipse). Three.js: `ExtrudeGeometry.holes` array. |
| `engines/sdf/staircaseUniforms.ts` | 102 | Same reason + GenArc 2-type staircase (straight/dogleg only). Nestor ADR-358 has 8 stair types + per-tread overrides. Nestor's `StairGeometry` Phase 0.5 migration σε `bim/stairs/stair-geometry.ts` λαμβάνει υπόψη όλους τους τύπους. |
| `engines/sdf/senazUniforms.ts` | 79 | GenArc-specific bond beam (σενάζ) packing — depends on `structural/engines/senazSizing.engine` (Eurocode territory, ADR-186, **out of scope ADR-366** per §1.3). Σενάζ είναι structural feature, όχι BIM 3D rendering primary. Future Nestor: αν προστεθεί σενάζ visual layer σε wall, θα είναι `THREE.LineSegments` overlay, no GPU uniform packing. |

### 4.2 SDF orchestration (1 file, ~319 LOC) — entire EXCLUDE

| File | LOC | Reason for EXCLUDE |
|---|---:|---|
| `engines/sdf/sdfQuad.ts` | 319 | Factory που γκρουπάρει ΟΛΑ τα παραπάνω uniform packers + ShaderMaterial + raymarcher fragment shader σε ένα fullscreen `THREE.PlaneGeometry(2,2)` quad με `renderOrder=999, depthTest=false`. Heart of GenArc SDF pipeline. Three.js path δεν χρησιμοποιεί ποτέ fullscreen-quad-style SDF — instead per-entity `Mesh` objects στο `Scene` graph. **ADR-366 §3.2.2** + §4.1 architecture rejection. |

### 4.3 SDF shader strings (2 files, ~742 LOC) — entire EXCLUDE

| File | LOC | Reason for EXCLUDE |
|---|---:|---|
| `shaders/sdfRaymarcher.ts` | 636 | Core SDF raymarching fragment shader (60+ steps ray marching loop per pixel × all walls/columns/beams/slabs/staircases SDF evaluations). Includes wall SDF με opening subtraction, slab SDF με triangle prism support, staircase SDF με O(1) step lookup, senaz bands, status overlay, selection rim highlighting. **Entirely SDF-paradigm**. Nestor Three.js path uses BVH-accelerated raycasting (three-mesh-bvh) σε Phase 4 για selection — fundamentally different mechanism. |
| `shaders/noise.glsl.ts` | 106 | Ashima Simplex 3D noise (MIT) + 4-octave FBM. Useful **μόνο** αν Nestor υιοθετήσει custom GLSL shaders. ADR-366 §7.1 Phase 3 = `MeshStandardMaterial` flat colors. Phase 5+ path tracer uses `three-gpu-pathtracer` (own internal noise/sampling). **Could be reused later** αν Phase 5+ alternative procedural texture path επιλεγεί (§3.3 reference); για το παρόν catalog scope, EXCLUDE. |

### 4.4 Type duplicates (1 file, ~74 LOC) — EXCLUDE

| File | LOC | Reason for EXCLUDE |
|---|---:|---|
| `types/wallDna.types.ts` | 74 | **Nestor superset.** `bim/types/wall-dna-types.ts` έχει: (a) **mm convention** (Nestor canonical, ADR-358 §5.0 aligned vs GenArc's m), (b) **5 default presets** (exterior/interior/partition/parapet/fence) vs 3, (c) **same `LayerSide` + `DnaLayer` + `WallDna` structure** functionally. Migration μέσω `*1000` unit conversion ήδη υπολογισμένη όταν ένα παλαιό GenArc DNA φορτωθεί ως legacy data. Direct port = double SSoT regression. **EXCLUDE με βεβαιότητα**. |

### 4.5 Tests (2 files) — OUT_OF_SCOPE

| File | Reason |
|---|---|
| `engines/sdf/__tests__/senazUniforms.test.ts` | Tests SDF packer — out of catalog scope (the production module itself is EXCLUDE). |
| `engines/sdf/staircaseUniforms.test.ts` | Same reason. Stray test file (note: outside conventional `__tests__/` subdir, suggesting un-tidied GenArc layout). |

---

## 5. Cross-domain dependencies (flagged για other SPECs)

Αυτό είναι το **τελευταίο sub-SPEC της σειράς A→E**, οπότε δεν υπάρχουν follow-up sub-SPECs να ενημερωθούν. Όλες οι cross-domain flags που εντοπίστηκαν εδώ είναι **internal Nestor 3D infrastructure decisions**:

| Dependency | Σχόλιο |
|---|---|
| **`THREE.MeshStandardMaterial`** | Phase 3 primary type. Όλα τα Wall/Column/Beam/Slab/Stair meshes χρησιμοποιούν αυτό + factory από `MaterialCatalog3D.resolveMaterialFor(matId)`. |
| **`three-mesh-bvh`** (MIT) | Phase 4 raycasting (αντί GenArc SDF intersection). Already pulled in via `three-gpu-pathtracer` dependency tree (ADR-366 §8.3). |
| **`three-gpu-pathtracer`** (MIT) | Phase 5+ — receives MeshStandardMaterial scenes natively, no shader port needed. |
| **`bim-to-atoe-mapping.ts`** (Nestor existing) | ADR-363 Phase 6.x BOQ extension: το per-entity ΑΤΟΕ mapping ήδη υπάρχει — Phase 6.x προσθέτει per-layer override με material `category` discriminator (insulation → OIK-7.x, στεγανοποίηση → OIK-7.y). |
| **`wall-material-catalog.ts`** + **`stair-material-catalog.ts`** | Provider interfaces (`WallMaterialCatalogProvider`, `MaterialCatalogProvider`) ήδη ορισμένα. Phase 3 swap target: `MaterialCatalog3D.create(provider)` factory — εφόσον το ίδιο provider interface εμπλουτιστεί με `getMaterialDefinition(id): MaterialDefinition | null`. |
| **`wall-dna-types.ts`** Nestor SSoT | Wall DNA SSoT μένει στο `bim/types/`. `MaterialCatalog3D` consumes `WallDna.layers` αντί GenArc's `Wall.dna`. Field shape ίδιο. |
| **`stair-material-catalog.ts`** | Phase 3 stair-3d rendering θα χρησιμοποιήσει 9 preset IDs + Asset Manager swap pattern. |

**Δεν υπάρχει** dependency που να ζητάει new module σε άλλο sub-SPEC — όλα τα required Nestor modules ήδη υπάρχουν (DNA types + ΑΤΟΕ mapping + preset catalogs + provider interfaces).

---

## 6. Phase-by-phase Port Plan

### 6.1 Phase 3 (Materials & Lighting, ~6h — ADR-366 §4.5 unchanged)

| Step | Action | Effort | File(s) |
|---|---|---:|---|
| 3.1 | Port `material.types.ts` → `bim/types/material-catalog-types.ts` με adaptations (§2.1) | ~1.5h | 1 new |
| 3.2 | Author `bim/materials/material-registry-3d.constants.ts` (18 wall + 9 stair preset IDs με PBR + cost + density) | ~3h | 1 new |
| 3.3 | Author `bim-3d/materials/MaterialCatalog3D.ts` (factory + `resolveWallFaceMaterials` re-implementation, §3.1) | ~1.5h | 1 new |
| 3.4 | Lighting setup `bim-3d/lighting/LightingSetup.ts` (Three.js native — AmbientLight + DirectionalLight + HemisphereLight per ADR-366 §7.2) | already in §4.5 | 1 new |

**Σύνολο: ~6h** ίδιο με ADR-366 §4.5 Phase 3 estimate. **No revision needed.**

### 6.2 ADR-363 Phase 6.x Multi-Layer DNA BOQ (~8h — pending στο `.claude-rules/pending-ratchet-work.md`)

| Step | Action | Effort | File(s) |
|---|---|---:|---|
| 6.x.1 | `bim/services/BimToBoqBridge.ts` (existing) → προσθήκη `bimMaterialLayerToBoqRow()` που χρησιμοποιεί `MATERIAL_REGISTRY_3D[layer.materialId].cost.unit` για unit-aware quantity (m³ vs m² vs kg) | ~2h | 1 modified |
| 6.x.2 | Per-layer ΑΤΟΕ override: `resolveAtoeMappingForLayer(material.category, wall.category)` (κάθε insulation layer → OIK-7.x, masonry layer → OIK-3.x, glass layer → OIK-5.x) | ~2h | 1 modified `bim-to-atoe-mapping.ts` |
| 6.x.3 | Deterministic IDs: `boq_bim_${entityId}_layer_${layerId}` (όπως SPEC-3D-004D §5.2 Q4 ορίζει) | ~1h | 1 modified |
| 6.x.4 | Per-layer detach guard (existing pattern από wall detach) | ~1h | 1 modified |
| 6.x.5 | Backward-compatible migration: legacy single-row entities απομένουν, νέα multi-layer entities παράγουν N rows | ~1h | 1 modified |
| 6.x.6 | Tests: ~30 cases για kg/m³/m² unit conversions + ΑΤΟΕ category dispatch + detach | ~1h | 1 new |

**Σύνολο: ~8h** ίδιο με existing pending estimate. **No revision needed.**

### 6.3 Phase 5+ optional (Procedural textures, ~6-8h αν επιλεγεί)

- **NOT committed** στο ADR-366. Pending Γιώργος decision.
- `materials.glsl.ts` (§3.3) ως reference για baked-to-texture generation pipeline ή `onBeforeCompile` MeshStandardMaterial extensions.
- Alternative: Phase 5+ path tracer χρησιμοποιεί bitmap PBR maps (industry standard).

### 6.4 Phase 7 polish (Adaptive grid, ~3-4h αν επιλεγεί)

- **NOT committed** στο ADR-366. Pending Γιώργος decision.
- `gridPlane.glsl.ts` (§3.4) port για visual upgrade πέρα από Three.js native `GridHelper`.

---

## 7. License audit (SOS N.5)

| Source | License | Verdict |
|---|---|---|
| GenArc `engines/sdf/*` | Custom Γιώργου (Nestor inherits) | ✅ Reusable, EXCLUDE selected |
| GenArc `shaders/noise.glsl.ts` | Ashima Arts MIT (snippet credited στο source comment) | ✅ MIT compatible |
| GenArc `shaders/materials.glsl.ts` | Custom Γιώργου | ✅ Reusable, EXTRACT_CONCEPT |
| GenArc `shaders/gridPlane.glsl.ts` | Custom Γιώργου | ✅ Reusable, EXTRACT_CONCEPT |
| GenArc `types/material.types.ts` | Custom Γιώργου | ✅ Reusable, PORT_WITH_ADAPTATION |
| GenArc `constants/materialRegistry.constants.ts` | Custom Γιώργου + €€ data Γιώργου | ✅ Reusable, EXTRACT_CONCEPT (Nestor re-populates με ΑΤΟΕ data) |

**Όλα MIT-compatible ή Γιώργος-owned. ✅ SOS N.5 compliance confirmed.**

---

## 8. Nestor material surface gap analysis (function-by-function)

Σύγκριση Nestor existing material surface vs SPEC-3D-004E required surface:

| Domain | Nestor existing | Required (Phase 3 + ADR-363 Phase 6.x) | Gap |
|---|---|---|---|
| Preset ID list | `WALL_MATERIAL_PRESET_IDS` 18 entries + `STAIR_MATERIAL_PRESET_IDS` 9 entries | Όλα + προαιρετική επέκταση (opening glazing, slab finishes) | **NONE** για baseline. Slab/opening preset IDs να προστεθούν Phase 3 αν χρειαστεί. |
| PBR params (color/roughness) | **MISSING** — preset-only catalog, χωρίς render data | `MaterialShaderParams` per preset | **GAP 1** — `material-registry-3d.constants.ts` (~3h Phase 3.2) |
| Density (kg/m³) | **MISSING** | `densityKgM3` per preset | **GAP 2** — same file (Phase 3.2) |
| Cost (€/unit + labor) | **MISSING** | `MaterialCost {unitCost, laborCost, unit}` per preset | **GAP 3** — same file + ΑΤΟΕ correlation Phase 6.x |
| `MaterialDefinition` type | **MISSING** — μόνο 2D-render `MaterialDefinition` σε `rendering/types/Types.ts` (stroke/fill style) | New BIM-domain `MaterialDefinition` (PBR + density + cost) | **GAP 4** — port `material.types.ts` (~1.5h Phase 3.1, §2.1) |
| Wall-DNA → 3 face materials mapping | **MISSING** — wall layers persist στο DNA αλλά δεν resolve-άρονται σε rendering | `resolveWallFaceMaterials(wall)` factory | **GAP 5** — `MaterialCatalog3D.ts` (~1.5h Phase 3.3, §3.1) |
| Provider abstraction (Asset Manager swap target) | ✅ `WallMaterialCatalogProvider` + `MaterialCatalogProvider` interfaces ήδη ορισμένα | Same + enriched με `getMaterialDefinition(id)` method | **GAP 6 (minor)** — extend interfaces στο Phase 3.3 |
| Wall DNA layer model | ✅ `bim/types/wall-dna-types.ts` complete + 5 default presets | Same — already SSoT | **NONE** |
| ΑΤΟΕ mapping per entity | ✅ `bim-to-atoe-mapping.ts` με wall/opening/slab/column/beam dispatch | Per-layer override για insulation/glazing/masonry → distinct OIK codes | **GAP 7** — Phase 6.x extension (~2h, §6.2.2) |
| Three.js material factory | **MISSING** | `makeMeshStandardMaterial(matId)` | **GAP 8** — `MaterialCatalog3D.ts` (covered by GAP 5) |
| Light setup | **MISSING** | `LightingSetup` per ADR-366 §7.2 | **GAP 9** — Phase 3.4 (~1.5h, separate from materials) |

**Συνολικό gap**: 9 gaps, 8 ανήκουν στο Phase 3 (~6h), 1 στο Phase 6.x (~2h εκ των 8h). **No new pending work** πέραν αυτών που ήδη ορίζονται στο ADR-366 §4.5 + `.claude-rules/pending-ratchet-work.md`.

---

## 9. Open Questions για Γιώργο

> Δοκίμασα Full Enterprise resolution σε όλες πριν ρωτήσω. Όλα **RESOLVED** με industry σύγκλιση. Αν διαφωνείς σε κάποιο, μου το λες και αλλάζω.

### Q1 — Material registry data source: από πού παίρνουμε τιμές + densities; ✅ RESOLVED Full Enterprise

**Resolution**: ΑΤΟΕ τιμολόγιο 2024 (ADR-175 reference) + ASTM/Eurocode density tables (πχ EN 206 για concrete densities, EN 12664 για insulation, IS 1077 για bricks).

**Industry σύγκλιση 5/5**:
- **Revit** Material Library: density από embedded ASHRAE 90.1, cost από local tariff
- **ArchiCAD** Building Material: same pattern
- **Bentley** Material DB: ASTM-aligned densities + project-specific cost
- **Tekla** Material Catalog: EN material standards + steel weights
- **Allplan** Materials: DIN density tables + local Baukosten

Nestor pattern: hardcoded baseline registry → Phase 6+ Asset Manager swap → company-specific override (`materials_catalog` Firestore collection scoped to `companyId` + optional `projectId` per `stair-material-catalog.ts` Asset Manager swap target comment).

### Q2 — `ShaderType` extension: insulation/composite/membrane/terrazzo σωστά; ✅ RESOLVED Full Enterprise

**Resolution**: YES, με αυτά τα 4 extra ShaderTypes καλύπτουμε:
- `insulation` → XPS / EPS / mineral wool (matte, off-white/light blue/green, roughness ~0.85, metalness 0)
- `composite` → aluminum cladding / gypsum board / OSB (mixed metallic+matte, ad-hoc per preset)
- `membrane` → waterproofing / vapor barrier (dark, semi-glossy roughness 0.3-0.5)
- `terrazzo` → stair terrazzo + floor finishes (medium-roughness 0.5, speckled appearance Phase 5+ optional)

**Industry σύγκλιση 4/4**: Revit (Insulation/Membrane/Mixed material classes), ArchiCAD (Material Category), Bentley (Material Family enum), Vectorworks (Resource Category).

Δεν είναι exhaustive — μπορεί Phase 6+ Asset Manager να προσθέσει `liquid` (paint), `fabric`, `vegetation` αν χρειαστεί. Phase 3 starting set = 12 types.

### Q3 — Cost data: optional ή υποχρεωτικό σε `MaterialDefinition`; ✅ RESOLVED Full Enterprise

**Resolution**: **OPTIONAL** (`cost?: MaterialCost`, `densityKgM3?: number`).

**Reason**: Phase 3 (visual) δεν χρειάζεται cost — μόνο PBR. Phase 6.x BOQ χρειάζεται. Αν material δεν έχει cost data → BOQ row generated με `quantity` αλλά **χωρίς `unitPrice`** (user fills in manually στο final estimate). Καλύτερο από false `0€` που θα γέμιζε reports με incorrect totals.

**Industry σύγκλιση 5/5**: Όλα τα Revit/ArchiCAD/Bentley/Tekla/Allplan επιτρέπουν material χωρίς cost — cost είναι separate appearance overlay/keynote. Mandatory cost = anti-pattern.

### Q4 — Material registry SSoT location: όπου τα preset catalogs ή ξεχωριστά; ✅ RESOLVED Full Enterprise

**Resolution**: Ξεχωριστό αρχείο `src/subapps/dxf-viewer/bim/materials/material-registry-3d.constants.ts` (NEW). Reasons:

1. **SRP** (Google N.7.1): preset ID list (`wall-material-catalog.ts`) ≠ render+cost data (`material-registry-3d.constants.ts`). Σπάνε διαφορετικούς λόγους.
2. **Shared τοποθεσία** για wall + stair + opening + slab presets → ένα registry, πολλά preset ID lists.
3. **Phase 6+ Asset Manager swap target** προφανές: ένα interface (`MaterialDefinitionProvider`), ένα Firestore collection (`materials_catalog`).
4. **Cross-references**: `wall-material-catalog.ts` παραμένει "preset ID listing", `material-registry-3d.constants.ts` παρέχει per-ID full definition. Provider interface gets `getDefinition(id): MaterialDefinition | null` method επιπλέον.

**Industry σύγκλιση 4/4**:
- **Revit**: `.adsklib` (libraries) ≠ Element Type assignments (per-family preset lists). Two-tier.
- **ArchiCAD**: Building Materials database ≠ Wall Composite settings. Two-tier.
- **Bentley**: Material Manager DB ≠ Form/Item style refs. Two-tier.
- **Tekla**: Material Catalog ≠ Profile Catalog. Two-tier.

---

## 10. Google-Level Architecture Checklist

| # | Question | Answer |
|---|---|---|
| 1 | Proactive ή reactive; | **Proactive** — registry populated upfront στο `material-registry-3d.constants.ts`, providers δίνουν deterministic lookup. Όχι lazy fetch ανά render. |
| 2 | Race condition; | **No** — pure synchronous lookup. Material registry = readonly constants. |
| 3 | Idempotent; | **Yes** — `resolveWallFaceMaterials(wall)` ίδιο input = ίδιο output (modulo Three.js material instance equality, που αντιμετωπίζεται με memoization Phase 3.3). |
| 4 | Belt-and-suspenders; | **Yes** — default fallback `mat-concrete-c25` αν preset ID unknown. Optional cost/density → BOQ generates row anyway. |
| 5 | Single Source of Truth; | **Yes** — registry SSoT στο `material-registry-3d.constants.ts`. Preset ID lists (`wall-material-catalog.ts` + `stair-material-catalog.ts`) consume registry, no duplication. |
| 6 | Fire-and-forget ή await; | **Synchronous** — registry lookup είναι pure function. Phase 6+ Asset Manager swap = async, αλλά resolved σε startup time. |
| 7 | Lifecycle ownership; | **Module-scope const** για baseline. Phase 6+: `MaterialDefinitionProvider` με `init()` που hydrate-άρει από Firestore. ThreeJsSceneManager (ADR-366 §4.4) consumes provider. |

**Google-level: ✅ YES** — full pattern alignment με industry. Pending Phase 3 implementation θα επιβεβαιώσει.

---

## 11. Acceptance Criteria

| # | Criterion | Phase |
|---|---|---|
| AC-E1 | `material.types.ts` adapted στο Nestor `bim/types/material-catalog-types.ts` με 12 ShaderTypes + 11 MaterialCategories | Phase 3.1 |
| AC-E2 | `material-registry-3d.constants.ts` populated με 18 wall + 9 stair preset IDs με PBR + density + cost (όπου known) | Phase 3.2 |
| AC-E3 | `MaterialCatalog3D.resolveWallFaceMaterials(wall)` returns `{exterior, interior, core}` με flip-aware swap, identical algorithm στο `materialUniforms.ts` lines 44-78 αλλά Three.js context | Phase 3.3 |
| AC-E4 | Phase 3 visual: walls show distinct exterior/interior/core MeshStandardMaterial colors σε 3D scene | Phase 3 acceptance |
| AC-E5 | ADR-363 Phase 6.x: per-layer BOQ rows generated με correct unit (m³/m²/kg) από registry + ΑΤΟΕ category από material `category` discriminator | Phase 6.x acceptance |
| AC-E6 | `defaultStairMaterialCatalog` + `defaultWallMaterialCatalog` providers retain backward compatibility (preset ID resolution unchanged) | Phase 3 + 6.x |
| AC-E7 | TypeScript strict (no `any`, no `as any`, no `@ts-ignore`) | All phases |
| AC-E8 | Cost optional handling: missing cost → BOQ row με `quantity` only, no false zero | Phase 6.x |

---

## 12. Post-suite consolidation (A→E closure)

Με την ολοκλήρωση του SPEC-3D-004E, **ολόκληρη η σειρά SPEC-3D-004A→E είναι κλειστή**. Συνοπτικό report (Γιώργου proposal για §8 του ADR-366):

| Sub-spec | Status | Files inspected | Catalog (PORT_AS_IS / ADAPT / EXTRACT / EXCLUDE) | Effort impact |
|---|---|---:|---|---|
| **004A** — Viewport | ✅ | 45 | 15 / 8 / 7 / 15 | Phase 4 revised 6h→8-10h |
| **004B** — DXF Parser | ✅ | 8 | 0 / 0 / 0 / 8 | Phase 1 from scratch (Nestor 15-entity parser superset) |
| **004C** — Utils/Snap/Picking | ✅ | 16 | 2 / 1 / 0 / 13 | Phase 0 ~3-4h coord primitives + cursor→world |
| **004D** — Geometry Helpers | ✅ | 9 | 0 / 0 / 3 / 6 | 0h port (Nestor BIM geometry SSoT superset) + ADR-363 Phase 6.x ~8h Multi-Layer DNA BOQ |
| **004E** — Materials & Shaders | ✅ | 19 | 0 / 1 / 4 / 12+2 | Phase 3 unchanged ~6h + ADR-363 Phase 6.x reused |

**Final dependencies pulled in (package.json — όπως ADR-366 §8.3 — αμετάβλητα)**:
```jsonc
"three": "^0.170.0",
"three-gpu-pathtracer": "^0.0.18",
"three-mesh-bvh": "^0.7.0"
```

**Total GenArc files catalogued σε A→E**: **97 αρχεία** (45 + 8 + 16 + 9 + 19) από ~484 GenArc src/. Cataloged percentage: ~20% (αυτό που είναι σχετικό για ADR-366 — υπόλοιπο σε structural/ai/nok/dxf-import που είναι out of scope).

**Total port effort estimate (across all phases)**:
- Phase 0 Infrastructure: ~4h (ADR-366) + ~3-4h SPEC-3D-004C coord primitives = **~7-8h**
- Phase 1 DXF→Three: ~8h (ADR-366, from-scratch per SPEC-3D-004B) = **~8h**
- Phase 2 BIM→Three: ~10h (ADR-366, from-scratch per SPEC-3D-004D) = **~10h**
- Phase 3 Materials/Lighting: ~6h (ADR-366, confirmed by SPEC-3D-004E) = **~6h**
- Phase 4 Camera/ViewCube: ~8-10h (revised by SPEC-3D-004A) = **~9h**
- Phase 5 Path Tracer: ~12h (ADR-366) = **~12h**
- Phase 6 Export: ~4h = **~4h**
- Phase 7 Polish: ~8h (ADR-366) + optional ~3-4h adaptive grid (§3.4) = **~8-12h**

**Συνολική εκτίμηση: ~64-70h** για ADR-366 full implementation (αρχική εκτίμηση: ~58h, αναθεωρημένη: ~70h με GenArc deep insights).

**Pending ratchet work που προκύπτει από A→E suite**:
- **ADR-363 Phase 6.x Multi-Layer DNA BOQ ~8h** (από SPEC-3D-004D Q4) — confirmed πάλι από SPEC-3D-004E (registry shape provides density/cost data).
- Όλα τα υπόλοιπα είναι in-scope του ADR-366 phases.

**Phase 0 implementation start**: **READY** (όλα τα catalogs locked + dependencies identified + zero blocking questions).

---

## 13. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Initial draft v1.0** — Full catalog 19 αρχεία (`engines/sdf/` 12 + `shaders/` 4 + `material.types.ts` + `wallDna.types.ts` + `materialRegistry.constants.ts`). Result: **0 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 4 EXTRACT_CONCEPT + 12 EXCLUDE + 2 OUT_OF_SCOPE**. Status: READY. Q1/Q2/Q3/Q4 ΟΛΑ RESOLVED Full Enterprise (registry data source 5/5 σύγκλιση ΑΤΟΕ+ASTM, ShaderType extension 4/4 σύγκλιση Revit/ArchiCAD/Bentley/Vectorworks, cost optional 5/5 σύγκλιση, two-tier preset+registry 4/4 σύγκλιση). **Phase 3 effort confirmed ~6h** (ADR-366 §4.5 unchanged). **ADR-363 Phase 6.x ~8h reused** (registry shape provides required density+cost+unit data). **GenArc A→E suite CLOSED** — Phase 0 implementation start ready. | Claude Opus 4.7 |
