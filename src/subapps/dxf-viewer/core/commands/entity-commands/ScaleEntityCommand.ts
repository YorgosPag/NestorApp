/**
 * SCALE ENTITY COMMAND — ADR-348 — in-place scaling about a base point.
 *
 * Undoable command for scaling DXF entities around a base point.
 * Supports uniform scale (sx=sy) and non-uniform scale (sx≠sy).
 *
 * CIRCLE → ELLIPSE conversion is handled automatically via
 * scale-entity-transform.ts (SSOT). Undo restores original entity type.
 *
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * scale patch.
 *
 * ⚠️ Scale-with-COPY is not here. It is `CloneWithTransformCommand` (Revit
 * `ElementTransformUtils.CopyElements` — clone with the transform baked in), reached
 * via `createScaleCommand({copy: true})`. This command is in-place only; do not
 * re-add a `copyMode` flag.
 *
 * @see ADR-348 §Architecture — Command Registration
 * @see transform-command-factory.ts — `createScaleCommand` picks in-place vs copy
 * @see SnapshotTransformCommand — shared in-place base
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { buildScalePatch, scaleParamError } from './transform-patch-builders';
import type { ScaleParams, TransformPatch } from './transform-patch-builders';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

// Re-exported for back-compat: `ScaleParams` now lives with the patch builders that
// bind it, but the public barrel + existing importers name it from here.
export type { ScaleParams } from './transform-patch-builders';

export class ScaleEntityCommand extends SnapshotTransformCommand {
  readonly name = 'ScaleEntities';
  readonly type = 'scale-entities';

  /** Bound once — `computeUpdates` runs per entity, and again per follower. */
  private readonly patch: TransformPatch;

  constructor(
    entityIds: string[],
    private readonly basePoint: Point2D,
    private readonly params: ScaleParams,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager);
    this.patch = buildScalePatch(basePoint, params);
  }

  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    return this.patch(entity);
  }

  getDescription(): string {
    const count = this.entitySnapshots.size || this.entityIds.length;
    const noun = count === 1 ? 'entity' : 'entities';
    if (this.params.mode === 'uniform') {
      return `Scale ${count} ${noun} ×${this.params.factor.toFixed(3)}`;
    }
    return `Scale ${count} ${noun} sx=${this.params.sx.toFixed(3)} sy=${this.params.sy.toFixed(3)}`;
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) return 'At least one entity ID is required';
    return scaleParamError(this.params);
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
      },
      version: 1,
    };
  }
}
