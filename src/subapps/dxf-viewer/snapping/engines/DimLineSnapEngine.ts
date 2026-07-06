/**
 * ADR-362 Phase I1 — Dimension Line Snap Engine.
 *
 * Snaps to the *rendered* dim-line geometry — the dim-line feet, its midpoint,
 * the text anchor, and (radial/angular) the arc/leader endpoints — sourced from
 * the `dim-snap-geometry` SSoT (which reuses the hit-geometry / builder SSoT, so
 * it matches exactly what the renderer draws). Used primarily for:
 *   - Baseline chaining: snap to an existing linear/aligned dim's dim line
 *     to know where the new parallel baseline should originate.
 *   - Continued chaining: snap to where the dim line ends.
 *
 * The raw definition points are covered separately by `DimDefPointSnapEngine`.
 * ADR-378 Step 2 (handoff 2026-07-06) extended this from textMidpoint + one ref
 * point to the full rendered geometry.
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
import { computeDimLineSnapPoints } from '../../systems/dimensions/dim-snap-geometry';

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
    // SSoT: the rendered dim-line geometry (feet, midpoint, text anchor, arc/leader
    // endpoints) comes from `dim-snap-geometry`, which reuses the hit-geometry /
    // builder SSoT — the exact geometry the renderer draws. ADR-378 Step 2.
    return computeDimLineSnapPoints(entity as unknown as DimensionEntity);
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}
