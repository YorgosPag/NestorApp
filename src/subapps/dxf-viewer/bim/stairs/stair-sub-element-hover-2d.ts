/**
 * stair-sub-element-hover-2d — 2D per-tread HOVER resolution (ADR-358 Q19 Φ3c).
 *
 * Plan-view mirror of the 3D pre-highlight: while a stair is the SOLE-selected
 * entity (Revit «click-into» component mode — after the 1st whole select or after
 * a Φ3b tread click), moving the cursor over a tread pre-highlights it. Outside
 * that mode, or over a different entity / empty space, hover is cleared.
 *
 * The gate is IDENTICAL to the Φ3b click-into decision (`stair-click-into-2d`):
 * `SelectedEntitiesStore.count()===1 && isSelected(stairId)` + `isStairEntity` +
 * the shared `hitTestStairSubElement` SSoT — so hover and click agree on exactly
 * which tread is targeted. Called from the throttled 2D hover path
 * (`mouse-handler-move`) with the already-resolved hovered entity id, so the extra
 * work runs ONLY when a stair is under the cursor in component mode (rare state).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 * @see stair-click-into-2d.ts (the click-gesture twin sharing the same gate)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isStairEntity } from '../../types/entities';
import { hitTestStairSubElement } from './stair-sub-element-hit';
import type { StairSubElementRef } from './stair-sub-element-selection-store';
import { setStairSubElementHover } from './stair-sub-element-selection-store';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';

/**
 * Pure gate: the tread under `worldPoint` when `hitEntityId` is the sole-selected
 * stair, else `null`. No store writes — unit-testable in isolation.
 */
export function resolveStairSubElementHover2D(
  hitEntityId: string | null,
  worldPoint: Point2D,
  entities: readonly Entity[] | undefined,
): StairSubElementRef | null {
  if (!hitEntityId) return null;
  const isAlreadySole =
    SelectedEntitiesStore.count() === 1 && SelectedEntitiesStore.isSelected(hitEntityId);
  if (!isAlreadySole) return null;
  const hit = entities?.find((en) => en.id === hitEntityId);
  if (!hit || !isStairEntity(hit)) return null;
  return hitTestStairSubElement(hit, worldPoint);
}

/**
 * Resolve + publish the hovered tread to the shared hover singleton (skip-if-
 * unchanged inside the setter → zero redraw on a same-tread move). Called from the
 * throttled 2D hover path; clearing (`null`) drops a stale pre-highlight.
 */
export function updateStairSubElementHover2D(
  hitEntityId: string | null,
  worldPoint: Point2D,
  entities: readonly Entity[] | undefined,
): void {
  setStairSubElementHover(resolveStairSubElementHover2D(hitEntityId, worldPoint, entities));
}
