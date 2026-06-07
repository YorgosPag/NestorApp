'use client';

/**
 * SSoT guard against Firebase ca9 Watch-stream resets.
 *
 * Firebase SDK ca9 (`__PRIVATE_TargetState` assertion) resets the Firestore
 * Watch stream and delivers a stale pre-undo snapshot at the exact moment
 * `dirty` is cleared after persist — causing entities to flash at their
 * moved (pre-undo) position.
 *
 * Usage in every BIM persistence hook:
 *
 *   const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
 *
 *   // In persist() — call BEFORE dirtyIdsRef.delete():
 *   recordWrite(entity.id);
 *   dirtyIdsRef.current.delete(entity.id);
 *
 *   // In subscribeXxx callback — after dirty check, before diff:
 *   if (dirty.has(doc.id)) { use existing; continue; }
 *   if (isWithinGrace(doc.id)) { use existing; continue; }
 *   // ... normal diff-merge
 *
 * @see useWallPersistence   — first adopter
 * @see useColumnPersistence — second adopter
 */

import { useRef, useCallback } from 'react';

/** ms to suppress incoming Firestore snapshots after a local write. */
export const WRITE_GRACE_MS = 2000;

export interface BimFirestoreWriteGrace {
  /** Call immediately before `dirtyIdsRef.delete(entityId)` in persist(). */
  readonly recordWrite: (entityId: string) => void;
  /** Returns true if this entity is still within the post-write grace window. */
  readonly isWithinGrace: (entityId: string) => boolean;
}

/**
 * Returns a stable `{ recordWrite, isWithinGrace }` pair backed by a ref
 * (no re-renders on write, safe to read inside Firestore snapshot callbacks).
 */
export function useBimFirestoreWriteGrace(): BimFirestoreWriteGrace {
  const recentWriteRef = useRef<Map<string, number>>(new Map());

  const recordWrite = useCallback((entityId: string): void => {
    recentWriteRef.current.set(entityId, Date.now());
  }, []);

  const isWithinGrace = useCallback((entityId: string): boolean => {
    const lastWrite = recentWriteRef.current.get(entityId) ?? 0;
    return Date.now() - lastWrite < WRITE_GRACE_MS;
  }, []);

  return { recordWrite, isWithinGrace };
}
