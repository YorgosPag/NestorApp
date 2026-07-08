/**
 * ADR-561 EXT — Ctrl + drag an ENDPOINT / VERTEX = ROTATE-COPY (hinge) SSoT resolver.
 *
 * Revit/AutoCAD-grade gesture: with the Selection tool, press-hold the left button on a
 * plain endpoint / vertex grip of a line / arc / polyline WHILE holding Control → the
 * primitive is rotate-COPIED about that endpoint (pivot = the grabbed point), spinning
 * live with the cursor; on release a NEW entity is created, hinged to the original at the
 * pivot (the original stays put). This is the EXISTING free-rotate hot-grip flow with the
 * pivot pre-picked at the endpoint + the copy flag — NOT a new rotation mechanism.
 *
 * This pure resolver is the ONE decision point (unit-tested, DOM-free): given the grabbed
 * grip + its entity + the live Ctrl state, it decides whether the gesture qualifies and, if
 * so, returns the pivot + a SYNTHETIC grip carrying the primitive's rotation kind. The
 * synthetic kind is what routes both the live ghost (`apply-entity-preview`) and the commit
 * (`commitLineGripDrag` / `commitArcGripDrag` / `commitPolylineRotationGripDrag`) into the
 * canonical rotation path — the plain endpoint grip has no kind and would otherwise stretch.
 *
 * Strict gate: fires ONLY with Ctrl held on a PLAIN vertex grip (`type: 'vertex'`,
 * `movesEntity` falsy, no primitive grip kind). Without Ctrl the endpoint stays a normal
 * stretch grip (unchanged). Move / rotation handles already carry their own kind and are
 * rejected here so they keep their role (the rotation handle's own Ctrl-copy is handled at
 * commit, not here).
 *
 * @see hooks/grips/grip-mouse-handlers.ts — `runGripMouseDown` consumer (the trigger)
 * @see hooks/grips/grip-hotgrip-actions.ts — `advanceHotGripPick` rotate `await-base` branch (mirrored)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import { LINE_ROTATION_KIND } from '../../systems/line/line-grips';
import { ARC_ROTATION_KIND } from '../../systems/arc/arc-grips';
import { POLYLINE_ROTATION_KIND } from '../../systems/polyline/polyline-grips';

/** Minimal structural view of the grabbed entity — keeps the resolver decoupled + pure. */
interface RotateCopyEntity {
  readonly type?: string;
}

/** The resolved gesture: the hinge pivot (= the grabbed endpoint) + the rotation-kinded grip. */
export interface CtrlEndpointRotateCopy {
  /** Rotation centre = the grabbed endpoint / vertex world position. */
  readonly pivot: Point2D;
  /** The grabbed grip re-flavoured with the primitive's rotation kind (commit/preview routing). */
  readonly syntheticGrip: UnifiedGripInfo;
}

/**
 * Decide whether `Ctrl + press` on `grip` (belonging to `entity`) starts a rotate-copy
 * hinge about the grabbed endpoint. Returns `null` when the gesture does not qualify.
 */
export function resolveCtrlEndpointRotateCopy(
  entity: RotateCopyEntity | null | undefined,
  grip: UnifiedGripInfo | null | undefined,
  ctrlHeld: boolean,
): CtrlEndpointRotateCopy | null {
  if (!ctrlHeld || !entity || !grip) return null;
  if (grip.source !== 'dxf') return null;
  // A PLAIN endpoint / vertex only: a moving handle (movesEntity) or any primitive
  // move/rotation handle carries its own kind and must keep its role.
  if (grip.type !== 'vertex' || grip.movesEntity === true) return null;

  const pivot: Point2D = { x: grip.position.x, y: grip.position.y };
  switch (entity.type) {
    // ADR-602 Stage 5 — the synthetic grip carries the tagged `gripKind` (this is a
    // producer: without it, `gripKindOf(syntheticGrip, …)` at the consumers in
    // `grip-mouse-handlers.ts` would read `undefined` → silent regression).
    case 'line':
      if (gripKindOf(grip, 'line')) return null;
      return {
        pivot,
        syntheticGrip: { ...grip, gripKind: { on: 'line', kind: LINE_ROTATION_KIND } },
      };
    case 'arc':
      if (gripKindOf(grip, 'arc')) return null;
      return {
        pivot,
        syntheticGrip: { ...grip, gripKind: { on: 'arc', kind: ARC_ROTATION_KIND } },
      };
    // A scene rectangle shows polyline grips in the DXF pipeline → same vertex path.
    case 'polyline':
    case 'lwpolyline':
    case 'rectangle':
    case 'rect':
      if (gripKindOf(grip, 'polyline')) return null;
      return {
        pivot,
        syntheticGrip: { ...grip, gripKind: { on: 'polyline', kind: POLYLINE_ROTATION_KIND } },
      };
    default:
      return null;
  }
}
