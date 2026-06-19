/**
 * DELETE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for deleting entities
 * Stores entity snapshot for undo (restore) operations.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';
import type { AnySceneEntity } from '../../../types/scene';
// ADR-401 Phase C — deleting a structural host (beam/slab) leaves any `attached`
// wall without its top support. The wall auto-falls-back to baseline geometry
// (resolveWallTopProfile); this surfaces a non-blocking warning.
import { notifyWallsOnHostDeletion } from '../../../bim/walls/wall-structural-attach-coordinator';
// ADR-401 — deleting a structural host (beam/slab) must DETACH the columns that
// referenced it: otherwise their `attachTopToIds` dangle to a ghost host, which
// blocks re-attach when a new beam is later created (column stuck «attached to a
// ghost»). Mirror of the wall warning path, but an actual undoable detach.
import { findAttachedColumns } from '../../../bim/cascade/bim-cascade-resolver';
import { DetachColumnsCommand, type ColumnDetachTarget } from './DetachColumnsCommand';
import type { Entity } from '../../../types/entities';
import type { ColumnKind } from '../../../bim/types/column-types';

// ADR-390 — BIM entity types eligible για symmetric undo→Firestore restore.
const BIM_ENTITY_TYPES = new Set<string>([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair',
  // ADR-406 — point-based MEP fixture.
  'mep-fixture',
  // ADR-408 Φ3 — point-based electrical panel.
  'electrical-panel',
  // ADR-407 — standalone path-based railing.
  'railing',
  // ADR-408 Φ8 — unified linear MEP segment (duct + pipe).
  'mep-segment',
  // ADR-408 Φ12 — plumbing manifold (floor-mounted distributor).
  'mep-manifold',
  // ADR-408 Εύρος Β — heating radiator (wall-mounted terminal).
  'mep-radiator',
  // ADR-408 Εύρος Β #2 — heating boiler (wall-mounted heat source).
  'mep-boiler',
  // ADR-408 — DHW water heater (θερμοσίφωνας / αντλία θερμότητας ΖΝΧ).
  'mep-water-heater',
  // ADR-408 Εύρος Β #3 — area-based radiant floor heating loop.
  'mep-underfloor',
  // ADR-417 — parametric pitched roof.
  'roof',
  // ADR-419 — floor-finish covering polygon.
  'floor-finish',
  // ADR-422 — thermal space (IfcSpace).
  'thermal-space',
  // ADR-437 — space separator (IfcVirtualElement).
  'space-separator',
]);

type BimEntityType =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair'
  | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-segment' | 'mep-manifold' | 'mep-radiator'
  | 'mep-boiler' | 'mep-water-heater' | 'mep-underfloor' | 'roof' | 'floor-finish' | 'thermal-space' | 'space-separator';

function emitBimRestoreIfApplicable(snapshot: SceneEntity): void {
  const type = (snapshot as { type?: string }).type;
  if (!type || !BIM_ENTITY_TYPES.has(type)) return;
  // SceneEntity (loose interface) → AnySceneEntity (BIM-union) cast μέσω
  // unknown — bypass δικαιολογημένο γιατί έχουμε ήδη τσεκάρει type discriminator.
  EventBus.emit('bim:entity-restore-requested', {
    entityType: type as BimEntityType,
    entitySnapshot: snapshot as unknown as AnySceneEntity,
    source: 'undo-delete',
  });
}

/**
 * ADR-401 — after removing structural host(s), detach the columns that referenced
 * them so their binding resets to default (cleared `attachTopToIds`/`attachBaseToIds`).
 * Reuses the tested `DetachColumnsCommand` (snapshot + geometry recompute + persist
 * + undo) once per affected side. Returns the executed commands so the owning delete
 * command undoes/redoes them atomically (ONE undo entry, Revit-style). No-op when the
 * scene manager has no `getEntities` or no column is affected.
 *
 * NOTE: a column attached to MULTIPLE hosts (stepped top) is fully detached on the
 * affected side even if only one host is deleted — acceptable: it then re-auto-attaches
 * to the surviving/new beams via the coordinator's stale-eligibility path.
 */
function detachColumnsOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: ISceneManager,
): ICommand[] {
  if (deletedHostIds.length === 0) return [];
  const all = (sceneManager as { getEntities?(): readonly SceneEntity[] }).getEntities?.();
  if (!all) return [];
  const { topIds, baseIds } = findAttachedColumns(new Set(deletedHostIds), all as unknown as readonly Entity[]);
  if (topIds.length === 0 && baseIds.length === 0) return [];
  const byId = new Map(all.map((e) => [e.id, e]));
  const toTargets = (ids: string[]): ColumnDetachTarget[] =>
    ids.map((id) => ({
      columnId: id,
      kind: ((byId.get(id) as { kind?: ColumnKind } | undefined)?.kind ?? 'rectangular') as ColumnKind,
    }));
  const cmds: ICommand[] = [];
  if (topIds.length > 0) cmds.push(new DetachColumnsCommand('top', toTargets(topIds), sceneManager));
  if (baseIds.length > 0) cmds.push(new DetachColumnsCommand('base', toTargets(baseIds), sceneManager));
  for (const c of cmds) c.execute();
  return cmds;
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
      // ADR-401 — detach columns that referenced this host (clears ghost attach).
      this.hostDeletionDetaches = detachColumnsOnHostDeletion([this.entityId], this.sceneManager);
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
      // ADR-401 — detach columns that referenced any deleted host (clears ghost attach).
      this.hostDeletionDetaches = detachColumnsOnHostDeletion(this.entityIds, this.sceneManager);
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
