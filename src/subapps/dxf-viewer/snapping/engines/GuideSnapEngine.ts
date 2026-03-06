/**
 * @module snapping/engines/GuideSnapEngine
 * @description Snap engine for construction guide lines (ADR-189)
 *
 * Produces snap candidates along guide lines:
 * - X guide at offset=N → snap point (N, cursor.y), distance = |cursor.x - N|
 * - Y guide at offset=N → snap point (cursor.x, N), distance = |cursor.y - N|
 * - XZ diagonal → perpendicular projection onto segment
 *
 * Reads directly from GuideStore singleton — no manual sync needed.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ConstructionPointSnapEngine.ts (same singleton-read pattern)
 * @since 2026-02-19
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { projectPointOnSegment } from '../../systems/guides/guide-types';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';

/**
 * Snap engine for construction guide lines.
 * Reads directly from GuideStore singleton on every findSnapCandidates() call,
 * ensuring data is always current without manual sync.
 */
export class GuideSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.GUIDE);
  }

  /** Guides don't use scene entities — this is a no-op. */
  initialize(_entities: EntityModel[]): void {
    // Guide snap does not depend on scene entities.
    // Guides are read directly from the singleton GuideStore.
  }

  /**
   * @deprecated Use singleton read pattern instead. Kept for backward compat with SnapEngineRegistry.
   */
  setGuides(_guides: readonly import('../../systems/guides/guide-types').Guide[]): void {
    // No-op: engine now reads directly from GuideStore singleton
  }

  /**
   * Find snap candidates on guide lines near the cursor.
   *
   * Reads directly from GuideStore singleton — no manual sync needed.
   * For each visible guide within snap radius:
   * - X guide → candidate at (guide.offset, cursor.y)
   * - Y guide → candidate at (cursor.x, guide.offset)
   * - XZ guide → perpendicular projection onto segment
   */
  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const store = getGlobalGuideStore();
    const guides = store.getGuides();

    if (guides.length === 0 || !store.isVisible()) {
      return { candidates };
    }

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.GUIDE);

    for (const guide of guides) {
      if (!guide.visible) continue;

      let distance: number;
      let snapPoint: Point2D;

      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        // ADR-189 §3.3: Diagonal guide — perpendicular snap to segment
        const result = projectPointOnSegment(cursorPoint, guide.startPoint, guide.endPoint);
        distance = result.distance;
        snapPoint = result.snapPoint;
      } else if (guide.axis === 'X') {
        // Vertical guide — snap X to guide offset, keep cursor Y
        distance = Math.abs(cursorPoint.x - guide.offset);
        snapPoint = { x: guide.offset, y: cursorPoint.y };
      } else {
        // Horizontal guide — snap Y to guide offset, keep cursor X
        distance = Math.abs(cursorPoint.y - guide.offset);
        snapPoint = { x: cursorPoint.x, y: guide.offset };
      }

      if (distance <= radius) {
        candidates.push(this.createCandidate(
          snapPoint,
          guide.label ? `Guide "${guide.label}"` : `Guide (${guide.axis})`,
          distance,
          SNAP_ENGINE_PRIORITIES.GUIDE,
          guide.id,
        ));
      }

      // Performance: cap at 4 candidates
      if (candidates.length >= 4) break;
    }

    // B12: Midpoint snap between adjacent same-axis guides
    if (candidates.length < 6) {
      this.addMidpointCandidates(candidates, guides, cursorPoint, radius);
    }

    return { candidates };
  }

  /**
   * B12: Find midpoint snap candidates between adjacent same-axis guides.
   * For each axis (X, Y), sorts guides by offset, finds the pair bracketing the cursor,
   * and emits a midpoint snap if close enough.
   */
  private addMidpointCandidates(
    candidates: SnapCandidate[],
    guides: readonly import('../../systems/guides/guide-types').Guide[],
    cursor: Point2D,
    radius: number,
  ): void {
    // Collect visible X and Y guide offsets
    const xOffsets: number[] = [];
    const yOffsets: number[] = [];

    for (const g of guides) {
      if (!g.visible || g.axis === 'XZ') continue;
      if (g.axis === 'X') xOffsets.push(g.offset);
      else yOffsets.push(g.offset);
    }

    // X guides: find bracketing pair for cursor.x → midpoint snap
    if (xOffsets.length >= 2) {
      xOffsets.sort((a, b) => a - b);
      for (let i = 0; i < xOffsets.length - 1; i++) {
        if (xOffsets[i] <= cursor.x && cursor.x <= xOffsets[i + 1]) {
          const mid = (xOffsets[i] + xOffsets[i + 1]) / 2;
          const dist = Math.abs(cursor.x - mid);
          if (dist <= radius) {
            candidates.push(this.createCandidate(
              { x: mid, y: cursor.y },
              'Guide Midpoint (X)',
              dist,
              SNAP_ENGINE_PRIORITIES.GUIDE,
              `midpoint_x_${i}`,
            ));
          }
          break;
        }
      }
    }

    // Y guides: find bracketing pair for cursor.y → midpoint snap
    if (yOffsets.length >= 2) {
      yOffsets.sort((a, b) => a - b);
      for (let i = 0; i < yOffsets.length - 1; i++) {
        if (yOffsets[i] <= cursor.y && cursor.y <= yOffsets[i + 1]) {
          const mid = (yOffsets[i] + yOffsets[i + 1]) / 2;
          const dist = Math.abs(cursor.y - mid);
          if (dist <= radius) {
            candidates.push(this.createCandidate(
              { x: cursor.x, y: mid },
              'Guide Midpoint (Y)',
              dist,
              SNAP_ENGINE_PRIORITIES.GUIDE,
              `midpoint_y_${i}`,
            ));
          }
          break;
        }
      }
    }
  }

  /** No resources to clean up. */
  dispose(): void {
    // No local state — reads from singleton store
  }
}
