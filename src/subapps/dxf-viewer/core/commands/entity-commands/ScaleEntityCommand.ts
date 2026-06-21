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
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * scale patch and its distinctive copy-mode path.
 *
 * @see ADR-348 §Architecture — Command Registration
 * @see SnapshotTransformCommand — shared in-place base
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import type { Entity } from '../../../types/entities';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

export type ScaleParams =
  | { mode: 'uniform'; factor: number }
  | { mode: 'non-uniform'; sx: number; sy: number };

export class ScaleEntityCommand extends SnapshotTransformCommand {
  readonly name = 'ScaleEntities';
  readonly type = 'scale-entities';

  private createdEntityIds: string[] = [];

  constructor(
    entityIds: string[],
    private readonly basePoint: Point2D,
    private readonly params: ScaleParams,
    private readonly copyMode: boolean,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager);
  }

  private getSxSy(): { sx: number; sy: number } {
    if (this.params.mode === 'uniform') {
      return { sx: this.params.factor, sy: this.params.factor };
    }
    return { sx: this.params.sx, sy: this.params.sy };
  }

  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const { sx, sy } = this.getSxSy();
    return scaleEntity(entity as unknown as Entity, this.basePoint, sx, sy) as Partial<SceneEntity>;
  }

  execute(): void {
    if (!this.copyMode) {
      this.executeInPlace();
      return;
    }
    // Copy mode: scaled clones, originals untouched.
    this.entitySnapshots.clear();
    this.createdEntityIds = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const newId = generateEntityId();
      this.sceneManager.addEntity({ ...entity, ...this.computeUpdates(entity), id: newId } as SceneEntity);
      this.createdEntityIds.push(newId);
    }
    this.wasExecuted = this.createdEntityIds.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    if (this.copyMode) {
      for (const id of this.createdEntityIds) this.sceneManager.removeEntity(id);
      return;
    }
    this.undoInPlace();
  }

  redo(): void {
    if (!this.copyMode) {
      this.redoInPlace();
      return;
    }
    this.createdEntityIds = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const newId = generateEntityId();
      this.sceneManager.addEntity({ ...entity, ...this.computeUpdates(entity), id: newId } as SceneEntity);
      this.createdEntityIds.push(newId);
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
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        ...this.baseTransformData(),
        basePoint: this.basePoint,
        params: this.params,
        copyMode: this.copyMode,
        createdEntityIds: this.createdEntityIds,
      },
      version: 1,
    };
  }
}
