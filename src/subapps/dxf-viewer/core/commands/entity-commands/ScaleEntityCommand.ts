/**
 * SCALE ENTITY COMMAND — ADR-348
 *
 * Undoable command for scaling DXF entities around a base point.
 * Supports uniform scale (sx=sy), non-uniform scale (sx≠sy),
 * and copy mode (original entities preserved, scaled copies created).
 *
 * CIRCLE → ELLIPSE conversion is handled automatically via
 * scale-entity-transform.ts (SSOT). Undo restores original entity type.
 *
 * @see ADR-348 §Architecture — Command Registration
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import type { Entity } from '../../../types/entities';

export type ScaleParams =
  | { mode: 'uniform'; factor: number }
  | { mode: 'non-uniform'; sx: number; sy: number };

export class ScaleEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'ScaleEntities';
  readonly type = 'scale-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private createdEntityIds: string[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly basePoint: Point2D,
    private readonly params: ScaleParams,
    private readonly copyMode: boolean,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  private getSxSy(): { sx: number; sy: number } {
    if (this.params.mode === 'uniform') {
      return { sx: this.params.factor, sy: this.params.factor };
    }
    return { sx: this.params.sx, sy: this.params.sy };
  }

  execute(): void {
    this.entitySnapshots.clear();
    this.createdEntityIds = [];

    const { sx, sy } = this.getSxSy();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;

      const updates = scaleEntity(entity as unknown as Entity, this.basePoint, sx, sy);

      if (this.copyMode) {
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      } else {
        this.entitySnapshots.set(entityId, deepClone(entity));
        this.sceneManager.updateEntity(entityId, updates);
      }
    }

    this.wasExecuted = this.copyMode
      ? this.createdEntityIds.length > 0
      : this.entitySnapshots.size > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;

    if (this.copyMode) {
      for (const id of this.createdEntityIds) {
        this.sceneManager.removeEntity(id);
      }
    } else {
      for (const [entityId, snapshot] of this.entitySnapshots) {
        const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot;
        this.sceneManager.updateEntity(entityId, geometry);
      }
    }
  }

  redo(): void {
    const { sx, sy } = this.getSxSy();

    if (this.copyMode) {
      this.createdEntityIds = [];
      for (const entityId of this.entityIds) {
        const entity = this.sceneManager.getEntity(entityId);
        if (!entity) continue;
        const updates = scaleEntity(entity as unknown as Entity, this.basePoint, sx, sy);
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      }
    } else {
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (!snapshot) continue;
        const updates = scaleEntity(snapshot as unknown as Entity, this.basePoint, sx, sy);
        this.sceneManager.updateEntity(entityId, updates);
      }
    }
  }

  getDescription(): string {
    const count = this.copyMode ? this.createdEntityIds.length : this.entitySnapshots.size || this.entityIds.length;
    const mode = this.copyMode ? 'copy' : 'in-place';
    if (this.params.mode === 'uniform') {
      return `Scale ${count} ${count === 1 ? 'entity' : 'entities'} ×${this.params.factor.toFixed(3)} (${mode})`;
    }
    return `Scale ${count} ${count === 1 ? 'entity' : 'entities'} sx=${this.params.sx.toFixed(3)} sy=${this.params.sy.toFixed(3)} (${mode})`;
  }

  getAffectedEntityIds(): string[] {
    return this.copyMode ? [...this.createdEntityIds] : [...this.entityIds];
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) return 'At least one entity ID is required';
    if (this.params.mode === 'uniform' && this.params.factor === 0) return 'Scale factor cannot be zero';
    if (this.params.mode === 'non-uniform' && (this.params.sx === 0 || this.params.sy === 0)) {
      return 'Scale factors cannot be zero';
    }
    return null;
  }

  serialize(): SerializedCommand {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => { snapshotsArray.push({ id, entity }); });

    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        basePoint: this.basePoint,
        params: this.params,
        copyMode: this.copyMode,
        entitySnapshots: snapshotsArray,
        createdEntityIds: this.createdEntityIds,
      },
      version: 1,
    };
  }
}
