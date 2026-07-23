/**
 * stair-material-resolver — Revit-pattern per-component material resolution για 3D stairs.
 *
 * Resolution chain (ADR-370 Phase 5, FULL ENTERPRISE):
 *   1. per-SUB-element override (ADR-358 Q19): `perTreadOverrides[subIndex].material`
 *      for treads · `perRiserOverrides[subIndex].material` for risers (Φ7)
 *   2. `stair.params.materials?.[componentField]`
 *   3. structure-type coherent default (Revit: the material set follows the stair
 *      TYPE — monolithic → concrete, stringer/suspended → timber, glass-tread →
 *      glass, steel-grating → metal). SSoT: `stair-structure-material-defaults.ts`.
 *   4. element-type default (`elem-stair-{component}` via MaterialCatalog3D)
 *
 * Bridge from 2D stair material preset IDs (`stair-material-catalog.ts`: oak/walnut/
 * marble/granite/concrete/steel/glass/terrazzo/tile + 'custom' free-form) to the
 * shared MaterialCatalog3D PBR registry. Free-form / unknown IDs fall back to the
 * component default — preserves stability when the 2D library swaps to a real
 * Asset Manager (ADR-358 Phase 9 swap target).
 */

import type * as THREE from 'three';
import type { StairEntity } from '../../bim/types/stair-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import {
  getMaterial3D,
  getElementMaterial3D,
  type Stair3DComponent,
} from './MaterialCatalog3D';
// ADR-539 Φ7 / ADR-407 Φ8 — appearance→material κοινό SSoT (textured/color), μοιρασμένο με το κάγκελο.
import { resolveAppearanceMaterial } from './appearance-material';
import { resolveStructureComponentMaterialKey } from './stair-structure-material-defaults';

/**
 * ADR-539 Φ7 — ιστορικό stair-named alias του κοινού appearance→material SSoT (τώρα στο
 * `appearance-material.ts`, μοιρασμένο με το railing). Διατηρείται για τους υπάρχοντες importers
 * (`stair-waist-slabs`) χωρίς clone (N.18).
 */
export { resolveAppearanceMaterial as resolveStairAppearanceMaterial } from './appearance-material';

type ComponentField = 'tread' | 'riser' | 'stringer' | 'landing';

const COMPONENT_TO_FIELD: Record<Stair3DComponent, ComponentField | null> = {
  'stair-tread':    'tread',
  'stair-riser':    'riser',
  'stair-stringer': 'stringer',
  'stair-landing':  'landing',
  // Handrails have no entry on StairMaterials (StairHandrails has no material field).
  // Always resolves to the element default.
  'stair-handrail': null,
};

/**
 * 2D stair material preset ID → MaterialCatalog3D key (mat-* prefix family).
 * Aligns with `stair-material-catalog.ts` STAIR_MATERIAL_PRESET_IDS.
 */
const PRESET_TO_MAT3D: Record<string, string> = {
  oak:       'mat-wood',
  walnut:    'mat-wood',
  marble:    'mat-stone',
  granite:   'mat-stone',
  concrete:  'mat-concrete',
  terrazzo:  'mat-concrete',
  tile:      'mat-tile',
  steel:     'mat-metal',
  glass:     'mat-glass',
};

function resolvePresetToMat3D(presetOrId: string): string | null {
  const mapped = PRESET_TO_MAT3D[presetOrId];
  if (mapped) return mapped;
  // Pass through any `mat-*` ID directly — MaterialCatalog3D.resolveKey handles prefix matching.
  if (presetOrId.startsWith('mat-')) return presetOrId;
  return null;
}

/** Per-sub-element material override (tread → `perTreadOverrides`, riser → `perRiserOverrides`). */
function resolveSubElementOverride(
  stair: StairEntity,
  component: Stair3DComponent,
  subIndex?: number,
): string | undefined {
  if (subIndex === undefined) return undefined;
  if (component === 'stair-tread') return stair.params.perTreadOverrides?.[subIndex]?.material;
  if (component === 'stair-riser') return stair.params.perRiserOverrides?.[subIndex]?.material;
  return undefined;
}

/**
 * ADR-539 Φ7 — per-sub-element FULL appearance override (`FaceAppearance`, βαμμένο από την παλέτα
 * «ΠΟΛΥΓΩΝΑ»). tread/riser/landing keyed by `subIndex`. Το waist («πλάκα σκάλας») δεν είναι
 * `Stair3DComponent`· το χειρίζεται ο `buildWaistSlabMeshes` μέσω {@link resolveStairAppearanceMaterial}.
 */
function resolveSubElementAppearance(
  stair: StairEntity,
  component: Stair3DComponent,
  subIndex?: number,
): FaceAppearance | undefined {
  if (subIndex === undefined) return undefined;
  const p = stair.params;
  if (component === 'stair-tread') return p.perTreadOverrides?.[subIndex]?.appearance;
  if (component === 'stair-riser') return p.perRiserOverrides?.[subIndex]?.appearance;
  if (component === 'stair-landing') return p.perLandingOverrides?.[subIndex]?.appearance;
  return undefined;
}

export function resolveStairMaterial(
  stair: StairEntity,
  component: Stair3DComponent,
  subIndex?: number,
): THREE.MeshStandardMaterial {
  // 0. ADR-539 Φ7 — full per-sub-element appearance (Polygon «Paint») ΚΕΡΔΙΖΕΙ: Revit «Paint on
  //    face» / Cinema 4D material tag. Ίδιο `FaceAppearance` SSoT με τα solids (textured/color).
  const appearanceMat = resolveAppearanceMaterial(
    resolveSubElementAppearance(stair, component, subIndex),
  );
  if (appearanceMat) return appearanceMat;

  // 1. Per-sub-element override (ADR-358 Q19): tread OR riser, keyed by the 0-based
  //    global build-order index (== the 3D `stairComponentIndex` tag).
  const overrideMat = resolveSubElementOverride(stair, component, subIndex);
  if (overrideMat) {
    const matKey = resolvePresetToMat3D(overrideMat);
    if (matKey) return getMaterial3D(matKey);
  }

  // 1.5 ADR-539 Φ7 — whole-stair «base» appearance (ΣΩΜΑ paint): ισχύει σε ΟΛΑ τα components, ΜΕΤΑ
  //     από κάθε per-sub-element override (πιο ειδικό κερδίζει) αλλά ΠΡΙΝ τα preset defaults. Cinema 4D
  //     object material tag / Revit type material. Waist: μέσω `resolveStairMaterial('stair-landing')`.
  const wholeStairMat = resolveAppearanceMaterial(stair.params.materials?.appearance);
  if (wholeStairMat) return wholeStairMat;

  // 2. Stair-level component material.
  const field = COMPONENT_TO_FIELD[component];
  if (field) {
    const stairMat = stair.params.materials?.[field];
    if (stairMat) {
      const matKey = resolvePresetToMat3D(stairMat);
      if (matKey) return getMaterial3D(matKey);
    }
  }

  // 3. Structure-type coherent default (Revit: material set follows the stair type).
  //    Replaces the arbitrary fixed `elem-stair-*` mix so a monolithic stair reads as
  //    all-concrete instead of concrete-with-incongruous-timber-treads (Giorgio 2026-07-21).
  const structKey = resolveStructureComponentMaterialKey(stair.params.structureType, component);
  if (structKey) return getMaterial3D(structKey);

  // 4. Element-type default (last resort — only for an unmapped structure/component).
  return getElementMaterial3D(component);
}
