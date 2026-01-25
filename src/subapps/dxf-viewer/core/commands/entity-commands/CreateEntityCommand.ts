/**
 * CREATE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for creating new entities
 * Supports undo (remove) and redo (re-add) operations.
 * Full serialization support for session restore.
 */

import type { ICommand, ISceneManager, SceneEntity, CreateEntityOptions, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/**
 * Command for creating a new entity
 */
export class CreateEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateEntity';
  readonly type = 'create-entity';
  readonly timestamp: number;

  private entity: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly entityData: Omit<SceneEntity, 'id'>,
    private readonly sceneManager: ISceneManager,
    private readonly options: CreateEntityOptions = {}
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Create the entity and add to scene
   */
  execute(): void {
    if (!this.entity) {
      // First execution - create entity with new ID
      this.entity = {
        ...this.entityData,
        id: generateEntityId(),
        layer: this.options.layer ?? this.entityData.layer ?? '0',
        visible: true,
      } as SceneEntity;

      // Apply optional styling
      if (this.options.color) {
        this.entity.color = this.options.color;
      }
      if (this.options.lineweight !== undefined) {
        this.entity.lineweight = this.options.lineweight;
      }
      if (this.options.opacity !== undefined) {
        this.entity.opacity = this.options.opacity;
      }
    }

    this.sceneManager.addEntity(this.entity);
    this.wasExecuted = true;
  }

  /**
   * Undo: Remove the entity from scene
   */
  undo(): void {
    if (this.entity && this.wasExecuted) {
      this.sceneManager.removeEntity(this.entity.id);
    }
  }

  /**
   * Redo: Re-add the entity to scene
   */
  redo(): void {
    if (this.entity) {
      this.sceneManager.addEntity(this.entity);
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Create ${this.entityData.type}`;
  }

  /**
   * Get the created entity (after execution)
   */
  getEntity(): SceneEntity | null {
    return this.entity;
  }

  /**
   * Create commands cannot be merged
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
        entityData: this.entityData,
        options: this.options,
        entityId: this.entity?.id,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return this.entity ? [this.entity.id] : [];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityData.type) {
      return 'Entity type is required';
    }
    return null;
  }
}
