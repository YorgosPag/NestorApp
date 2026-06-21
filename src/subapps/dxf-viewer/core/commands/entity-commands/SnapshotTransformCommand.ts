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
 * Undo restores geometry from the snapshot for ALL in-place subclasses — Rotate,
 * Scale, Mirror AND Move (ADR-507 §8 item α: Move migrated from its former
 * `reverseDelta` recompute to exact snapshot-restore, so every subclass now shares
 * the one snapshot-restore undo path).
 *
 * The reframe/emit cascade itself is already SSoT — this base only orchestrates
 * the call order; it does NOT re-implement it.
 *
 * ADR-408 Φ-C / ADR-507 §8 — the transform also self-cascades its associative
 * FOLLOWERS inside the command (Revit «connected ends move with the element»):
 * connected pipes (MEP host/segment) and a slab's slab-openings follow EVERY
 * transform (rotate/scale/mirror) in EVERY gesture (2D + 3D), via transform-agnostic
 * engines fed by the same `computeUpdates`. Previously rotate followed pipes only in
 * the 3D gizmo wrapper, and slab-openings never followed a transform.
 *
 * @see core/commands/entity-commands/MergeableUpdateCommand.ts — the params-family sibling base
 * @see bim/beams/beam-column-reframe-cascade — reframe/emit SSoT (reused, not duplicated)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { canMergeDragSamples, sameEntityIdSet } from '../merge-window';
import { geometryFromSnapshot } from './snapshot-geometry';
// ADR-363 §5.4 — recompute hosted openings against the transformed walls.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-492 — reframe the beams that frame into the transformed columns/beams and announce
// transformed + reframed in ONE `bim:entities-moved`. This whole family shares this SSoT.
import {
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../../../bim/beams/beam-column-reframe-cascade';
// ADR-408 Φ-C / ADR-507 §8 — the associative followers of a transform live INSIDE the
// command (Revit «connected ends move with the element»): pipes snapped to a transformed
// MEP host/segment, and a transformed slab's independent-coord slab-openings. Both reuse
// the SAME `computeUpdates` that transforms the hosts, through transform-agnostic engines.
import {
  cascadeConnectedPipes,
  nextParamsFromTransformPatch,
} from '../../../bim/mep-segments/cascade-connected-pipes';
import { cascadeTransformedSlabOpenings } from '../../../bim/cascade/cascade-transformed-slab-openings';

export abstract class SnapshotTransformCommand implements ICommand {
  readonly id: string;
  readonly timestamp: number;

  /** Human-readable command name — declared by each subclass. */
  abstract readonly name: string;
  /** Unique type identifier — declared by each subclass; drives canMergeWith. */
  abstract readonly type: string;

  /** Pre-transform snapshots, keyed by entity id (populated by `executeInPlace`). */
  protected entitySnapshots: Map<string, SceneEntity> = new Map();
  /**
   * Pre-transform snapshots of the associative FOLLOWERS (connected pipes + the slab's
   * slab-openings) retargeted by this transform, keyed by id. Captured on execute/redo so
   * undo restores them from snapshot symmetrically with the hosts (ADR-507 §8). The
   * followers are NOT in `entityIds`, so they are tracked separately.
   */
  protected followerSnapshots: Map<string, SceneEntity> = new Map();
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

  /**
   * Run the associative follower cascades for THIS transform — BEFORE the host's own
   * patch lands (OLD→NEW anchors, mirror of the move cascade ordering). The SAME
   * `computeUpdates` that transforms the hosts is applied to the followers, so there is
   * ONE path with no per-transform branching (Revit «reactions live IN the command»):
   *   - connected pipes snapped to a transformed MEP host/segment (ADR-408 Φ-C), and
   *   - the slab-openings hosted on a transformed slab (ADR-049).
   * Captures each follower's pre-transform snapshot in `followerSnapshots` (for
   * snapshot-symmetric undo) and returns the post-transform followers for the single
   * reframe/emit.
   */
  private runForwardFollowerCascades(): SceneEntity[] {
    const pipes = cascadeConnectedPipes(
      this.entityIds,
      this.sceneManager,
      (entity) => nextParamsFromTransformPatch(this.computeUpdates(entity as unknown as SceneEntity)),
    );
    const slabOpenings = cascadeTransformedSlabOpenings(
      this.entityIds,
      this.sceneManager,
      (opening) => this.computeUpdates(opening as unknown as SceneEntity),
    );
    for (const snapshot of pipes.snapshots) this.followerSnapshots.set(snapshot.id, snapshot);
    for (const snapshot of slabOpenings.snapshots) this.followerSnapshots.set(snapshot.id, snapshot);
    return [...pipes.moved, ...slabOpenings.moved];
  }

  /** execute/redo in-place: snapshot → follower cascade → patch → batch commit → cascade + reframe. */
  protected executeInPlace(): void {
    this.entitySnapshots.clear();
    this.followerSnapshots.clear();
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
      // Followers retarget on the OLD host pose — run BEFORE the host patch lands.
      const followers = this.runForwardFollowerCascades();
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 — reframe + announce transformed hosts + followers + reframed in ONE emit.
      reframeBeamsAndEmit([...transformed, ...followers], this.entityIds, this.sceneManager);
    }
  }

  /** undo in-place: emit restored FIRST (race guard) → restore hosts + followers from snapshots → cascade + reframe. */
  protected undoInPlace(): void {
    if (!this.wasExecuted) return;

    const followerSnapshots = [...this.followerSnapshots.values()];

    // Emit FIRST so persistence hooks mark the entity dirty BEFORE the scene is
    // mutated — closes the race where a Firestore snapshot (dirty=false) could
    // overwrite the reverted scene with stale transformed data. Followers (pipes +
    // slab-openings) are restored symmetrically with the hosts, so they emit here too.
    emitRestoredEntities([...this.entitySnapshots.values(), ...followerSnapshots]);

    const updatesMap = new Map<string, Partial<SceneEntity>>();
    for (const [entityId, snapshot] of this.entitySnapshots) {
      updatesMap.set(entityId, geometryFromSnapshot(snapshot));
    }
    for (const snapshot of followerSnapshots) {
      updatesMap.set(snapshot.id, geometryFromSnapshot(snapshot));
    }
    this.sceneManager.updateEntities(updatesMap);

    cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
    // ADR-492 — re-frame beams against the restored geometry; separate emit (restore stays first).
    reframeBeamsAndEmitAfterRestore(this.entityIds, this.sceneManager);
  }

  /** redo in-place: re-apply the patch from the snapshots (deterministic) + re-run followers. */
  protected redoInPlace(): void {
    this.followerSnapshots.clear();
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
      // Scene is back at the pre-transform pose (undo restored it), so the followers
      // retarget identically to execute — run BEFORE the host patch lands.
      const followers = this.runForwardFollowerCascades();
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      reframeBeamsAndEmit([...transformed, ...followers], this.entityIds, this.sceneManager);
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
    // Both dragging + within the canonical merge window — shared gate SSoT.
    return canMergeDragSamples(this, o, this.isDragging, o.isDragging);
  }

  /** Canonical serialized payload — subclasses spread this and add their own keys. */
  protected baseTransformData(): Record<string, unknown> {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => snapshotsArray.push({ id, entity }));
    return { entityIds: this.entityIds, entitySnapshots: snapshotsArray };
  }
}
