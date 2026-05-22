/**
 * ADR-370 §6.3 — Slab Polygon-Vertex Snap Engine.
 *
 * Snaps to ALL outline-vertex world points of BIM slab entities. Unlike
 * walls and beams (which expose only 4 face-end corners), slabs are arbitrary
 * closed polygons where every vertex IS a structural corner — the intersection
 * of two slab edges.
 *
 * Returns `type: BIM_SLAB_CORNER` so the SnapIndicatorOverlay renders the
 * ┘ L-bracket symbol, and emits `description: 'bim-slab-corner'` for the
 * "Γωνία πλάκας" i18n tooltip (ADR-370 §7).
 *
 * Priority: -2 (BIM_SLAB_CORNER) — highest structural precision, supersedes
 * BIM_COLUMN_CENTER (−1) and generic ENDPOINT (0).
 *
 * @see bim/slabs/slab-corner-anchors.ts    — SSoT for slab vertex world points
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ visual + i18n label
 * @see snapping/engines/ColumnCenterSnapEngine.ts — pattern reference (ADR-363)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isSlabEntity } from '../../types/entities';
import { getSlabCornerWorldPoints } from '../../bim/slabs/slab-corner-anchors';

export class SlabCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_SLAB_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractSlabCorners,
      'slab_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_SLAB_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_SLAB_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'slab_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-slab-corner',
        result.distance,
        priority,
        entity.id,
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}

function extractSlabCorners(entity: EntityModel): Point2D[] {
  if (!isSlabEntity(entity)) return [];
  return getSlabCornerWorldPoints(entity).map((c) => c.point);
}
