/**
 * ADR-363 Phase 3.7b+ — Multi-storey slab-opening stack utilities.
 *
 * Pure functions — zero React / DOM / Firestore deps. Testable in isolation.
 *
 * `findHostSlabForLevel`: given source outline + target level scene, returns
 * the slab whose bbox contains the outline center (mirror `getSlabAtPoint`
 * pattern from useSpecialTools-slab-opening.ts).
 *
 * `buildStackedOpeningEntity`: clones a source opening for a new level.
 * Preserves outline / kind / fireRating / elevationOverride. Generates new ID.
 * Sets `slabId` to target slab's id, `layerId` to target level id, and
 * `multiStoreyStackGroupId` to the provided group id.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 */

import type { Polygon3D } from '../types/bim-base';
import type { SlabEntity } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import type { SceneModel } from '../../types/scene';
import { isSlabEntity } from '../../types/entities';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { generateSlabOpeningId } from '@/services/enterprise-id-convenience';

/**
 * Find the slab in `scene` whose bbox contains the center of `sourceOutline`.
 * Returns null if no slab qualifies (missing or different floor footprint).
 */
export function findHostSlabForLevel(
  sourceOutline: Polygon3D,
  scene: SceneModel,
): SlabEntity | null {
  const verts = sourceOutline.vertices;
  if (verts.length === 0) return null;

  const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;

  const slabs = scene.entities.filter(isSlabEntity) as SlabEntity[];
  return slabs.find((s) => {
    const bb = s.geometry?.bbox;
    if (!bb) return false;
    return cx >= bb.min.x && cx <= bb.max.x && cy >= bb.min.y && cy <= bb.max.y;
  }) ?? null;
}

/**
 * Build a copy of `source` targeting `hostSlab` on a different level.
 * Same outline / kind / fireRating. New entity ID. Updated slabId + layerId.
 * All copies in a stack share `multiStoreyStackGroupId`.
 */
export function buildStackedOpeningEntity(
  source: SlabOpeningEntity,
  hostSlab: SlabEntity,
  layerId: string,
  groupId: string,
): SlabOpeningEntity {
  const params = {
    ...source.params,
    slabId: hostSlab.id,
    multiStoreyStackGroupId: groupId,
  };
  const geometry = computeSlabOpeningGeometry(params);
  return {
    id: generateSlabOpeningId(),
    type: 'slab-opening' as const,
    kind: source.kind,
    layerId,
    params,
    geometry,
    validation: source.validation,
    visible: true,
  };
}
