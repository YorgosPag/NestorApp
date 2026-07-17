/**
 * ROTATE ENTITY COMMAND — in-place rotation about a pivot.
 *
 * 🏢 ADR-188: Entity Rotation System — Command Pattern
 * Supports undo/redo and command merging for smooth drag rotation.
 *
 * Consecutive rotations within the merge window are merged into a single command
 * for smooth undo of drag-to-rotate operations (Autodesk/Figma pattern).
 *
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * rotation patch and its angle-accumulating merge.
 *
 * ⚠️ Rotate-with-COPY is not here. It is `CloneWithTransformCommand` (Revit
 * `ElementTransformUtils.CopyElements` — clone with the transform baked in), reached
 * via `createRotateCommand({copy: true})`. This command is in-place only; do not
 * re-add a `copyMode` flag.
 *
 * @see ADR-188 §6.2 (Entity-specific rotation logic)
 * @see transform-command-factory.ts — `createRotateCommand` picks in-place vs copy
 * @see SnapshotTransformCommand — shared in-place base
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { buildRotatePatch, rotateParamError } from './transform-patch-builders';
import type { TransformPatch } from './transform-patch-builders';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

/**
 * Command for rotating multiple entities around a pivot point.
 * All entities rotate by the same angle (batch operation).
 */
export class RotateEntityCommand extends SnapshotTransformCommand {
  readonly name = 'RotateEntities';
  readonly type = 'rotate-entities';

  /** Bound once — `computeUpdates` runs per entity, and again per follower. */
  private readonly patch: TransformPatch;

  constructor(
    entityIds: string[],
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(entityIds, sceneManager, isDragging);
    this.patch = buildRotatePatch(pivot, angleDeg);
  }

  /** ADR-363 Phase 7.2 BIM-aware rotate, else generic — owned by the patch SSoT. */
  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    return this.patch(entity);
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
    return rotateParamError(this.angleDeg);
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
