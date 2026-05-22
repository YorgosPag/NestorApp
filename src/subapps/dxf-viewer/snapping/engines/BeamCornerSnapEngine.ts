/**
 * ADR-370 §6.2 — Beam Face-Corner Snap Engine.
 *
 * Snaps to the 4 face-end corner world points of BIM beam entities.
 * For all beam kinds (straight / curved / cantilever) only the START and
 * END face corners are exposed (not all Bezier subdivision vertices) to
 * avoid snap noise on long curved beams (ADR-370 §2.3).
 *
 * Returns `type: BIM_BEAM_CORNER` so the SnapIndicatorOverlay renders the
 * ┘ L-bracket symbol, and emits `description: 'bim-beam-corner'` for the
 * "Γωνία δοκαριού" i18n tooltip (ADR-370 §7).
 *
 * Priority: -2 (BIM_BEAM_CORNER) — highest structural precision, supersedes
 * BIM_COLUMN_CENTER (−1) and generic ENDPOINT (0).
 *
 * @see bim/beams/beam-corner-anchors.ts    — SSoT for beam face-corner world points
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ┘ visual + i18n label
 * @see snapping/engines/ColumnCenterSnapEngine.ts — pattern reference (ADR-363)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isBeamEntity } from '../../types/entities';
import { getBeamCornerWorldPoints } from '../../bim/beams/beam-corner-anchors';

export class BeamCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_BEAM_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      extractBeamCorners,
      'beam_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_BEAM_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_BEAM_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'beam_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-beam-corner',
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

function extractBeamCorners(entity: EntityModel): Point2D[] {
  if (!isBeamEntity(entity)) return [];
  return getBeamCornerWorldPoints(entity).map((c) => c.point);
}
