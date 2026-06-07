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
  // ADR-408 Εύρος Β #3 — area-based radiant floor heating loop.
  'mep-underfloor',
  // ADR-417 — parametric pitched roof.
  'roof',
  // ADR-419 — floor-finish covering polygon.
  'floor-finish',
  // ADR-422 — thermal space (IfcSpace).
  'thermal-space',
]);

type BimEntityType =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair'
  | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-segment' | 'mep-manifold' | 'mep-radiator'
  | 'mep-boiler' | 'mep-underfloor' | 'roof' | 'floor-finish' | 'thermal-space';

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
 * Command for deleting an entity
 */
export class DeleteEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteEntity';
  readonly type = 'delete-entity';
  readonly timestamp: number;

  private entitySnapshot: SceneEntity | null = null;
  private wasExecuted = false;

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
    }
  }

  /**
   * Redo: Remove the entity again
   */
  redo(): void {
    if (this.entitySnapshot) {
      this.sceneManager.removeEntity(this.entitySnapshot.id);
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
    }
  }

  /**
   * Redo: Remove all entities again
   */
  redo(): void {
    for (const entity of this.entitySnapshots) {
      this.sceneManager.removeEntity(entity.id);
    }
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
