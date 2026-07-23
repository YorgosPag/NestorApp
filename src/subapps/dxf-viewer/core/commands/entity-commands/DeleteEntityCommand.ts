/**
 * DELETE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for deleting entities
 * Stores entity snapshot for undo (restore) operations.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { emitBimEntityRestoreRequested } from '../../../systems/events/bim-entity-lifecycle-events';
import type { AnySceneEntity } from '../../../types/scene';
// ADR-401 Phase C — deleting a structural host (beam/slab) leaves any `attached`
// wall without its top support. The wall auto-falls-back to baseline geometry
// (resolveWallTopProfile); this surfaces a non-blocking warning.
import { notifyWallsOnHostDeletion } from '../../../bim/walls/wall-structural-attach-coordinator';
// ADR-401 — deleting a structural host (beam/slab) must DETACH the wall + column
// entities that referenced it: otherwise their `attachTop/BaseToIds` dangle to a
// ghost host, which blocks re-attach when a new host is later created (entity stuck
// «attached to a ghost»). Mirror of the wall warning path, but an actual undoable
// detach — driven by the ONE entity-agnostic reverse lookup (SSoT).
import { findEntitiesAttachedToHosts } from '../../../bim/cascade/bim-cascade-resolver';
import { isColumnEntity, isWallEntity } from '../../../types/entities';
import { DetachColumnsCommand, type ColumnDetachTarget } from './DetachColumnsCommand';
import { DetachWallsCommand, type WallDetachTarget } from './DetachWallsCommand';
import type { EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import type { Entity } from '../../../types/entities';
import type { ColumnKind } from '../../../bim/types/column-types';
import type { WallKind } from '../../../bim/types/wall-types';

// ADR-390 — entity types whose restore-on-undo is emitted by the GENERIC
// DeleteEntityCommand. ΥΠΟΣΥΝΟΛΟ του canonical `BimRestoreEntityType` — ΕΞΑΙΡΟΥΝΤΑΙ
// όσα έχουν dedicated delete command (foundation/furniture/floorplan-symbol/wall-covering),
// που εκπέμπουν restore μόνα τους. ΕΝΑ `as const` tuple → Set + union (μηδέν drift
// μεταξύ runtime+type)· η subset σχέση με το canonical επιβάλλεται από τον compiler
// στο call site (`emitBimEntityRestoreRequested(type as BimEntityType, …)`).
const BIM_RESTORE_VIA_DELETE_COMMAND = [
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair',
  'mep-fixture', 'electrical-panel', 'railing', 'mep-segment', 'mep-manifold', 'mep-radiator',
  'mep-boiler', 'mep-water-heater', 'mep-underfloor', 'roof', 'floor-finish', 'thermal-space',
  'space-separator',
  // ADR-507 — FLAT DXF hatch (symmetric undo→Firestore restore, mirror BIM entities).
  'hatch',
  // ADR-683 Φ3β / ADR-684 — imported mesh + parametric generic solid: no dedicated
  // delete command (routed through this generic one), so their undo-restore MUST be
  // emitted here, symmetric with the forward delete in smart-delete-bim-events.
  'imported-mesh', 'generic-solid',
] as const;

type BimEntityType = typeof BIM_RESTORE_VIA_DELETE_COMMAND[number];
const BIM_ENTITY_TYPES: ReadonlySet<string> = new Set(BIM_RESTORE_VIA_DELETE_COMMAND);

function emitBimRestoreIfApplicable(snapshot: SceneEntity): void {
  const type = (snapshot as { type?: string }).type;
  if (!type || !BIM_ENTITY_TYPES.has(type)) return;
  // SceneEntity (loose interface) → AnySceneEntity (BIM-union) cast μέσω unknown —
  // bypass δικαιολογημένο γιατί έχουμε ήδη τσεκάρει τον type discriminator. Emit μέσω
  // του lifecycle SSoT (ADR-390) — μηδέν inline copy.
  emitBimEntityRestoreRequested(type as BimEntityType, snapshot as unknown as AnySceneEntity, 'undo-delete');
}

/**
 * ADR-401 — generic detach-on-host-delete (wall + column SSoT). After removing
 * structural host(s), find every attachable entity (per `guard`) whose top/base
 * references a deleted host — via the ONE entity-agnostic reverse lookup
 * `findEntitiesAttachedToHosts` — and reset that side with the matching undoable
 * Detach command (`makeCommand`), once per affected side. Returns the executed
 * commands so the owning delete command undoes/redoes them atomically (ONE undo
 * entry, Revit-style: undo re-attaches AFTER the host returns). No-op when the
 * scene manager has no `getEntities` or nothing is affected.
 *
 * NOTE: an entity attached to MULTIPLE hosts (stepped top) is fully detached on the
 * affected side even if only one host is deleted — acceptable: it then re-auto-attaches
 * to the surviving/new hosts via the coordinator's stale-eligibility path.
 */
function detachEntitiesOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: ISceneManager,
  guard: (e: Entity) => boolean,
  makeCommand: (side: EntityAttachSide, ids: string[], byId: Map<string, SceneEntity>) => ICommand,
): ICommand[] {
  if (deletedHostIds.length === 0) return [];
  const all = (sceneManager as { getEntities?(): readonly SceneEntity[] }).getEntities?.();
  if (!all) return [];
  const hostSet = new Set(deletedHostIds);
  const entities = all as unknown as readonly Entity[];
  const topIds = findEntitiesAttachedToHosts(hostSet, entities, 'top', guard);
  const baseIds = findEntitiesAttachedToHosts(hostSet, entities, 'base', guard);
  if (topIds.length === 0 && baseIds.length === 0) return [];
  const byId = new Map(all.map((e) => [e.id, e]));
  const cmds: ICommand[] = [];
  if (topIds.length > 0) cmds.push(makeCommand('top', topIds, byId));
  if (baseIds.length > 0) cmds.push(makeCommand('base', baseIds, byId));
  for (const c of cmds) c.execute();
  return cmds;
}

/** Live-scene `kind` of an entity, falling back to a per-type default. */
function entityKindOr<T extends string>(byId: Map<string, SceneEntity>, id: string, fallback: T): T {
  return (byId.get(id) as { kind?: T } | undefined)?.kind ?? fallback;
}

/** ADR-401 — detach columns referencing a deleted host (reuse `DetachColumnsCommand`). */
function detachColumnsOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: ISceneManager,
): ICommand[] {
  return detachEntitiesOnHostDeletion(deletedHostIds, sceneManager, isColumnEntity, (side, ids, byId) =>
    new DetachColumnsCommand(
      side,
      ids.map((id): ColumnDetachTarget => ({ columnId: id, kind: entityKindOr<ColumnKind>(byId, id, 'rectangular') })),
      sceneManager,
    ),
  );
}

/**
 * ADR-401 — detach WALLS referencing a deleted host (reuse `DetachWallsCommand`).
 * Symmetric with the column path (Giorgio 2026-06-19): the wall warning
 * (`notifyWallsOnHostDeletion`) still fires, but the dangling ref is now actually
 * cleared so a NEW host re-attaches the wall (it was stuck «attached to a ghost»,
 * blocked by the `topBinding==='storey-ceiling'` guard in `findWallsToAutoAttachToHost`).
 */
function detachWallsOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: ISceneManager,
): ICommand[] {
  return detachEntitiesOnHostDeletion(deletedHostIds, sceneManager, isWallEntity, (side, ids, byId) =>
    new DetachWallsCommand(
      side,
      ids.map((id): WallDetachTarget => ({ wallId: id, kind: entityKindOr<WallKind>(byId, id, 'straight') })),
      sceneManager,
    ),
  );
}

/**
 * Command for deleting an entity
 */
