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

/**
 * ADR-661 — batch send-to-back / bring-to-front for a SET of ids in ONE atomic reorder.
 *
 * Moves every entity whose id is in `ids` to the back (array front, index 0 = drawn first) or the
 * front (array end = drawn last), as a CONTIGUOUS block, preserving BOTH the moved entities' original
 * relative order AND the order of everyone else. Looping the single-id `moveEntityInList` per id would
 * scramble the moved set's internal order (each 'back' re-inserts at 0, reversing the group) — this
 * splits once and re-concatenates, so the group's z-order is stable. Returns a NEW array, or `null`
 * when NONE of the ids are present (caller no-ops).
 *
 * Shared by (A) topo contour auto-send-to-back at generation and (B) the multi-select reorder command.
 */
export function moveEntitiesInList<T extends { id: string }>(
  entities: readonly T[],
  ids: ReadonlySet<string>,
  direction: 'front' | 'back',
): T[] | null {
  if (ids.size === 0) return null;
  const moved: T[] = [];
  const rest: T[] = [];
  for (const entity of entities) {
    if (ids.has(entity.id)) moved.push(entity);
    else rest.push(entity);
  }
  if (moved.length === 0) return null;
  return direction === 'back' ? [...moved, ...rest] : [...rest, ...moved];
}

/** ADR-661 — the render order as an id list (undo snapshot for BatchReorderEntityCommand). */
export function entityIdOrder<T extends { id: string }>(entities: readonly T[]): string[] {
  return entities.map((e) => e.id);
}

/**
 * ADR-661 — rebuild the list to match an exact id order (BatchReorderEntityCommand.undo snapshot).
 * Returns a NEW array, or `null` when `orderedIds` is not a full-coverage permutation of `entities`
 * (a stale snapshot) — the caller then no-ops rather than silently dropping entities.
 */
export function reorderEntitiesToIdList<T extends { id: string }>(
  entities: readonly T[],
  orderedIds: readonly string[],
): T[] | null {
  const byId = new Map(entities.map((e) => [e.id, e] as const));
  const next: T[] = [];
  for (const id of orderedIds) {
    const e = byId.get(id);
    if (e) next.push(e);
  }
  return next.length === entities.length ? next : null;
}
