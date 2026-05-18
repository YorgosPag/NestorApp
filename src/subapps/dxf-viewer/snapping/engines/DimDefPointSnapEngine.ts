/**
 * ADR-362 Phase I1 — Dimension Definition Point Snap Engine.
 *
 * Snaps to the `defPoints[]` array of any `DimensionEntity` in the scene.
 * Mirrors AutoCAD's OSMODE DIMSNAP (bit 16384): cursor locks to the exact
 * anchor points used to define the dimension geometry (extension-line origins,
 * arc centres, angle vertices, etc.).
 *
 * Priority: DIM_DEF_POINT (2) — high, equivalent to INSERTION, below MIDPOINT.
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class DimDefPointSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.DIM_DEF_POINT);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => this.extractDefPoints(entity),
      'dim_def_point'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const candidates: SnapCandidate[] = [];
    const priority = SNAP_ENGINE_PRIORITIES.DIM_DEF_POINT;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.DIM_DEF_POINT);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'dim_def_point')
    );

    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'Dimension Def Point',
        result.distance,
        priority,
        entity.id
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  private extractDefPoints(entity: EntityModel): Point2D[] {
    if (entity.type !== 'dimension') return [];
    // After type narrowing, entity is DimensionEntity — defPoints is readonly Point2D[]
    const defPoints = (entity as EntityModel & { defPoints: readonly { x: number; y: number }[] }).defPoints;
    if (!Array.isArray(defPoints)) return [];
    return defPoints.map(p => ({ x: p.x, y: p.y }));
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}
