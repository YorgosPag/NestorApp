/**
 * MIRROR ENTITY COMMAND — in-place reflection across a two-point axis.
 *
 * ICommand pattern for mirroring DXF entities across a two-point axis.
 * Supports undo/redo.
 *
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * mirror patch.
 *
 * ⚠️ Mirror-with-COPY (the former `keepOriginals = true`) is not here. It is
 * `CloneWithTransformCommand`, reached via `createMirrorCommand({copy: true})`.
 * This command's whole-entity-clone branch — id-stable clones + BIM identity minting
 * + Firestore create/delete/restore broadcasts — was the mature reference the other
 * two transforms had degraded copies of, so it BECAME that shared command. Rotate and
 * Scale copy now inherit the correct behaviour from it instead of their own broken
 * branches. Do not re-add a `keepOriginals` flag.
 *
 * @see transform-command-factory.ts — `createMirrorCommand` picks in-place vs copy
 * @see CloneWithTransformCommand — the generalized descendant of this command's copy branch
 * @see SnapshotTransformCommand — shared in-place base
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { MirrorAxis } from '../../../utils/mirror-math';
import { buildMirrorPatch, mirrorParamError } from './transform-patch-builders';
import type { TransformPatch } from './transform-patch-builders';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

export class MirrorEntityCommand extends SnapshotTransformCommand {
  readonly name = 'MirrorEntities';
  readonly type = 'mirror-entities';

  /** Bound once — `computeUpdates` runs per entity, and again per follower. */
  private readonly patch: TransformPatch;

  constructor(
    entityIds: string[],
    private readonly mirrorAxis: MirrorAxis,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager);
    this.patch = buildMirrorPatch(mirrorAxis);
  }

  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    return this.patch(entity);
  }

  getDescription(): string {
    const count = this.entitySnapshots.size || this.entityIds.length;
    if (count === 1) return 'Mirror entity';
    return `Mirror ${count} entities`;
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    return mirrorParamError(this.mirrorAxis);
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        ...this.baseTransformData(),
        mirrorAxis: this.mirrorAxis,
      },
      version: 1,
    };
  }
}
