/**
 * ADR-370 §6.5 — Opening Face-Corner Snap Engine.
 *
 * Snaps to the 4 face-corner world points of BIM opening entities (doors,
 * windows, sliding doors, French doors, fixed glazing). These are the 4
 * vertices of the opening cutout rectangle in world coordinates:
 * innerStart, innerEnd, outerEnd, outerStart.
 *
 * Returns `type: BIM_OPENING_CORNER` so the SnapIndicatorOverlay renders the
 * ┘ L-bracket symbol, and emits `description: 'bim-opening-corner'` for the
 * "Γωνία κουφώματος" i18n tooltip (ADR-370 §7).
 *
 * Priority: -2 (BIM_OPENING_CORNER) — highest structural precision, supersedes
 * BIM_COLUMN_CENTER (−1) and generic ENDPOINT (0). This ensures an opening
 * corner always wins when the cursor is near the jamb of a door or window,
 * matching Revit / ArchiCAD "Wall Opening" snap behaviour.
 *
 * Implementation: uses `entity.geometry.outline.vertices` (cached, always
 * present — `BimEntity.geometry` is non-optional per ADR-363 §5.1). No host
 * wall lookup required at snap time.
 *
 * @see bim/walls/opening-corner-anchors.ts    — SSoT for opening corner world points
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ visual + i18n label
 * @see snapping/engines/ColumnCenterSnapEngine.ts — pattern reference (ADR-363)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isOpeningEntity } from '../../types/entities';
import { getOpeningCornerWorldPoints } from '../../bim/walls/opening-corner-anchors';

export class OpeningCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_OPENING_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractOpeningCorners,
      'opening_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_OPENING_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_OPENING_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'opening_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-opening-corner',
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

function extractOpeningCorners(entity: EntityModel): Point2D[] {
  if (!isOpeningEntity(entity)) return [];
  return getOpeningCornerWorldPoints(entity).map((c) => c.point);
}
