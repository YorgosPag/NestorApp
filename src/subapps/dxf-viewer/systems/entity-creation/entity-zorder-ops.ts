/**
 * ENTITY Z-ORDER OPS — pure render-list reordering (SSoT).
 *
 * Both `ISceneManager` adapters (`LevelSceneManagerAdapter` and the grip
 * `grip-scene-manager-adapter`) reorder the scene's render list identically: find the entity, splice
 * it out, re-insert it at front / back / an exact index, keep the rest in order. That logic was
 * copy-pasted as `reorderEntity` + `moveEntityToIndex` in EACH adapter (ADR-584 / CHECK 3.28 flagged
 * the intra-file twins). Centralised here so `ReorderEntityCommand` (z-order, ADR-507 sendToBack)
 * behaves the same wherever it is committed.
 *
 * Pure — takes a list, returns a NEW list (or `null` when the id is absent → caller no-ops).
 */

/** Target index for a front/back reorder given the CURRENT list length (front = end, back = start). */
export function frontBackTargetIndex(direction: 'front' | 'back', length: number): number {
  return direction === 'front' ? length : 0;
}

/**
 * Move the entity with `entityId` to `targetIndex` (clamped to the post-removal bounds), preserving
 * the order of every other entity. Returns a NEW array, or `null` when the id is not present.
 */
export function moveEntityInList<T extends { id: string }>(
  entities: readonly T[],
  entityId: string,
  targetIndex: number,
): T[] | null {
  const idx = entities.findIndex((e) => e.id === entityId);
  if (idx === -1) return null;
  const next = entities.slice();
  const [entity] = next.splice(idx, 1);
  const clamped = Math.min(Math.max(0, targetIndex), next.length);
  next.splice(clamped, 0, entity);
  return next;
}
