/**
 * stair-material-resolver — Revit-pattern per-component material resolution για 3D stairs.
 *
 * Resolution chain (ADR-370 Phase 5, FULL ENTERPRISE):
 *   1. `stair.params.perTreadOverrides[treadIndex]?.material` (component='stair-tread' only)
 *   2. `stair.params.materials?.[componentField]`
 *   3. element-type default (`elem-stair-{component}` via MaterialCatalog3D)
 *
 * Bridge from 2D stair material preset IDs (`stair-material-catalog.ts`: oak/walnut/
 * marble/granite/concrete/steel/glass/terrazzo/tile + 'custom' free-form) to the
 * shared MaterialCatalog3D PBR registry. Free-form / unknown IDs fall back to the
 * component default — preserves stability when the 2D library swaps to a real
 * Asset Manager (ADR-358 Phase 9 swap target).
 */

import type * as THREE from 'three';
import type { StairEntity } from '../../bim/types/stair-types';
import { getMaterial3D, getElementMaterial3D, type Stair3DComponent } from './MaterialCatalog3D';

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

export function resolveStairMaterial(
  stair: StairEntity,
  component: Stair3DComponent,
  treadIndex?: number,
): THREE.MeshStandardMaterial {
  // 1. Per-tread override (treads only).
  if (component === 'stair-tread' && treadIndex !== undefined) {
    const override = stair.params.perTreadOverrides?.[treadIndex]?.material;
    if (override) {
      const matKey = resolvePresetToMat3D(override);
      if (matKey) return getMaterial3D(matKey);
    }
  }

  // 2. Stair-level component material.
  const field = COMPONENT_TO_FIELD[component];
  if (field) {
    const stairMat = stair.params.materials?.[field];
    if (stairMat) {
      const matKey = resolvePresetToMat3D(stairMat);
      if (matKey) return getMaterial3D(matKey);
    }
  }

  // 3. Element-type default.
  return getElementMaterial3D(component);
}
