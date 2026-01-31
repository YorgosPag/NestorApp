/**
 * DELETE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for deleting entities
 * Stores entity snapshot for undo (restore) operations.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';

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
    }
  }

  /**
   * Undo: Restore the entity
   */
  undo(): void {
    if (this.entitySnapshot && this.wasExecuted) {
      this.sceneManager.addEntity(this.entitySnapshot);
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
  }

  /**
   * Undo: Restore all entities
   */
  undo(): void {
    if (this.wasExecuted) {
      for (const entity of this.entitySnapshots) {
        this.sceneManager.addEntity(entity);
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
