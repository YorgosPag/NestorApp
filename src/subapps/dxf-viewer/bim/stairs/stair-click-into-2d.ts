/**
 * stair-click-into-2d — 2D «click-into» gesture decision (ADR-358 Q19 Φ3b).
 *
 * Revit / ArchiCAD component selection: a 2nd plain click on the ALREADY-sole-
 * selected stair, over a tread, selects that tread SUB-element instead of
 * re-selecting the whole stair. The stair stays the selected host — NEVER exploded.
 *
 * This is the plan-view mirror of the 3D gesture in
 * `bim-3d/viewport/use-bim3d-pointer-handlers.ts` (handleClick). The only
 * difference is HOW the sub-index is resolved: 3D reads the raycast
 * `stairComponentIndex` tag, whereas 2D runs a polygon hit-test via the shared
 * `hitTestStairSubElement` SSoT. The decision itself (already-sole + plain click +
 * a stair under the cursor) is identical.
 *
 * Kept as a PURE resolver (no store / event imports) so the caller
 * (`mouse-handler-up`) stays thin and the gesture is unit-testable in isolation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isStairEntity } from '../../types/entities';
import { hitTestStairSubElement, type StairHitInput } from './stair-sub-element-hit';
import type { StairSubElementRef } from './stair-sub-element-selection-store';
import { useStairSubElementSelectionStore } from './stair-sub-element-selection-store';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';

export interface StairClickIntoInput {
  /** True when Shift/Ctrl is held — a multi-select click NEVER enters a sub-element. */
  readonly additive: boolean;
  /** World-XY click point, in the SAME space as the tread polygons. */
  readonly worldPoint: Point2D;
  /** The entity under the cursor as a stair, or `null` when it is not a stair. */
  readonly stair: StairHitInput | null;
  /** True when that stair is ALREADY the sole-selected 2D entity (the 1st click landed it). */
  readonly isAlreadySole: boolean;
}

export type StairClickIntoDecision =
  /** Enter the tread sub-element under the cursor (caller: `selectSub` + skip whole-select). */
  | { readonly kind: 'sub'; readonly ref: StairSubElementRef }
  /** Whole-entity select (caller: `clear` sub-selection + run the normal select path). */
  | { readonly kind: 'whole' };

const WHOLE: StairClickIntoDecision = { kind: 'whole' };

/**
 * Resolve the 2D click into either a tread sub-selection (Revit «click-into») or a
 * normal whole-entity select. Returns `'whole'` unless a plain click lands on the
 * already-sole-selected stair AND a tread sits under the point.
 */
export function resolveStairClickInto(input: StairClickIntoInput): StairClickIntoDecision {
  if (input.additive || !input.stair || !input.isAlreadySole) return WHOLE;
  const ref = hitTestStairSubElement(input.stair, input.worldPoint);
  return ref ? { kind: 'sub', ref } : WHOLE;
}

/**
 * Store-wiring wrapper called from `mouse-handler-up` at a 2D single-point pick.
 * Resolves the click against the sub-element selection store (`SelectedEntitiesStore`
 * for the sole-selection check) and applies the decision:
 *   - `'sub'`  → `selectSub` + returns `true` (CONSUME the click; the stair host stays selected).
 *   - `'whole'`/miss → `clear()` any stale sub-selection + returns `false` (run the normal select).
 *
 * `null` hitEntityId (empty-space click) also clears. Kept here (not inline in
 * `mouse-handler-up`) so that handler stays thin and under the 500-line budget (N.7.1),
 * while the pure {@link resolveStairClickInto} stays independently unit-testable.
 */
export function handleStairClickInto2D(
  hitEntityId: string | null,
  additive: boolean,
  worldPoint: Point2D,
  entities: readonly Entity[] | undefined,
): boolean {
  if (hitEntityId) {
    const hit = entities?.find((en) => en.id === hitEntityId);
    const decision = resolveStairClickInto({
      additive,
      worldPoint,
      stair: hit && isStairEntity(hit) ? hit : null,
      isAlreadySole: SelectedEntitiesStore.count() === 1 && SelectedEntitiesStore.isSelected(hitEntityId),
    });
    if (decision.kind === 'sub') {
      useStairSubElementSelectionStore.getState().selectSub(decision.ref);
      return true;
    }
  }
  useStairSubElementSelectionStore.getState().clear();
  return false;
}
