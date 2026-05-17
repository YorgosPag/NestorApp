/**
 * CREATE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for creating new entities
 * Supports undo (remove) and redo (re-add) operations.
 * Full serialization support for session restore.
 */

import type { ICommand, ISceneManager, SceneEntity, CreateEntityOptions, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { getLayerByName, getCurrentLayerId } from '../../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';

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
      // ADR-358 Phase 9F — id-only resolution. 4-level fallback ensures layerId is always set.
      const entityDataLayerId = (this.entityData as { layerId?: string }).layerId;
      const resolvedLayerId =
        this.options.layerId ??
        entityDataLayerId ??
        getLayerByName(DXF_DEFAULT_LAYER)?.id ??
        getCurrentLayerId() ??
        '';
      this.entity = {
        ...this.entityData,
        id: this.options.existingId ?? generateEntityId(),
        layerId: resolvedLayerId,
        visible: true,
      } as SceneEntity;

      // Apply optional styling — concrete color is skipped when the caller
      // declared ByLayer/ByBlock so the renderer can cascade through layersById
      // (ADR-358 §G7 Phase 6.5).
      const inheritsColor = this.options.colorMode === 'ByLayer' || this.options.colorMode === 'ByBlock';
      if (this.options.color && !inheritsColor) {
        this.entity.color = this.options.color;
      }
      if (this.options.lineweight !== undefined) {
        this.entity.lineweight = this.options.lineweight;
      }
      if (this.options.opacity !== undefined) {
        this.entity.opacity = this.options.opacity;
      }

      // ─── ADR-358 §G7 Phase 6.5 — sentinel forward ──────────────────────
      if (this.options.colorMode !== undefined) {
        this.entity.colorMode = this.options.colorMode;
      }
      if (this.options.colorAci !== undefined) {
        this.entity.colorAci = this.options.colorAci;
      }
      if (this.options.colorTrueColor !== undefined) {
        this.entity.colorTrueColor = this.options.colorTrueColor;
      }
      if (this.options.linetypeName !== undefined) {
        this.entity.linetypeName = this.options.linetypeName;
      }
      if (this.options.lineweightMm !== undefined) {
        this.entity.lineweightMm = this.options.lineweightMm;
      }
      if (this.options.transparency !== undefined) {
        this.entity.transparency = this.options.transparency;
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
