/**
 * @module snapping/engines/SelectedGripSnapEngine
 * @description POINT-magnetism snap engine for the grips of the CURRENTLY SELECTED objects
 * (ADR-580). When an entity is selected its grips are drawn; hovering one to GRAB it must
 * attract to the GRIP — not to a coincident snap point of an UNSELECTED entity lying under
 * it (an arc / line / polyline the hatch was traced over). Before this engine both were plain
 * ENDPOINT-tier candidates, so on coincidence the *distance* tiebreak let the underlying
 * entity win (marker + attraction) and the grip became hard to grab (Giorgio 2026-07-07).
 *
 * The engine surfaces the selected objects' grips as candidates with a priority STRONGER than
 * every static underlying snap (endpoint 0 / node 1 / bim_corner -2 → SELECTED_GRIP -3), so the
 * `SnapCandidateProcessor` (sorts by priority THEN distance) always picks the selected object's
 * grip when points coincide. The selected entity wins the competition — exactly the request.
 *
 * Reads the singleton `AllGripsStore` at query time (mirror of `RotationGripSnapEngine` /
 * `ConstructionPointSnapEngine`): the `GripRegistryPublisher` leaf keeps it in sync with the
 * selection set. Empty selection → empty store → zero candidates, zero cost. It deliberately
 * EXCLUDES the grips of the entity whose grip is being dragged (`GripDragStore` active drag +
 * `context.excludeEntityId`), so a live grip drag snaps the dragged vertex to OTHER geometry
 * (to fix the boundary) instead of magnetising back onto the entity's own original grips.
 *
 * @see ADR-580 — selected-grip snap precedence
 * @see engines/RotationPointSnapEngine.ts (template — contextual store-backed grip snap)
 * @see systems/grip/AllGripsStore.ts (the selection grip set SSoT)
 * @since 2026-07-07
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { AllGripsStore } from '../../systems/grip/AllGripsStore';
import { getActiveDragGrip } from '../../systems/cursor/GripDragStore';

/** Max grip candidates surfaced per tick (performance cap — a dense hatch has many grips). */
const MAX_SELECTED_GRIP_CANDIDATES = 8;

/** Euclidean distance helper. */
function dist(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Snap to the grips of the currently selected objects. Reads `AllGripsStore.get()`.
 */
export class SelectedGripSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.SELECTED_GRIP);
  }

  /** Grips live in the singleton store (selection-driven) — no scene-entity dependency. */
  initialize(_entities: EntityModel[]): void {
    // no-op
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const grips = AllGripsStore.get();
    if (grips.length === 0) return { candidates: [] };

    // Never snap the dragged vertex back onto its own entity's grips: exclude the entity
    // currently being dragged (baked active-drag record) AND any caller-supplied exclusion.
    const excludeId = context.excludeEntityId ?? getActiveDragGrip()?.entityId;

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.SELECTED_GRIP);
    const candidates: SnapCandidate[] = [];

    for (const grip of grips) {
      if (excludeId && grip.entityId === excludeId) continue;
      const d = dist(cursorPoint, grip.position);
      if (d <= radius) {
        candidates.push(
          this.createCandidate(
            grip.position,
            'Selected Grip',
            d,
            SNAP_ENGINE_PRIORITIES.SELECTED_GRIP,
            grip.entityId,
          ),
        );
        if (candidates.length >= MAX_SELECTED_GRIP_CANDIDATES) break;
      }
    }

    return { candidates };
  }

  dispose(): void {
    // reads from singleton store — nothing to clean
  }
}
