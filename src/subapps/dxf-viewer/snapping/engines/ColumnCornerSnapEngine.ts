/**
 * ADR-370 §6.4 — Column Perimeter-Corner Snap Engine.
 *
 * Snaps to the 4 diagonal (corner) perimeter anchors of BIM column entities:
 * NE, NW, SE, SW. For rectangular / L-shape / T-shape columns these are the
 * bbox corner points. For circular columns these are the 45° perimeter points
 * (cos45°·r from center), consistent with Revit cylindrical column behaviour.
 *
 * Returns `type: BIM_COLUMN_CORNER` so the SnapIndicatorOverlay renders the
 * ┘ L-bracket symbol (distinct from BIM_COLUMN_CENTER's ⊕ cross), and emits
 * `description: 'bim-column-corner'` for the "Γωνία κολώνας" i18n tooltip
 * (ADR-370 §7).
 *
 * Priority: -2 (BIM_COLUMN_CORNER) — supersedes BIM_COLUMN_CENTER (−1) when
 * cursor is near a column face corner rather than the axis center.
 *
 * Implementation: thin filter over `getColumnCornerWorldPoints()` which itself
 * filters the 9-anchor set from `getColumnAnchorWorldPoints()` (ADR-363 Phase
 * 5.5d). Zero geometry re-computation.
 *
 * @see bim/columns/column-corner-anchors.ts    — SSoT corner filter (ADR-370 §5.4)
 * @see bim/columns/column-anchors.ts           — full 9-anchor SSoT (ADR-363 §6)
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ visual + i18n label
 * @see snapping/engines/ColumnCenterSnapEngine.ts — sibling (center axis)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isColumnEntity } from '../../types/entities';
import { getColumnCornerWorldPoints } from '../../bim/columns/column-corner-anchors';

export class ColumnCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_COLUMN_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractColumnCorners,
      'column_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_COLUMN_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_COLUMN_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'column_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-column-corner',
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

function extractColumnCorners(entity: EntityModel): Point2D[] {
  if (!isColumnEntity(entity)) return [];
  return getColumnCornerWorldPoints(entity).map((c) => c.point);
}
