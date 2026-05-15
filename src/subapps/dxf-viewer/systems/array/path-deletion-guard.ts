/**
 * PATH DELETION GUARD — ADR-353 Q23, Session A4
 *
 * Intercepts deletion of an entity that is referenced as `pathEntityId` by
 * any path-array in the scene. The caller (DeleteEntityCommand wrapper or
 * canvas delete handler) invokes `checkPathDeletion(entityId, scene)` and,
 * if a referencing array is found, presents `PathDeletionWarningDialog`
 * with three options: delete both / explode array / cancel.
 *
 * In Phase A (rect-only) no path arrays exist, so `checkPathDeletion` is
 * effectively a no-op. The hook is wired now so Phase C (path arrays) can
 * activate without further touch-points outside this module.
 */

import type { Entity } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';

export type PathDeletionAction = 'delete-both' | 'explode' | 'cancel';

export interface PathDeletionWarning {
  /** ID of the entity being deleted. */
  readonly targetEntityId: string;
  /** Array entities that reference `targetEntityId` as their pathEntityId. */
  readonly referencingArrayIds: ReadonlyArray<string>;
}

/**
 * Scan a scene for path-arrays referencing the target entity. Returns null
 * when no array depends on the entity (deletion is safe).
 */
export function checkPathDeletion(
  targetEntityId: string,
  entities: ReadonlyArray<Entity>,
): PathDeletionWarning | null {
  const refs: string[] = [];
  for (const e of entities) {
    if (!isArrayEntity(e)) continue;
    if (e.pathEntityId === targetEntityId) refs.push(e.id);
  }
  if (refs.length === 0) return null;
  return { targetEntityId, referencingArrayIds: refs };
}

/**
 * Phase-A guard hook for DeleteEntityCommand. Currently a synchronous
 * no-op because no path arrays exist yet. When Phase C lands and path
 * arrays become creatable, this hook will route to a dialog promise.
 *
 * Pattern: returns the resolved user action. `'delete-both'` lets the
 * caller proceed with deletion + cascading array deletes; `'explode'`
 * exchanges arrays for their items first; `'cancel'` aborts the delete.
 */
export async function awaitPathDeletionDecision(
  _warning: PathDeletionWarning,
): Promise<PathDeletionAction> {
  // Phase A: dialog wiring deferred — see Phase C session C3.
  // Returning 'cancel' is the safe default since rect arrays cannot
  // trigger this code path in Phase A.
  return 'cancel';
}
