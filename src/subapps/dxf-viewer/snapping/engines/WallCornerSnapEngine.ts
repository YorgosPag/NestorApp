/**
 * ADR-370 §6.1 — Wall Face-Corner Snap Engine.
 *
 * Snaps to the 4 face-corner world points of BIM wall entities: outer-start,
 * outer-end, inner-end, inner-start. Returns `type: BIM_WALL_CORNER` so the
 * SnapIndicatorOverlay renders the ┘ L-bracket symbol (distinct from the
 * generic endpoint ■ square), and emits `description: 'bim-wall-corner'` for
 * the "Γωνία τοίχου" i18n tooltip (ADR-370 §7).
 *
 * Priority: -2 (BIM_WALL_CORNER) — highest structural precision, supersedes
 * BIM_COLUMN_CENTER (−1) and generic ENDPOINT (0). Ensures face corners always
 * win when cursor is near a wall extremity, matching Revit / ArchiCAD behaviour.
 *
 * Industry convention: Revit "Wall Face" snap, ArchiCAD "Endpoint" on wall
 * face edges — always available when any placement tool is active.
 *
 * @see bim/walls/wall-corner-anchors.ts    — SSoT for wall face-corner world points
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ visual + i18n label
 * @see snapping/engines/ColumnCenterSnapEngine.ts — pattern reference (ADR-363)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isWallEntity } from '../../types/entities';
import { getWallCornerWorldPoints } from '../../bim/walls/wall-corner-anchors';

export class WallCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_WALL_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractWallCorners,
      'wall_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_WALL_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_WALL_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'wall_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-wall-corner',
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

function extractWallCorners(entity: EntityModel): Point2D[] {
  if (!isWallEntity(entity)) return [];
  return getWallCornerWorldPoints(entity).map((c) => c.point);
}
