/**
 * ARRAY EDIT SOURCE MODE — ADR-353 Q21/Q24, Session A4
 *
 * Controller for the "Edit Array Source" mode (AutoCAD ARRAYEDIT pattern).
 * On enter: the ArrayEntity's hiddenSources are temporarily restored into
 * the scene as editable entities; items render at 50% opacity. On exit:
 * the (possibly-mutated) source group is re-extracted and stored back in
 * `hiddenSources`; items refresh.
 *
 * The mode is a pure orchestrator over ArrayStore + ISceneManager. Entry
 * points:
 *   - `enterEditSource(arrayId, sceneManager)`  — restore sources to scene
 *   - `exitEditSource(arrayId, sceneManager)`   — re-extract + clear store
 *   - `isEditingSource(arrayId)`                — UI predicate
 *
 * Empty-source guard (Q24): if user deletes the last source entity while
 * in edit mode, `exitEditSource` reports `{ ok: false, reason: 'empty' }`
 * so the caller can surface `EmptySourceWarningDialog` before committing.
 */

import type { ArrayEntity, Entity } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import {
  extractSourcesFromScene,
  restoreSourcesToScene,
} from './array-source-extraction';
import { ArrayStore } from './ArrayStore';

export interface EditSourceExitResult {
  readonly ok: boolean;
  readonly reason?: 'empty' | 'not-editing' | 'not-found';
}

/**
 * Enter Edit Source mode for the given array. Restores hiddenSources into
 * the scene so the user can modify/add/delete them with regular tools.
 */
export function enterEditSource(
  arrayId: string,
  sceneManager: ISceneManager,
): boolean {
  const raw = sceneManager.getEntity(arrayId);
  if (!raw) return false;
  const entity = raw as unknown as Entity;
  if (!isArrayEntity(entity)) return false;

  // Restore hiddenSources to scene so they become editable.
  restoreSourcesToScene(entity.hiddenSources, sceneManager);
  ArrayStore.setEditSourceArrayId(arrayId);
  return true;
}

/**
 * Exit Edit Source mode. Re-extracts the (possibly-mutated) sources from
 * scene and patches them back into the ArrayEntity's hiddenSources.
 *
 * Returns `{ ok: false, reason: 'empty' }` if the user removed the last
 * source — caller should show the EmptySourceWarningDialog.
 */
export function exitEditSource(
  arrayId: string,
  sceneManager: ISceneManager,
  sourceIdsAtEnter: ReadonlyArray<string>,
): EditSourceExitResult {
  const state = ArrayStore.getState();
  if (state.editSourceArrayId !== arrayId) {
    return { ok: false, reason: 'not-editing' };
  }

  const raw = sceneManager.getEntity(arrayId);
  if (!raw) {
    ArrayStore.clearEditSourceArrayId();
    return { ok: false, reason: 'not-found' };
  }

  // Collect surviving sources from the scene (user may have added/removed).
  // For Phase A we look up by the IDs that were restored on enter — any
  // newly-added entities while in edit mode are tracked separately by the
  // caller and passed in via the next phase's expanded API.
  const sources: Entity[] = [];
  for (const id of sourceIdsAtEnter) {
    const e = sceneManager.getEntity(id);
    if (e) sources.push(e as unknown as Entity);
  }

  if (sources.length === 0) {
    // Empty-source guard (Q24): do NOT extract; keep caller in edit mode
    // so they can either cancel (revert) or confirm (delete the array).
    return { ok: false, reason: 'empty' };
  }

  const newHiddenSources = extractSourcesFromScene(sources, sceneManager);
  sceneManager.updateEntity(arrayId, {
    hiddenSources: newHiddenSources,
  } as unknown as Partial<SceneEntity>);
  ArrayStore.clearEditSourceArrayId();
  return { ok: true };
}

/** UI predicate — leaf components subscribe via ArrayStore for re-render. */
export function isEditingSource(arrayId: string): boolean {
  return ArrayStore.getState().editSourceArrayId === arrayId;
}

/** Resolves the ArrayEntity currently in edit mode, or null. */
export function getEditingArray(
  sceneManager: ISceneManager,
): ArrayEntity | null {
  const id = ArrayStore.getState().editSourceArrayId;
  if (!id) return null;
  const raw = sceneManager.getEntity(id);
  if (!raw) return null;
  const entity = raw as unknown as Entity;
  return isArrayEntity(entity) ? entity : null;
}
