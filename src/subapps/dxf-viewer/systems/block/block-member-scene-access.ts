/**
 * ADR-641 Φ4 — BLOCK-member-aware scene access (SSoT, pure).
 *
 * While a Block Editor session is open (BEDIT), the canvas renders the active block's members in
 * BLOCK-LOCAL space (base @ origin, {@link buildBlockEditScene}). The hit-test / grips therefore
 * return a MEMBER's own id — but that member does NOT live at the top of the world SceneModel: it
 * lives inside the active {@link BlockEntity}'s `.entities` array (in block-local coordinates). This
 * module is the ONE place that resolves + immutably writes back «an id that may be a top-level
 * entity OR a member of the active block», so every command surface (the grip scene-manager adapter
 * and the generic `LevelSceneManagerAdapter`) edits an entered member without re-implementing the
 * descent. Edits land on the LIVE `block.entities`, so the next `buildBlockEditScene` build shows them.
 *
 * Structural sibling of {@link findEntityOrGroupMember} (`systems/group/group-member-scene-access.ts`),
 * but two deliberate differences (ADR-641 §2):
 *   1. **Gated on `activeBlockId`**, NOT always-on. GROUP members live in WORLD coordinates so editing
 *      one by id is coordinate-safe anytime; BLOCK members live in BLOCK-LOCAL coordinates and are only
 *      individually addressable while their block is entered — editing them otherwise would corrupt the
 *      frame (ADR-641 §7). Passing `activeBlockId === null` yields plain depth-0 behaviour (identical to
 *      the non-BEDIT path), so a caller can route through this SSoT unconditionally.
 *   2. **Single-level descent**, NOT recursive. Blocks do not nest — DXF import flattens nested INSERTs
 *      to primitives (ADR-640) — so `block.entities` never holds another `BlockEntity`.
 *
 * Pure — no React, no store reads. The `activeBlockId` is supplied by the caller (the adapter reads it
 * from {@link getActiveBlockEditId} at event time), keeping this module unit-testable.
 */

import type { Entity, BlockEntity } from '../../types/entities';
import { isBlockEntity } from '../../types/entities';

/** True when `entity` is the active block container we may descend into. */
function isActiveBlock(entity: Entity, activeBlockId: string | null | undefined): entity is BlockEntity {
  return !!activeBlockId && entity.id === activeBlockId && isBlockEntity(entity);
}

/**
 * Immutable map over `entities` (and one level into the active block's members) applying `resolve`:
 * it returns a REPLACEMENT entity for a matched id, or `undefined` to leave the entity as-is. A
 * changed member yields a new `.entities` array + new `BlockEntity` ref; when nothing matched the
 * ORIGINAL top-level array reference is returned (cheap no-op). The shared engine behind
 * {@link updateEntityOrBlockMember} (single-id) and {@link updateEntitiesOrBlockMembers} (batch).
 */
function mapWithActiveBlock(
  entities: readonly Entity[],
  activeBlockId: string | null | undefined,
  resolve: (entity: Entity) => Entity | undefined,
): Entity[] {
  let changed = false;
  const next = entities.map((entity) => {
    const replacement = resolve(entity);
    if (replacement !== undefined) {
      changed = true;
      return replacement;
    }
    if (isActiveBlock(entity, activeBlockId)) {
      let memberChanged = false;
      const nextMembers = entity.entities.map((m) => {
        const r = resolve(m);
        if (r !== undefined) {
          memberChanged = true;
          return r;
        }
        return m;
      });
      if (memberChanged) {
        changed = true;
        return { ...entity, entities: nextMembers };
      }
    }
    return entity;
  });
  return changed ? next : (entities as Entity[]);
}

/**
 * Resolve an id to its {@link Entity}: a TOP-LEVEL entity, or — while inside its Block Editor — a
 * MEMBER of the active block (`activeBlockId`). Returns `null` when the id is absent. With
 * `activeBlockId === null` this is a plain top-level lookup.
 */
export function findEntityOrBlockMember(
  entities: readonly Entity[] | undefined,
  targetId: string | null | undefined,
  activeBlockId: string | null | undefined,
): Entity | null {
  if (!entities || entities.length === 0 || !targetId) return null;
  for (const entity of entities) {
    if (entity.id === targetId) return entity;
    if (isActiveBlock(entity, activeBlockId)) {
      const member = entity.entities.find((m) => m.id === targetId);
      if (member) return member;
    }
  }
  return null;
}

/**
 * Immutably apply `updater` to the entity with id `targetId` — top-level OR a member of the active
 * block — writing the result back into its owning array. A changed member yields a NEW `.entities`
 * array + a NEW `BlockEntity` ref (so scene subscription + persist serializer see the change);
 * otherwise the ORIGINAL top-level array reference is returned (cheap no-op, downstream identity
 * guards hold). Matching the block CONTAINER's own id updates the container (no descent) — whole-block
 * ops keep working through this same primitive.
 */
export function updateEntityOrBlockMember(
  entities: readonly Entity[],
  targetId: string,
  activeBlockId: string | null | undefined,
  updater: (entity: Entity) => Entity,
): Entity[] {
  return mapWithActiveBlock(entities, activeBlockId, (e) => (e.id === targetId ? updater(e) : undefined));
}

/**
 * Batch member-aware map: for EACH entity (top-level OR a member of the active block) whose id has a
 * patch in `patches`, apply it. Same immutable-writeback + unchanged-ref-preservation contract as
 * {@link updateEntityOrBlockMember}. Used by the grip adapter's multi-grip `updateEntities` so a
 * several-vertex move inside an entered block commits in one pass.
 */
export function updateEntitiesOrBlockMembers(
  entities: readonly Entity[],
  patches: ReadonlyMap<string, (entity: Entity) => Entity>,
  activeBlockId: string | null | undefined,
): Entity[] {
  if (patches.size === 0) return entities as Entity[];
  return mapWithActiveBlock(entities, activeBlockId, (e) => {
    const patch = patches.get(e.id);
    return patch ? patch(e) : undefined;
  });
}

/**
 * Append `member` to the active block's `.entities` (a new-line/copy inside BEDIT), returning a NEW
 * `BlockEntity` ref. With `activeBlockId === null`, or when the block is not found (deleted mid-edit),
 * falls back to a top-level append so the entity is never lost.
 */
export function addBlockMember(
  entities: readonly Entity[],
  activeBlockId: string | null | undefined,
  member: Entity,
): Entity[] {
  if (!activeBlockId) return [...entities, member];
  let added = false;
  const next = entities.map((entity) => {
    if (isActiveBlock(entity, activeBlockId)) {
      added = true;
      return { ...entity, entities: [...entity.entities, member] };
    }
    return entity;
  });
  return added ? next : [...entities, member];
}

/**
 * Remove the entity with id `targetId` — top-level OR a member of the active block (a delete inside
 * BEDIT), returning a NEW `BlockEntity` ref for the member case. Returns the ORIGINAL top-level array
 * reference when nothing matched (no-op).
 */
export function removeEntityOrBlockMember(
  entities: readonly Entity[],
  targetId: string,
  activeBlockId: string | null | undefined,
): Entity[] {
  let changed = false;
  const next: Entity[] = [];
  for (const entity of entities) {
    if (entity.id === targetId) {
      changed = true;
      continue;
    }
    if (isActiveBlock(entity, activeBlockId)) {
      const filtered = entity.entities.filter((m) => m.id !== targetId);
      if (filtered.length !== entity.entities.length) {
        changed = true;
        next.push({ ...entity, entities: filtered });
        continue;
      }
    }
    next.push(entity);
  }
  return changed ? next : (entities as Entity[]);
}
