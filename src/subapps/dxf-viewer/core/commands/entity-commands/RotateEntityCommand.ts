/**
 * ROTATE ENTITY COMMAND
 *
 * 🏢 ADR-188: Entity Rotation System — Command Pattern
 * Supports undo/redo and command merging for smooth drag rotation.
 *
 * Consecutive rotations within the merge window are merged into a single command
 * for smooth undo of drag-to-rotate operations (Autodesk/Figma pattern).
 *
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * rotation patch, its angle-accumulating merge, and its copy-mode path.
 *
 * @see ADR-188 §6.2 (Entity-specific rotation logic)
 * @see SnapshotTransformCommand — shared in-place base
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { rotateEntity } from '../../../utils/rotation-math';
import type { Entity } from '../../../types/entities';
// ADR-363 Phase 7.2 — BIM-aware rotate (pivot rotation per kind + atomic
// geometry recompute). Returns null for non-BIM, falls through to the
// generic rotateEntity() path below.
import { calculateBimRotatedGeometry } from '../../../bim/transforms/bim-rotate-geometry';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

/**
 * Command for rotating multiple entities around a pivot point.
 * All entities rotate by the same angle (batch operation).
 */
export class RotateEntityCommand extends SnapshotTransformCommand {
  readonly name = 'RotateEntities';
  readonly type = 'rotate-entities';

  /** ADR-357 Phase 12 — IDs of clones created when `copyMode === true`. */
  private createdEntityIds: string[] = [];

  constructor(
    entityIds: string[],
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
    /**
     * ADR-357 Phase 12 — when `true`, rotate clones of the sources rather than
     * mutating in place (mirrors `ScaleEntityCommand.copyMode`).
     */
    private readonly copyMode: boolean = false,
  ) {
    super(entityIds, sceneManager, isDragging);
  }

  /**
   * Computes the rotation patch for a single entity. ADR-363 Phase 7.2:
   * tries BIM-aware rotate first (returns `{params, geometry}` atomic patch
   * for the 7 BIM kinds); falls through to the generic `rotateEntity()` path.
   */
  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const bimPatch = calculateBimRotatedGeometry(entity as unknown as Entity, this.pivot, this.angleDeg);
    if (bimPatch !== null) return bimPatch as Partial<SceneEntity>;
    return rotateEntity(entity as unknown as Entity, this.pivot, this.angleDeg) as Partial<SceneEntity>;
  }

  execute(): void {
    if (!this.copyMode) {
      this.executeInPlace();
      return;
    }
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
    // Copy mode: re-create clones from snapshots so ids are deterministic across
    // the undo/redo cycle (and cache the snapshot the first time through).
    this.createdEntityIds = [];
    for (const entityId of this.entityIds) {
      const snapshot = this.entitySnapshots.get(entityId)
        ?? (this.sceneManager.getEntity(entityId) as SceneEntity | undefined);
      if (!snapshot) continue;
      if (!this.entitySnapshots.has(entityId)) {
        this.entitySnapshots.set(entityId, deepClone(snapshot));
      }
      const newId = generateEntityId();
      this.sceneManager.addEntity({ ...snapshot, ...this.computeUpdates(snapshot), id: newId } as SceneEntity);
      this.createdEntityIds.push(newId);
    }
  }

  getDescription(): string {
    const count = this.entitySnapshots.size || this.entityIds.length;
    const angleStr = this.angleDeg.toFixed(1);
    if (count === 1) {
      const entityType = this.entitySnapshots.values().next().value?.type ?? 'entity';
      return `Rotate ${entityType} by ${angleStr}°`;
    }
    return `Rotate ${count} entities by ${angleStr}°`;
  }

  /**
   * Merge consecutive rotations of the same entities around the same pivot within
   * the merge window. Identity = same id-set + same pivot (the base owns the
   * id-set + dragging + time-window checks).
   */
  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    const o = other as RotateEntityCommand;
    const samePivot = this.pivot.x === o.pivot.x && this.pivot.y === o.pivot.y;
    return this.canMergeTransform(other, samePivot);
  }

  /** Merge with another rotate command — accumulate angles. */
  mergeWith(other: ICommand): ICommand {
    const otherRotate = other as RotateEntityCommand;
    return new RotateEntityCommand(
      this.entityIds,
      this.pivot,
      this.angleDeg + otherRotate.angleDeg,
      this.sceneManager,
      true,
    );
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    if (this.angleDeg === 0) {
      return 'Rotation angle must be non-zero';
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
        pivot: this.pivot,
        angleDeg: this.angleDeg,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
