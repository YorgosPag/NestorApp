/**
 * POLAR CENTER PICK CONTROLLER — ADR-353 Session B2
 *
 * Single-shot interactive pick of a polar array's center point. Triggered
 * from the contextual ribbon ("Pick Center" action) on an existing polar
 * ArrayEntity. The user's next canvas click lands here; we patch the
 * `PolarParams.center` (radius left at 0 → auto-derive from new center) via
 * `UpdateArrayParamsCommand` and exit the mode.
 *
 * Mirrors `array-edit-source-mode.ts` orchestrator pattern: pure state
 * transitions on `ArrayStore` + a thin command-dispatch helper. Snap-aware
 * point sourcing is the caller's responsibility (the canvas-click handler
 * already feeds snapped world points to every tool — see ADR-049/350).
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { isArrayEntity } from '../../types/entities';
import { UpdateArrayParamsCommand } from '../../core/commands/entity-commands/UpdateArrayParamsCommand';
import { ArrayStore } from './ArrayStore';

export interface PickCenterResult {
  readonly ok: boolean;
  readonly reason?: 'not-picking' | 'not-found' | 'not-polar';
}

/** Enter center-pick mode for a specific polar array. */
export function enterCenterPickMode(arrayId: string): void {
  ArrayStore.setPickingCenterArrayId(arrayId);
}

/** Exit center-pick mode without committing a change. */
export function exitCenterPickMode(): void {
  ArrayStore.clearPickingCenterArrayId();
}

/** UI predicate — leaf components subscribe via ArrayStore for re-render. */
export function isPickingCenter(arrayId: string): boolean {
  return ArrayStore.getState().pickingCenterArrayId === arrayId;
}

/** Whatever array (if any) is currently in center-pick mode. */
export function getPickingCenterArrayId(): string | null {
  return ArrayStore.getState().pickingCenterArrayId;
}

/**
 * Apply a snapped world point as the polar array's new center. Issues
 * `UpdateArrayParamsCommand` (non-dragging → standalone undo step) and
 * exits the pick mode. Radius is reset to 0 so the renderer auto-derives
 * the new value from the freshly-picked center.
 */
export function applyCenterPick(
  worldPoint: Point2D,
  sceneManager: ISceneManager,
  executeCommand: (cmd: ICommand) => void,
): PickCenterResult {
  const arrayId = ArrayStore.getState().pickingCenterArrayId;
  if (!arrayId) return { ok: false, reason: 'not-picking' };

  const raw = sceneManager.getEntity(arrayId);
  if (!raw) {
    exitCenterPickMode();
    return { ok: false, reason: 'not-found' };
  }
  const entity = raw as unknown as Entity;
  if (!isArrayEntity(entity) || entity.params.kind !== 'polar') {
    exitCenterPickMode();
    return { ok: false, reason: 'not-polar' };
  }

  const previousParams = entity.params;
  const nextParams = {
    ...previousParams,
    center: { x: worldPoint.x, y: worldPoint.y },
    radius: 0,
  };

  executeCommand(
    new UpdateArrayParamsCommand(
      arrayId,
      nextParams,
      previousParams,
      sceneManager,
      false,
    ),
  );

  exitCenterPickMode();
  return { ok: true };
}
