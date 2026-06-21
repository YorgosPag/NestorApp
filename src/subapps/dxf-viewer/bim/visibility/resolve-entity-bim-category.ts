/**
 * resolve-entity-bim-category — SSoT entity → BimCategory resolver (ADR-358 §5.6.bis).
 *
 * Maps a scene entity to its V/G `BimCategory`, mirroring the per-renderer
 * dispatch (`entity.type === BimCategory` for most BIM entities, with the four
 * params-driven exceptions: mep-fixture / mep-segment / mep-fitting /
 * floorplan-symbol). Raw DXF primitives (line/arc/polyline/text/dimension/…)
 * have no BimCategory and return `null`.
 *
 * Used by category-scope Isolate (Revit "Isolate Category") to decide, at the
 * shared 2D `DxfRenderer` gate, whether an entity belongs to the isolated
 * category set. The 3D path already receives an explicit category per sync.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Entity } from '../../types/entities';
import type { BimCategory } from '../../config/bim-object-styles';
import { resolveFixtureBimCategory } from '../types/mep-fixture-types';
import { resolveSegmentBimCategory } from '../types/mep-segment-types';
import { resolveFittingBimCategory } from '../types/mep-fitting-types';
import { resolveSymbolCategoryConfig } from '../floorplan-symbols/floorplan-symbol-categories';

/**
 * BIM entity types whose `entity.type` string IS the `BimCategory` (no params
 * indirection). Kept as a Set for O(1) membership at the render-loop gate.
 */
const DIRECT_CATEGORY_TYPES = new Set<string>([
  'wall', 'column', 'beam', 'slab', 'slab-opening', 'opening', 'stair', 'roof',
  'foundation', 'railing', 'furniture', 'electrical-panel', 'mep-manifold',
  'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-underfloor',
  'floor-finish', 'wall-covering', 'thermal-space', 'space-separator',
]);

/**
 * Collect the distinct BimCategories of the given selected entity ids (raw DXF
 * entities contribute nothing). Used by "Isolate Category" to derive the target
 * category set from the current selection.
 */
export function collectBimCategories(
  entityIds: readonly string[],
  entities: readonly DxfEntityUnion[] | undefined,
): BimCategory[] {
  if (!entities || entityIds.length === 0) return [];
  const cats = new Set<BimCategory>();
  for (const id of entityIds) {
    const entity = entities.find((e) => e.id === id);
    const cat = entity ? resolveEntityBimCategory(entity) : null;
    if (cat !== null) cats.add(cat);
  }
  return [...cats];
}

/**
 * Resolve a scene entity to its V/G BimCategory, or `null` for raw DXF.
 *
 * Accepts both the renderer `DxfEntityUnion` and the SceneModel `Entity` union —
 * the param-driven Dxf wrappers mirror `XEntity['params']`, so the four param
 * lookups below are shape-identical across both. Lets Entity-world consumers
 * (e.g. "Select Similar by colour") reuse this SSoT without a conversion pass.
 */
export function resolveEntityBimCategory(entity: DxfEntityUnion | Entity): BimCategory | null {
  switch (entity.type) {
    case 'mep-fixture':
      return resolveFixtureBimCategory(entity.params);
    case 'mep-segment':
      return resolveSegmentBimCategory(entity.params);
    case 'mep-fitting':
      return resolveFittingBimCategory(entity.params);
    case 'floorplan-symbol': {
      // NOTE: this `bimCategory` is the ADR-415 floorplan-symbol category-config
      // field (V/G), NOT the SceneLayer scaffold guarded by the SSoT module
      // `bim-category-scaffolding-no-active-use`. Destructured to keep the two
      // unrelated `bimCategory` properties distinct.
      const { bimCategory } = resolveSymbolCategoryConfig(entity.params.category);
      return bimCategory;
    }
    default:
      return DIRECT_CATEGORY_TYPES.has(entity.type)
        ? (entity.type as BimCategory)
        : null;
  }
}