export class DeleteEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteEntity';
  readonly type = 'delete-entity';
  readonly timestamp: number;

  private entitySnapshot: SceneEntity | null = null;
  private wasExecuted = false;
  /** ADR-401 — child detach commands for columns that referenced the deleted host. */
  private hostDeletionDetaches: ICommand[] = [];

  constructor(
    private readonly entityId: string,
    private readonly sceneManager: ISceneManager
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store snapshot and remove entity
   */
  execute(): void {
    // Store snapshot before deletion (for undo)
    const entity = this.sceneManager.getEntity(this.entityId);
    if (entity) {
      // Deep clone the entity
      this.entitySnapshot = deepClone(entity);
      this.sceneManager.removeEntity(this.entityId);
      this.wasExecuted = true;
      // ADR-401 Phase C — warn if this entity was a structural host for an
      // attached wall (the wall already fell back to baseline; this is the signal).
      notifyWallsOnHostDeletion([this.entityId], this.sceneManager);
      // ADR-401 — detach walls + columns that referenced this host (clears ghost attach).
      this.hostDeletionDetaches = [
        ...detachColumnsOnHostDeletion([this.entityId], this.sceneManager),
        ...detachWallsOnHostDeletion([this.entityId], this.sceneManager),
      ];
    }
  }

  /**
   * Undo: Restore the entity
   *
   * ADR-390 — also emits `bim:entity-restore-requested` so BIM persistence
   * hooks re-create the Firestore doc + audit row (`action='restored'`).
   * Pre-ADR-390 behavior accidentally re-persisted via auto-save side effect
   * (zombie write με ίδιο UUID + misleading `action='created'`).
   */
  undo(): void {
    if (this.entitySnapshot && this.wasExecuted) {
      this.sceneManager.addEntity(this.entitySnapshot);
      emitBimRestoreIfApplicable(this.entitySnapshot);
      // ADR-401 — re-attach the columns AFTER the host is back in the scene.
      for (const c of this.hostDeletionDetaches) c.undo();
    }
  }

  /**
   * Redo: Remove the entity again
   */
  redo(): void {
    if (this.entitySnapshot) {
      this.sceneManager.removeEntity(this.entitySnapshot.id);
      for (const c of this.hostDeletionDetaches) c.redo();
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    const entityType = this.entitySnapshot?.type ?? 'entity';
    return `Delete ${entityType}`;
  }

  /**
   * Delete commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        entitySnapshot: this.entitySnapshot,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityId) {
      return 'Entity ID is required';
    }
    return null;
  }
}

/**
 * Command for deleting multiple entities at once
 */
export class DeleteMultipleEntitiesCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteMultipleEntities';
  readonly type = 'delete-multiple-entities';
  readonly timestamp: number;

  private entitySnapshots: SceneEntity[] = [];
  private wasExecuted = false;
  /** ADR-401 — child detach commands for columns that referenced any deleted host. */
  private hostDeletionDetaches: ICommand[] = [];

  constructor(
    private readonly entityIds: string[],
    private readonly sceneManager: ISceneManager
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store snapshots and remove all entities
   */
  execute(): void {
    this.entitySnapshots = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        // Deep clone the entity
        this.entitySnapshots.push(deepClone(entity));
        this.sceneManager.removeEntity(entityId);
      }
    }

    this.wasExecuted = this.entitySnapshots.length > 0;

    // ADR-401 Phase C — warn if any deleted entity was a structural host for an
    // attached wall (walls already fell back to baseline; this is the signal).
    if (this.wasExecuted) {
      notifyWallsOnHostDeletion(this.entityIds, this.sceneManager);
      // ADR-401 — detach walls + columns that referenced any deleted host (clears ghost attach).
      this.hostDeletionDetaches = [
        ...detachColumnsOnHostDeletion(this.entityIds, this.sceneManager),
        ...detachWallsOnHostDeletion(this.entityIds, this.sceneManager),
      ];
    }
  }

  /**
   * Undo: Restore all entities
   *
   * ADR-390 — emits `bim:entity-restore-requested` per BIM snapshot so each
   * persistence hook re-creates its Firestore doc + audit row.
   */
  undo(): void {
    if (this.wasExecuted) {
      for (const entity of this.entitySnapshots) {
        this.sceneManager.addEntity(entity);
        emitBimRestoreIfApplicable(entity);
      }
      // ADR-401 — re-attach the columns AFTER the hosts are back in the scene.
      for (const c of this.hostDeletionDetaches) c.undo();
    }
  }

  /**
   * Redo: Remove all entities again
   */
  redo(): void {
    for (const entity of this.entitySnapshots) {
      this.sceneManager.removeEntity(entity.id);
    }
    for (const c of this.hostDeletionDetaches) c.redo();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Delete ${this.entitySnapshots.length} entities`;
  }

  /**
   * Delete commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        entitySnapshots: this.entitySnapshots,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    return null;
  }
}
