/**
 * PATH PICK CONTROLLER — ADR-353 Session C3
 *
 * Single-shot interactive pick of a path array's path entity. Triggered from
 * the contextual ribbon ("Pick Path" action) on an existing path ArrayEntity.
 * The user's next canvas click lands here; we read the hovered entity ID at
 * click time (HoverStore), validate it is a supported path entity, and patch
 * `PathParams.pathEntityId` via `UpdateArrayParamsCommand`.
 *
 * Mirrors `polar-center-pick-controller.ts` pattern. Key difference: polar
 * picks a WORLD POINT → updates `center: Point2D`; path picks an ENTITY ID
 * → updates `pathEntityId: string`. Hover-based identification avoids
 * implementing custom hit-testing — the existing snap/hover pipeline already
 * resolves the entity under the cursor.
 *
 * Supported path entity types (mirrors path-arc-length-sampler.ts STRATEGIES):
 *   line, polyline, lwpolyline, arc, circle, ellipse, spline
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import { UpdateArrayParamsCommand } from '../../core/commands/entity-commands/UpdateArrayParamsCommand';
import { ArrayStore } from './ArrayStore';
import { getHoveredEntity } from '../hover/HoverStore';

export const PATH_ENTITY_TYPES = new Set([
  'line', 'polyline', 'lwpolyline', 'arc', 'circle', 'ellipse', 'spline',
]);

export interface PickPathResult {
  readonly ok: boolean;
  readonly reason?: 'not-picking' | 'not-found' | 'not-path' | 'invalid-path-type';
}

export function enterPathPickMode(arrayId: string): void {
  ArrayStore.setPickingPathArrayId(arrayId);
}

export function exitPathPickMode(): void {
  ArrayStore.clearPickingPathArrayId();
}

export function isPickingPath(arrayId: string): boolean {
  return ArrayStore.getState().pickingPathArrayId === arrayId;
}

export function getPickingPathArrayId(): string | null {
  return ArrayStore.getState().pickingPathArrayId;
}

/**
 * Apply the hovered entity (from HoverStore) as the path array's new path.
 * Returns `{ ok: false, reason: 'invalid-path-type' }` if the hovered entity
 * is not a supported curve type — caller should surface a hint in that case.
 */
export function applyPathPick(
  sceneManager: ISceneManager,
  executeCommand: (cmd: ICommand) => void,
): PickPathResult {
  const arrayId = ArrayStore.getState().pickingPathArrayId;
  if (!arrayId) return { ok: false, reason: 'not-picking' };

  const hoveredId = getHoveredEntity();
  if (!hoveredId) return { ok: false, reason: 'not-found' };

  const rawArray = sceneManager.getEntity(arrayId);
  if (!rawArray) {
    exitPathPickMode();
    return { ok: false, reason: 'not-found' };
  }
  const arrayEnt = rawArray as unknown as Entity;
  if (!isArrayEntity(arrayEnt) || arrayEnt.params.kind !== 'path') {
    exitPathPickMode();
    return { ok: false, reason: 'not-path' };
  }

  const rawPath = sceneManager.getEntity(hoveredId);
  if (!rawPath) {
    exitPathPickMode();
    return { ok: false, reason: 'not-found' };
  }
  const pathEnt = rawPath as unknown as Entity;
  if (!PATH_ENTITY_TYPES.has(pathEnt.type)) {
    return { ok: false, reason: 'invalid-path-type' };
  }

  const previousParams = arrayEnt.params;
  const nextParams = { ...previousParams, pathEntityId: hoveredId };

  executeCommand(
    new UpdateArrayParamsCommand(arrayId, nextParams, previousParams, sceneManager, false),
  );

  exitPathPickMode();
  return { ok: true };
}
