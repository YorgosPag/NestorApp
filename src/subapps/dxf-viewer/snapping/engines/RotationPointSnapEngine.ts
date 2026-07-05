/**
 * @module snapping/engines/RotationPointSnapEngine
 * @description POINT-magnetism snap engines active DURING a BIM rotation operation (ADR-397).
 * NOTE: these snap the CURSOR to a POINT (pivot / grip) — they do NOT quantize the rotation ANGLE
 * (angle-lock is ORTHO/POLAR via `resolveOrthoPolarStep`). Named `...PointSnapEngine` to end the
 * long-standing confusion with angle snapping.
 *  - `RotationPivotSnapEngine` → the rotation centre ⊙ (highest precision).
 *  - `RotationGripSnapEngine`  → the rotating entity's grips.
 *
 * Both read the singleton `RotationSnapStore` at query time (mirror of
 * `ConstructionPointSnapEngine`). They deliberately IGNORE `excludeEntityId`:
 * the whole point is to magnetise the cursor to THIS entity's pivot/grips while
 * it rotates. Outside a rotation the store is empty → zero candidates, zero cost.
 *
 * @see ADR-397 §15 — rotation snap targets SSoT
 * @see ConstructionPointSnapEngine.ts (template)
 * @since 2026-06-11
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { getGlobalRotationSnapStore } from '../../bim/grips/rotation-snap-store';

/** Max grip candidates surfaced per tick (performance cap). */
const MAX_ROTATION_GRIP_CANDIDATES = 8;

/** Euclidean distance helper. */
function dist(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Snap to the rotation pivot ⊙. Reads `RotationSnapStore.getPivot()`.
 */
export class RotationPivotSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.ROTATION_PIVOT);
  }

  /** Pivot lives in the singleton store — no scene-entity dependency. */
  initialize(_entities: EntityModel[]): void {
    // no-op
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const pivot = getGlobalRotationSnapStore().getPivot();
    if (!pivot) return { candidates: [] };

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.ROTATION_PIVOT);
    const d = dist(cursorPoint, pivot);
    if (d > radius) return { candidates: [] };

    return {
      candidates: [
        this.createCandidate(pivot, 'Rotation Centre', d, SNAP_ENGINE_PRIORITIES.ROTATION_PIVOT),
      ],
    };
  }

  dispose(): void {
    // reads from singleton store — nothing to clean
  }
}

/**
 * Snap to the rotating entity's grips. Reads `RotationSnapStore.getGrips()`.
 */
export class RotationGripSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.ROTATION_GRIP);
  }

  /** Grips live in the singleton store — no scene-entity dependency. */
  initialize(_entities: EntityModel[]): void {
    // no-op
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const grips = getGlobalRotationSnapStore().getGrips();
    if (grips.length === 0) return { candidates: [] };

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.ROTATION_GRIP);
    const candidates: SnapCandidate[] = [];

    for (const grip of grips) {
      const d = dist(cursorPoint, grip.point);
      if (d <= radius) {
        candidates.push(
          this.createCandidate(grip.point, 'Rotation Grip', d, SNAP_ENGINE_PRIORITIES.ROTATION_GRIP),
        );
        if (candidates.length >= MAX_ROTATION_GRIP_CANDIDATES) break;
      }
    }

    return { candidates };
  }

  dispose(): void {
    // reads from singleton store — nothing to clean
  }
}
