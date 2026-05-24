/**
 * ADR-366 Phase 9 / C.2 — BIM comment anchor utilities.
 *
 * Provides pure functions for:
 *  - Detecting orphaned entity-anchored comments (entity was deleted).
 *  - Converting entity-anchored → world-anchored (orphan recovery).
 *  - Resolving the world position of any anchor for billboard placement.
 *
 * No Firebase, no React, no Three.js imports.
 */

import type { CommentAnchor } from './bim-comment-types';

export function detectOrphaned(
  anchor: CommentAnchor,
  liveEntityIds: ReadonlySet<string>,
): boolean {
  if (anchor.type !== 'entity' || !anchor.entityId) return false;
  return !liveEntityIds.has(anchor.entityId);
}

/**
 * Converts an entity-anchored comment to a world-anchored one.
 * Called when the host entity is deleted — preserves the last known world position.
 */
export function resolveWorldAnchor(anchor: CommentAnchor): CommentAnchor {
  return {
    type: 'world',
    entityId: undefined,
    position: anchor.position,
    normal: anchor.normal,
  };
}

/**
 * Equality check — avoids Firestore re-renders when position didn't actually change.
 */
export function anchorsEqual(a: CommentAnchor, b: CommentAnchor): boolean {
  if (a.type !== b.type || a.entityId !== b.entityId) return false;
  return (
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z
  );
}
