/**
 * SNAPSHOT TRANSFORM COMMAND — abstract base (SSoT) for the in-place transform family.
 *
 * `MoveEntityCommand`, `MoveMultipleEntitiesCommand`, `RotateEntityCommand`,
 * `ScaleEntityCommand` and `MirrorEntityCommand` all repeated the SAME in-place
 * skeleton verbatim:
 *   - execute  → snapshot each entity, apply a per-entity geometry patch, then
 *                cascade hosted openings + reframe beams in ONE emit.
 *   - undo     → emit the restored entities FIRST (race guard), restore geometry
 *                from the snapshots, re-cascade openings, reframe-after-restore.
 *   - redo     → re-apply the patch from the snapshots + the same cascade/emit.
 *   - serialize→ `{ entityIds, entitySnapshots[] }` + each command's extra keys.
 *
 * The ONLY thing that genuinely varies in-place is the per-entity patch
 * (`computeUpdates`) — delta / rotation / scale / mirror. Everything else is the
 * eliminated boilerplate, owned here as template methods.
 *
 * ⚠️ The **copy path** (Rotate/Scale id-clones, Mirror whole-entity clones with
 * BIM persistence broadcasts) genuinely differs per command and is intentionally
 * NOT modelled here — those subclasses override `execute`/`undo`/`redo` and call
 * the `*InPlace` helpers only for the in-place branch. Forcing copy into the base
 * would be a leaky abstraction (ADR-507 §8 decision gate).
 *
 * Undo restores geometry from the snapshot for Rotate/Scale/Mirror. Move keeps
 * its `reverseDelta` recompute as an `undo` override (behaviour-identical); a
 * later pass may unify Move onto snapshot-restore.
 *
 * The reframe/emit cascade itself is already SSoT — this base only orchestrates
 * the call order; it does NOT re-implement it.
 *
 * @see core/commands/entity-commands/MergeableUpdateCommand.ts — the params-family sibling base
 * @see bim/beams/beam-column-reframe-cascade — reframe/emit SSoT (reused, not duplicated)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { isWithinMergeWindow, sameEntityIdSet } from '../merge-window';
// ADR-363 §5.4 — recompute hosted openings against the transformed walls.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-492 — reframe the beams that frame into the transformed columns/beams and announce
// transformed + reframed in ONE `bim:entities-moved`. This whole family shares this SSoT.
import {
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../../../bim/beams/beam-column-reframe-cascade';

/**
 * Geometry fields to restore from a snapshot on undo — everything EXCEPT the
 * identity fields (`id`, `layer`, `visible`). `type` is intentionally kept so a
 * Scale circle→ellipse conversion is reversible; for Rotate/Mirror the type is
 * unchanged, so restoring it is a harmless no-op.
 */
function geometryFromSnapshot(snapshot: SceneEntity): Partial<SceneEntity> {
  const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot as SceneEntity & {
    layer?: unknown;
    visible?: unknown;
  };
  return geometry as Partial<SceneEntity>;
}

export abstract class SnapshotTransformCommand implements ICommand {
  readonly id: string;
  readonly timestamp: number;

  /** Human-readable command name — declared by each subclass. */
  abstract readonly name: string;
  /** Unique type identifier — declared by each subclass; drives canMergeWith. */
  abstract readonly type: string;

  /** Pre-transform snapshots, keyed by entity id (populated by `executeInPlace`). */
  protected entitySnapshots: Map<string, SceneEntity> = new Map();
  protected wasExecuted = false;

  constructor(
    protected readonly entityIds: string[],
    protected readonly sceneManager: ISceneManager,
    /** Marks a drag sample so consecutive samples coalesce into one undo step. */
    protected readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  // --------------------------------------------------------------------------
  // Subclass contract
  // --------------------------------------------------------------------------

  /**
   * The per-entity geometry patch — the ONLY thing that varies in-place. Called
   * with the live entity (execute) and with the snapshot (redo); it MUST be a
   * pure function of its input so both produce the same patch.
   */
  protected abstract computeUpdates(entity: SceneEntity): Partial<SceneEntity>;

  abstract getDescription(): string;
  abstract serialize(): SerializedCommand;

  // --------------------------------------------------------------------------
  // Shared in-place spine (the eliminated boilerplate)
  // --------------------------------------------------------------------------

  /** execute/redo in-place: snapshot → patch → batch commit → cascade + reframe. */
  protected executeInPlace(): void {
    this.entitySnapshots.clear();
    const updatesMap = new Map<string, Partial<SceneEntity>>();
    const transformed: SceneEntity[] = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      this.entitySnapshots.set(entityId, deepClone(entity));
      const updates = this.computeUpdates(entity);
      updatesMap.set(entityId, updates);
      transformed.push({ ...entity, ...updates } as SceneEntity);
    }

    this.wasExecuted = updatesMap.size > 0;
    if (this.wasExecuted) {
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 — reframe + announce transformed + reframed in ONE emit (no reactive loop).
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
    }
  }

