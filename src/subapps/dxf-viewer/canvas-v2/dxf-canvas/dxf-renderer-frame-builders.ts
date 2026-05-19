/**
 * Per-frame index builders for `DxfRenderer.render()`.
 *
 * Pure O(n) scene scans that produce the per-frame maps consumed by the
 * specialized leaf renderers (DimensionRenderer, SlabRenderer, WallRenderer).
 * Extracted from `DxfRenderer.ts` to keep the orchestrator under the 500-line
 * Google-SRP limit (Boy-Scout file-size split, no logic change).
 *
 * Architecture: each builder is a pure function over `scene.entities` — no
 * `this`, no React, no store subscriptions. Callers push the result into the
 * relevant composite slot every frame (ADR-040 micro-leaf compliance: the
 * orchestrator drives, the leaves never subscribe).
 */
import type { DxfEntityUnion, DxfSlabOpening, DxfOpening } from './dxf-types';
import type { DimensionEntity } from '../../types/dimension';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { OpeningsByWall } from '../../bim/renderers/WallRenderer';

/**
 * ADR-362 Phase C1 — build the per-frame DimensionLookup map for chained
 * dim resolution (baseline / continued). O(n) scan; only `'dimension'`
 * entities land in the map (typically <100 per scene). Returned closure is
 * O(1) lookup at render time.
 */
export function buildDimensionLookup(entities: readonly DxfEntityUnion[]): DimensionLookup {
  const map = new Map<string, DimensionEntity>();
  for (const e of entities) {
    if (e.type === 'dimension') {
      map.set(e.dimensionEntity.id, e.dimensionEntity);
    }
  }
  return (id: string) => map.get(id);
}

/** ADR-363 Phase 3.7 — build per-frame Map<slabId, SlabOpeningEntity[]> for SlabRenderer cutouts. */
export function buildSlabOpeningsBySlab(entities: readonly DxfEntityUnion[]): Map<string, SlabOpeningEntity[]> {
  const m = new Map<string, SlabOpeningEntity[]>();
  for (const e of entities) {
    if (e.type !== 'slab-opening') continue;
    const so = (e as DxfSlabOpening).slabOpeningEntity;
    const arr = m.get(so.params.slabId) ?? [];
    arr.push(so);
    m.set(so.params.slabId, arr);
  }
  return m;
}

/** ADR-363 Phase 2 (deferred pipeline) — build per-frame Map<wallId, OpeningEntity[]> for WallRenderer boolean cutouts. */
export function buildOpeningsByWall(entities: readonly DxfEntityUnion[]): OpeningsByWall {
  const m = new Map<string, OpeningEntity[]>();
  for (const e of entities) {
    if (e.type !== 'opening') continue;
    const o = (e as DxfOpening).openingEntity;
    const arr = m.get(o.params.wallId) ?? [];
    arr.push(o);
    m.set(o.params.wallId, arr);
  }
  return m;
}
