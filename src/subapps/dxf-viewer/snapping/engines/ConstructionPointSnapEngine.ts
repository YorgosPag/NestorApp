/**
 * @module snapping/engines/ConstructionPointSnapEngine
 * @description Snap engine for construction snap points (X markers) — ADR-189
 *
 * Produces snap candidates at discrete point locations:
 * - For each visible point: snap to exact point if within radius
 *
 * Pattern: identical to GuideSnapEngine — lightweight, no spatial index needed.
 *
 * @see ADR-189 §3.7, §3.8, §3.15, §3.16
 * @see GuideSnapEngine.ts (template)
 * @since 2026-02-20
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { getGlobalConstructionPointStore } from '../../systems/guides/construction-point-store';

/**
 * Snap engine for construction snap points (X markers).
 * Points live in ConstructionPointStore (singleton) — the engine reads directly
 * from the store on every findSnapCandidates() call, ensuring data is always current.
 */
export class ConstructionPointSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.CONSTRUCTION_POINT);
  }

  /** Construction points don't use scene entities — this is a no-op. */
  initialize(_entities: EntityModel[]): void {
    // Construction point snap does not depend on scene entities.
    // Points are read directly from the singleton ConstructionPointStore.
  }

  /**
   * Find snap candidates at construction point locations near the cursor.
   *
   * Reads directly from ConstructionPointStore singleton — no manual sync needed.
   * For each visible point within snap radius:
   * - Candidate at exact point position, distance = Euclidean distance to cursor
   */
  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const points = getGlobalConstructionPointStore().getPoints();

    if (points.length === 0) {
      return { candidates };
    }

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.CONSTRUCTION_POINT);

    for (const cpt of points) {
      if (!cpt.visible) continue;

      const dx = cursorPoint.x - cpt.point.x;
      const dy = cursorPoint.y - cpt.point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        candidates.push(this.createCandidate(
          cpt.point,
          cpt.label ? `Point "${cpt.label}"` : 'Construction Point',
          distance,
          SNAP_ENGINE_PRIORITIES.CONSTRUCTION_POINT,
          cpt.id,
        ));
      }

      // Performance: cap at 4 candidates
      if (candidates.length >= 4) break;
    }

    return { candidates };
  }

  /** No resources to clean up. */
  dispose(): void {
    // No local state to clean — reads from singleton store
  }
}
