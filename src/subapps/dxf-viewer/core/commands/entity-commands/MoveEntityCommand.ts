/**
 * MOVE ENTITY COMMANDS — delta subclasses of the in-place transform spine (ADR-507 §8).
 *
 * Moves entities by a 3D delta: plan (x, y) in native canvas units PLUS an optional
 * `z` ELEVATION delta in raw mm (Revit `MoveElement(dx,dy,dz)`, ADR-049 Phase 2).
 *
 * `MoveCommandBase` owns the move-specific core ONCE (the `delta`, the per-entity patch
 * `computeUpdates` = `calculateMovedGeometry`, `getDelta`, the 3D-aware non-zero guard).
 * `MoveEntityCommand` (single) and `MoveMultipleEntitiesCommand` (batch) are thin entry
 * points that differ ONLY in ctor shape, `name`/`type`, serialize envelope and the merge
 * factory — mirroring Revit's `MoveElement` / `MoveElements` (two ergonomic APIs, ONE
 * core), and the codebase's own `SnapshotTransformCommand` / `MergeableUpdateCommand`
 * template-method pattern.
 *
 * Everything below the move core — execute/undo/redo, the associative follower cascade
 * (connected pipes + slab-openings via the transform-agnostic engines), wall-opening
 * recompute and reframe/emit — is the inherited `SnapshotTransformCommand` spine. Undo
 * restores each entity (and its followers) from the PRE-move snapshot (exact, Revit-grade),
 * superseding the former `reverseDelta` recompute (ADR-507 §8 item α / Level 3).
 *
 * Merge: consecutive drag samples of the same entity/selection within the canonical
 * window coalesce into one undo step (Autodesk/Figma pattern), summing the deltas.
 *
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts — the shared in-place spine
 * @see core/commands/entity-commands/move-entity-geometry.ts — `calculateMovedGeometry` (BIM-first dispatcher)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
// ADR-049 Phase 2 — the move delta is 3D (optional `z` = elevation in mm); a 2D `{x,y}`
// caller is unchanged (z absent → pure plan move). Per-type `z` lives in `calculateBimMovedGeometry`.
import type { Point3D } from '../../../bim/types/bim-base';
import { calculateMovedGeometry } from './move-entity-geometry';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';
// SSoT sweep — canonical 3D component-wise sum (ADR-090).
import { addPoint3D } from '../../../rendering/entities/shared/geometry-vector-utils';

/**
 * Sum two move deltas (merge of consecutive drag samples). `z` is kept only when
 * the combined elevation is non-zero, so a pure-plan merge stays 2D and never
 * serialises a spurious `z: 0` (ADR-049 Phase 2).
 */
function mergeMoveDelta(a: Point3D, b: Point3D): Point3D {
  // SSoT sweep — sum via addPoint3D (z: (a.z??0)+(b.z??0)), then strip a zero `z`
  // so a pure-plan merge stays 2D (Firestore never sees a spurious `z: 0`).
  const summed = addPoint3D(a, b);
  return summed.z !== 0 ? summed : { x: summed.x, y: summed.y };
}

/**
 * Shared move core — the SSoT for "translate entities by a 3D delta", reused by both the
 * single- and multi-entity entry points (DRY, no per-class duplication of the patch / guard).
 */
abstract class MoveCommandBase extends SnapshotTransformCommand {
  constructor(
    entityIds: string[],
    protected readonly delta: Point3D,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(entityIds, sceneManager, isDragging);
  }

  /** The per-entity move patch — BIM-first dispatcher (delegates to `calculateBimMovedGeometry`). */
  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    return calculateMovedGeometry(entity, this.delta);
  }

  getDelta(): Point3D {
    return { ...this.delta };
  }

  /**
   * True when the delta actually moves something. ADR-049 Phase 2 — a PURE vertical
   * move (axis-Y gizmo) has x=y=0 but z≠0, so it IS a real move.
   */
  protected hasNonZeroDelta(): boolean {
    return !(this.delta.x === 0 && this.delta.y === 0 && (this.delta.z ?? 0) === 0);
  }
}

/**
 * Command for moving a single entity by a 3D delta.
 */
export class MoveEntityCommand extends MoveCommandBase {
  readonly name = 'MoveEntity';
  readonly type = 'move-entity';

  constructor(
    private readonly entityId: string,
    delta: Point3D,
    sceneManager: ISceneManager,
    /** Optional: mark as a drag sample so consecutive samples coalesce into one undo step. */
    isDragging: boolean = false,
  ) {
    super([entityId], delta, sceneManager, isDragging);
  }

  getDescription(): string {
    const entityType = this.entitySnapshots.get(this.entityId)?.type ?? 'entity';
    return `Move ${entityType} by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /** Merge consecutive drag samples of the SAME entity within the canonical window. */
  canMergeWith(other: ICommand): boolean {
    return other instanceof MoveEntityCommand && this.canMergeTransform(other);
  }

  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveEntityCommand;
    return new MoveEntityCommand(
      this.entityId,
      mergeMoveDelta(this.delta, otherMove.delta),
      this.sceneManager,
      true, // Keep dragging flag
    );
  }

  getEntityId(): string {
    return this.entityId;
  }

  /** 🏢 ENTERPRISE: Serialize for persistence — legacy single-entity shape preserved. */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        delta: this.delta,
        isDragging: this.isDragging,
        entitySnapshot: this.entitySnapshots.get(this.entityId) ?? null,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.entityId) {
      return 'Entity ID is required';
    }
    if (!this.hasNonZeroDelta()) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}

/**
 * Command for moving multiple entities by the same 3D delta (batch operation).
 */
export class MoveMultipleEntitiesCommand extends MoveCommandBase {
  readonly name = 'MoveMultipleEntities';
  readonly type = 'move-multiple-entities';

  constructor(
    entityIds: string[],
    delta: Point3D,
    sceneManager: ISceneManager,
    /** Optional: mark as a drag sample so consecutive samples coalesce into one undo step. */
    isDragging: boolean = false,
  ) {
    super(entityIds, delta, sceneManager, isDragging);
  }

  getDescription(): string {
    return `Move ${this.entityIds.length} entities by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /** Merge consecutive drag samples of the SAME entity set within the canonical window. */
  canMergeWith(other: ICommand): boolean {
    return other instanceof MoveMultipleEntitiesCommand && this.canMergeTransform(other);
  }

  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveMultipleEntitiesCommand;
    return new MoveMultipleEntitiesCommand(
      this.entityIds,
      mergeMoveDelta(this.delta, otherMove.delta),
      this.sceneManager,
      true, // Keep dragging flag
    );
  }

  getEntityIds(): string[] {
    return [...this.entityIds];
  }

  /** 🏢 ENTERPRISE: Serialize for persistence — `{ entityIds, entitySnapshots[] }` + move keys. */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        ...this.baseTransformData(),
        delta: this.delta,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    if (!this.hasNonZeroDelta()) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}