  /** undo in-place: emit restored FIRST (race guard) → restore from snapshots → cascade + reframe. */
  protected undoInPlace(): void {
    if (!this.wasExecuted) return;

    // Emit FIRST so persistence hooks mark the entity dirty BEFORE the scene is
    // mutated — closes the race where a Firestore snapshot (dirty=false) could
    // overwrite the reverted scene with stale transformed data.
    emitRestoredEntities([...this.entitySnapshots.values()]);

    const updatesMap = new Map<string, Partial<SceneEntity>>();
    for (const [entityId, snapshot] of this.entitySnapshots) {
      updatesMap.set(entityId, geometryFromSnapshot(snapshot));
    }
    this.sceneManager.updateEntities(updatesMap);

    cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
    // ADR-492 — re-frame beams against the restored geometry; separate emit (restore stays first).
    reframeBeamsAndEmitAfterRestore(this.entityIds, this.sceneManager);
  }

  /**
   * Undo variant for delta-based commands (Move) that recompute the INVERSE
   * patch from the live entity rather than restoring the snapshot. Keeps the
   * exact same race-guarded emit/cascade ordering as `undoInPlace` — the SSoT
   * lives here, the subclass supplies only the inverse geometry.
   */
  protected undoInPlaceWith(inverseUpdates: (entity: SceneEntity) => Partial<SceneEntity>): void {
    if (!this.wasExecuted) return;

    emitRestoredEntities([...this.entitySnapshots.values()]);

    const updatesMap = new Map<string, Partial<SceneEntity>>();
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) updatesMap.set(entityId, inverseUpdates(entity));
    }
    if (updatesMap.size > 0) this.sceneManager.updateEntities(updatesMap);

    cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
    reframeBeamsAndEmitAfterRestore(this.entityIds, this.sceneManager);
  }

  /** redo in-place: re-apply the patch from the snapshots (deterministic). */
  protected redoInPlace(): void {
    const updatesMap = new Map<string, Partial<SceneEntity>>();
    const transformed: SceneEntity[] = [];

    for (const entityId of this.entityIds) {
      const snapshot = this.entitySnapshots.get(entityId);
      if (!snapshot) continue;
      const updates = this.computeUpdates(snapshot);
      updatesMap.set(entityId, updates);
      transformed.push({ ...snapshot, ...updates } as SceneEntity);
    }

    if (updatesMap.size > 0) {
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
    }
  }

  // --------------------------------------------------------------------------
  // ICommand defaults — copy-mode subclasses override execute/undo/redo and call
  // the `*InPlace` helpers only for their in-place branch.
  // --------------------------------------------------------------------------

  execute(): void {
    this.executeInPlace();
  }

  undo(): void {
    this.undoInPlace();
  }

  redo(): void {
    this.redoInPlace();
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  // --------------------------------------------------------------------------
  // Merge — opt-in helper for the drag-coalescing subclasses (Move, Rotate).
  // Non-merging subclasses (Scale, Mirror) simply don't define canMergeWith.
  // --------------------------------------------------------------------------

  /**
   * Shared merge gate: same `type`, same entity-id set, both dragging, within the
   * canonical merge window. `extraMatch` lets a subclass add its own identity
   * predicate (e.g. Rotate requires the same pivot).
   */
  protected canMergeTransform(other: ICommand, extraMatch = true): boolean {
    if (other.type !== this.type) return false;
    const o = other as SnapshotTransformCommand;
    if (!sameEntityIdSet(this.entityIds, o.entityIds)) return false;
    if (!extraMatch) return false;
    if (!this.isDragging || !o.isDragging) return false;
    return isWithinMergeWindow(this, other);
  }

  /** Canonical serialized payload — subclasses spread this and add their own keys. */
  protected baseTransformData(): Record<string, unknown> {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => snapshotsArray.push({ id, entity }));
    return { entityIds: this.entityIds, entitySnapshots: snapshotsArray };
  }
}
