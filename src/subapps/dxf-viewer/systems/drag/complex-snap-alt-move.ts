/**
 * complex-snap-alt-move — ADR-642 §6.8 (Φ6-OSNAP): Alt+press on a complex-linetype
 * pattern snap → whole-entity move of the underlying line from that PRECISE base point.
 *
 * The complex-linetype OSNAP (railway rails + sleepers) is normally a read-only cursor
 * magnet. This adds the AutoCAD "move-from-characteristic-point" gesture to it: holding
 * **Alt** while pressing on an active rail/sleeper snap grabs the line at that exact snap
 * point and drags the WHOLE entity — the same mental model as the grip Alt-move
 * (`GripAltMoveStore`), but the base point comes from a pattern snap instead of a grip.
 *
 * ZERO new move machinery (N.18): it arms the EXISTING body-drag pipeline
 * (`EntityBodyDragStore`) with the snap point as the anchor, so the live ghost
 * (`useEntityBodyDragPreview`) + the commit (`mouse-handler-up` → `entity-body-drag:commit`)
 * + ESC/blur cancel all work unchanged. The only difference from a plain body-drag is the
 * precise snap-point anchor (a body-drag anchors at the raw press point).
 *
 * @see systems/drag/EntityBodyDragStore.ts — the reused whole-entity drag session
 * @see systems/cursor/useCentralizedMouseHandlers.ts — the mousedown branch that calls this
 * @see snapping/engines/ComplexLinetypeSnapEngine.ts — the source of the snap
 */

import { EntityBodyDragStore } from './EntityBodyDragStore';
import { getFullSnapResult } from '../cursor/ImmediateSnapStore';
import { ExtendedSnapType } from '../../snapping/extended-types';

/** The complex-linetype pattern snap types (railway rail/sleeper endpoint/midpoint/intersection). */
const COMPLEX_SNAP_TYPES: ReadonlySet<string> = new Set<string>([
  ExtendedSnapType.COMPLEX_ENDPOINT,
  ExtendedSnapType.COMPLEX_MIDPOINT,
  ExtendedSnapType.COMPLEX_INTERSECTION,
]);

/** Is `mode` one of the complex-linetype pattern snap types (rail/sleeper)? */
export function isComplexSnapMode(mode: string | null | undefined): boolean {
  return !!mode && COMPLEX_SNAP_TYPES.has(mode);
}

/**
 * If the active snap is a complex-linetype pattern snap carrying an entity, arm a
 * whole-entity body-drag of that entity from the snap point (Alt move-from-base-point).
 *
 * @param copy freeze the Ctrl/⌘ state at press → clone-at-destination instead of move
 * @returns `true` when a drag was armed (the caller consumes the mousedown), else `false`
 *          (no complex snap active → the caller falls through to its normal gesture).
 */
export function tryArmComplexSnapAltMove(copy: boolean): boolean {
  const result = getFullSnapResult();
  const cand = result?.found ? result.snapPoint : null;
  if (!cand || !isComplexSnapMode(cand.type) || !cand.entityId) return false;
  EntityBodyDragStore.arm({ anchor: cand.point, entityIds: [cand.entityId], copy });
  return true;
}
