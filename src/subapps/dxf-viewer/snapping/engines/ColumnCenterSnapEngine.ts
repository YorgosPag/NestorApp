/**
 * ADR-363 Phase 5.5i — Column Center Axis Snap Engine.
 *
 * Snaps exclusively to the structural center axis of column entities (the
 * 'center' anchor in the 9-point grid). Returns `type: BIM_COLUMN_CENTER`
 * so the SnapIndicatorOverlay renders the ⊕ wireframe cross symbol instead
 * of the generic endpoint square, and emits `description: 'bim-column'` for
 * the "Επί άξονα κολώνας" i18n tooltip (ADR-363 Phase 5.5i).
 *
 * Priority: -1 (BIM_COLUMN_CENTER) — supersedes ENDPOINT (0) when cursor is
 * at the column center, giving the structural axis snap precedence over the
 * generic 9-anchor endpoint snap from Phase 5.5d.
 *
 * Industry convention: Revit "Column Grid" snap, ArchiCAD "Column Center"
 * OSnap — always available when beam/wall tools are active.
 *
 * @see bim/columns/column-anchors.ts — 9-anchor SSoT (Phase 5.5d)
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ⊕ visual + i18n label
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isColumnEntity } from '../../types/entities';
import { getColumnAnchorWorldPoints } from '../../bim/columns/column-anchors';

export class ColumnCenterSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_COLUMN_CENTER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => extractColumnCenter(entity),
      'column_center',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_COLUMN_CENTER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_COLUMN_CENTER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'column_center'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-column',
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

function extractColumnCenter(entity: EntityModel): Point2D[] {
  if (!isColumnEntity(entity)) return [];
  const anchors = getColumnAnchorWorldPoints(entity);
  const center = anchors.find((a) => a.anchor === 'center');
  return center ? [center.point] : [];
}
