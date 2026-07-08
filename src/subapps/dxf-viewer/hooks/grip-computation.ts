/**
 * DXF GRIP COMPUTATION — PURE FUNCTIONS
 *
 * AutoCAD-style grip point computation from DXF entity geometry.
 * No React dependency — pure math functions.
 *
 * @module hooks/grip-computation
 * @see useDxfGripInteraction.ts (deprecated hook)
 * @see hooks/grips/useUnifiedGripInteraction (active replacement)
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from './useGripMovement';
// ADR-587 Φ7 — introspectable per-type grip-producer registry (SRP sibling, N.7.1).
// The producers there import the leaf `get*Grips` SSoTs; this module only dispatches.
import { GRIP_PRODUCERS } from './grip-computation-producers';

// ============================================================================
// TYPES — extracted to grip-computation-types.ts (re-exported for compat)
// ============================================================================

export type {
  GripPhase,
  GripIdentifier,
  DxfGripDragPreview,
  DxfGripInteractionState,
  UseDxfGripInteractionReturn,
} from './grip-computation-types';

// ADR-587 Φ7 — re-export the produced-type set so the descriptor-domain coverage test
// and any discovery path can read it from the grip-computation entry point
// (implementation lives in the sibling `grip-computation-producers.ts`).
export { GRIP_PRODUCER_SUPPORTED_TYPES } from './grip-computation-producers';

// ============================================================================
// PURE: Compute grips from DXF entity geometry
// ============================================================================

/**
 * Dispatch grip computation via the introspectable `GRIP_PRODUCERS` seam (ADR-587 Φ7).
 * A missing producer ⇒ `[]` (the per-site silent-empty default, pinned explicitly per
 * ADR-587 §4.6) — the exact behaviour of the pre-Φ7 `switch` with no `default` clause.
 */
export function computeDxfEntityGrips(entity: DxfEntityUnion): GripInfo[] {
  const producer = GRIP_PRODUCERS[entity.type];
  return producer ? producer(entity) : [];
}

/** Recalculate angle (degrees) between two arms meeting at a vertex */
export function computeAngleDegrees(vertex: Point2D, p1: Point2D, p2: Point2D): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = Math.abs(a2 - a1) * (180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}
