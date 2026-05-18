/**
 * ADR-362 Phase I1 — Dimension Line Snap Engine.
 *
 * Snaps to the visual center of a dimension line (text midpoint) and the
 * type-specific dim-line reference point. Used primarily for:
 *   - Baseline chaining: snap to an existing linear/aligned dim's dim line
 *     to know where the new parallel baseline should originate.
 *   - Continued chaining: snap to where the dim line ends.
 *
 * Priority: DIM_LINE (3) — medium, equivalent to CENTER.
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import type { DimensionEntity } from '../../types/dimension';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class DimLineSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.DIM_LINE);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => this.extractDimLinePoints(entity),
      'dim_line'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const candidates: SnapCandidate[] = [];
    const priority = SNAP_ENGINE_PRIORITIES.DIM_LINE;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.DIM_LINE);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'dim_line')
    );

    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'Dimension Line',
        result.distance,
        priority,
        entity.id
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  private extractDimLinePoints(entity: EntityModel): Point2D[] {
    if (entity.type !== 'dimension') return [];
    const dim = entity as unknown as DimensionEntity;

    const points: Point2D[] = [];

    // textMidpoint = visual center of the dimension line (always snap-worthy)
    if (dim.textMidpoint) {
      points.push({ x: dim.textMidpoint.x, y: dim.textMidpoint.y });
    }

    const refPt = this.resolveRefPoint(dim);
    if (refPt) {
      const isDuplicate = dim.textMidpoint &&
        refPt.x === dim.textMidpoint.x &&
        refPt.y === dim.textMidpoint.y;
      if (!isDuplicate) {
        points.push(refPt);
      }
    }

    return points;
  }

  private resolveRefPoint(dim: DimensionEntity): Point2D | null {
    const dp = dim.defPoints;

    switch (dim.dimensionType) {
      case 'linear':
      case 'aligned':
      case 'baseline':
      case 'continued':
        // defPoints[2] = dim line reference (where the horizontal/vertical line sits)
        return dp[2] ? { x: dp[2].x, y: dp[2].y } : null;

      case 'angular2L':
        // defPoints[4] = arc point on angular dim arc
        return dp[4]
          ? { x: dp[4].x, y: dp[4].y }
          : dp[3] ? { x: dp[3].x, y: dp[3].y } : null;

      case 'angular3P':
        // defPoints[3] = arc point
        return dp[3] ? { x: dp[3].x, y: dp[3].y } : null;

      case 'radius':
      case 'diameter':
        // Midpoint of the two endpoint defPoints — centre of the measurement
        return dp[0] && dp[1]
          ? { x: (dp[0].x + dp[1].x) / 2, y: (dp[0].y + dp[1].y) / 2 }
          : dp[0] ? { x: dp[0].x, y: dp[0].y } : null;

      case 'ordinate':
        // datum = the measured reference origin for this ordinate
        return { x: dim.datum.x, y: dim.datum.y };

      case 'arcLength':
        // center of the arc being measured (defPoints[0])
        return dp[0] ? { x: dp[0].x, y: dp[0].y } : null;

      case 'joggedRadius':
        // jogPoint (defPoints[2]) = the kink point on the jogged leader
        return dp[2] ? { x: dp[2].x, y: dp[2].y } : null;

      default:
        return dp[0] ? { x: dp[0].x, y: dp[0].y } : null;
    }
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}
