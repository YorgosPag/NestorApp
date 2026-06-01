/**
 * ADR-363 §7.2 — persistence SSoT for *cloned* BIM entities (copy+mirror, and
 * any command path that spawns a fresh BIM entity from an existing one).
 *
 * A cloned BIM entity must:
 *   (a) carry a FRESH per-type enterprise ID (N.6) + a NEW IFC GlobalId — each
 *       instance owns a unique `ifcGuid`, never shares the source's; and
 *   (b) broadcast the same create / delete / restore EventBus signals the draw
 *       tool + DeleteEntityCommand use.
 *
 * Without (b) the Firestore subscription (`use*Persistence`) treats the clone as
 * an unknown scene entity (`!docsById.has(id) && !dirty && !pending` → `mutated`)
 * and drops it on the next snapshot — the "copy flashes then vanishes" bug
 * (HANDOFFS/2026-06-01_BIM_copy-mirror-persistence-bug). The in-place mirror
 * (`keepOriginals=false`) was never affected because it mutates an already
 * persisted entity that `useBimEntityMovedPersistEffect` re-saves.
 *
 * Symmetric inverse of `DeleteEntityCommand` (create ↔ delete, redo ↔ restore):
 *   - execute (make copy)  → `broadcastBimCloneCreated`  → first Firestore save
 *   - undo    (drop copy)  → `broadcastBimCloneDeleted`  → Firestore delete + tombstone
 *   - redo    (re-create)  → `broadcastBimCloneRestored` → clear tombstone + re-save
 *
 * @see core/commands/entity-commands/DeleteEntityCommand.ts — symmetric inverse
 * @see hooks/data/useBimEntityRestoredPersistEffect.ts — restore listener
 * @see bim/scene/append-entity-to-scene.ts — draw-tool create path (tool = type)
 */
import { EventBus } from '../../systems/events/EventBus';
import type { AnySceneEntity } from '../../types/entities';
import {
  generateWallId,
  generateOpeningId,
  generateSlabId,
  generateSlabOpeningId,
  generateColumnId,
  generateBeamId,
  generateStairId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';

/** BIM entity types that persist to Firestore via a `use*Persistence` hook. */
export type BimPersistedType =
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'
  | 'column'
  | 'beam'
  | 'stair';

/** Per-type enterprise-id generator (N.6 — never `generateEntityId()` for BIM). */
const BIM_ID_GENERATORS: Record<BimPersistedType, () => string> = {
  wall: generateWallId,
  opening: generateOpeningId,
  slab: generateSlabId,
  'slab-opening': generateSlabOpeningId,
  column: generateColumnId,
  beam: generateBeamId,
  stair: generateStairId,
};

/** Minimal shape a clone helper needs — satisfied by SceneEntity / AnySceneEntity. */
interface CloneEntityLike {
  readonly id: string;
  readonly type?: string;
}

export function isBimPersistedType(type: string | undefined): type is BimPersistedType {
  return type !== undefined && Object.prototype.hasOwnProperty.call(BIM_ID_GENERATORS, type);
}

/**
 * Fresh identity for a BIM clone: per-type enterprise ID + a NEW IFC GlobalId.
 * Returns `null` for non-BIM entities so the caller falls back to its generic
 * id path (`generateEntityId()`).
 */
export function mintBimCloneIdentity(
  type: string | undefined,
): { id: string; ifcGuid: string } | null {
  if (!isBimPersistedType(type)) return null;
  return { id: BIM_ID_GENERATORS[type](), ifcGuid: generateIfcGuid() };
}

/**
 * Emit `drawing:entity-created` (tool = entity type) so the matching
 * `use*Persistence` hook schedules the clone's first Firestore save. No-op for
 * non-BIM entities (they persist via the DXF-JSON autosave path instead).
 */
export function broadcastBimCloneCreated(entity: CloneEntityLike): void {
  if (!isBimPersistedType(entity.type)) return;
  EventBus.emit('drawing:entity-created', {
    entity: entity as unknown as AnySceneEntity,
    tool: entity.type,
  });
}

/**
 * Emit the per-type `bim:*-delete-requested` so the clone's Firestore doc is
 * removed (+ tombstoned) when its creating command is undone. No-op for non-BIM.
 */
export function broadcastBimCloneDeleted(entity: CloneEntityLike): void {
  switch (entity.type) {
    case 'wall':
      EventBus.emit('bim:wall-delete-requested', { wallId: entity.id });
      break;
    case 'opening':
      EventBus.emit('bim:opening-delete-requested', { openingId: entity.id });
      break;
    case 'slab':
      EventBus.emit('bim:slab-delete-requested', { slabId: entity.id });
      break;
    case 'slab-opening':
      EventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId: entity.id });
      break;
    case 'column':
      EventBus.emit('bim:column-delete-requested', { columnId: entity.id });
      break;
    case 'beam':
      EventBus.emit('bim:beam-delete-requested', { beamId: entity.id });
      break;
    case 'stair':
      EventBus.emit('bim:stair-delete-requested', { stairId: entity.id });
      break;
    default:
      break;
  }
}

/**
 * Emit `bim:entity-restore-requested` (`source: 'redo-restore'`) so the clone's
 * Firestore doc is re-created when its creating command is redone — clears the
 * delete tombstone set on undo. No-op for non-BIM entities.
 */
export function broadcastBimCloneRestored(entity: CloneEntityLike): void {
  if (!isBimPersistedType(entity.type)) return;
  EventBus.emit('bim:entity-restore-requested', {
    entityType: entity.type,
    entitySnapshot: entity as unknown as AnySceneEntity,
    source: 'redo-restore',
  });
}
