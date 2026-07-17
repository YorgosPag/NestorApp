/**
 * CLONE-WITH-TRANSFORM COMMAND — the ONE copy mechanism for the transform family.
 *
 * Revit's `ElementTransformUtils.CopyElements(doc, ids, transform)`: copy-with-a-
 * transform is ONE atomic operation with the transform baked into the clone's
 * construction — NOT a clone followed by a transform. This command is that op.
 *
 * ── Why this exists (ADR-507 §8) ──────────────────────────────────────────────
 * Rotate, Scale and Mirror each grew their OWN copy branch, all three doing the
 * identical thing: `for each source → {...entity, ...patch(entity), id: newId} →
 * addEntity → track`. jscpd flagged Rotate⇔Scale (t222); the Mirror twin was
 * invisible to it only because the names differ (`keepOriginals`/`createdEntities`).
 *
 * Mirror was the ONLY correct one. Rotate/Scale were degraded copies of it:
 *   - minted a generic `generateEntityId()` instead of a per-kind enterprise ID,
 *     and broadcast nothing → BIM clones vanished on the next Firestore snapshot
 *     (the "copy flashes then vanishes" bug — see bim-clone-persistence.ts);
 *   - re-minted a FRESH id on every `redo()` → orphaned the previous Firestore doc;
 *   - Rotate didn't even override `getAffectedEntityIds()` → reported source ids.
 * This command is Mirror's mature branch, generalized over the patch — so all three
 * inherit the correct behaviour instead of two inheriting the broken one.
 *
 * ── Why a sibling, not a base-class branch ────────────────────────────────────
 * ADR-507 §8's decision gate ("forcing copy into the base = leaky abstraction")
 * still holds and is REINFORCED here: copy does not move INTO
 * `SnapshotTransformCommand`, it moves OUT of the hierarchy entirely. The in-place
 * family keeps its snapshot/restore/follower-cascade spine; copy has none of that
 * (there is nothing to snapshot — the target does not exist yet) and lives here.
 *
 * ── Why not CompositeCommand[Clone, Transform] ────────────────────────────────
 * A transform command cannot target an id that does not exist when it is built:
 * `SnapshotTransformCommand.entityIds` is `readonly`, fixed at construction, while
 * the clone's id is minted inside `execute()`. Composition would also desync on the
 * second undo/redo (the clone child re-mints, the transform child holds the stale
 * id → silent no-op), and would double-mutate the scene (clone at source pose, then
 * transform) → visible flash + two Firestore writes per clone. `BimCopyCommand`'s
 * header documents the same conclusion for the BIM copy path.
 *
 * NOTE: deliberately NOT mergeable — a copy is a discrete act, never a drag sample.
 * (This also retires `RotateEntityCommand.mergeWith`'s silent `copyMode` drop.)
 *
 * @see transform-patch-builders.ts — the shared per-entity patch SSoT
 * @see transform-command-factory.ts — the caller seam that chooses copy vs in-place
 * @see bim/transforms/bim-clone-persistence.ts — BIM identity + broadcast SSoT (ADR-363 §7.2)
 * @see MirrorEntityCommand — the branch this generalizes
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { TransformPatch } from './transform-patch-builders';
// ADR-363 §7.2 — a cloned BIM entity needs a fresh per-kind enterprise ID + a new
// IFC GlobalId, plus the create/delete/restore broadcasts the draw + delete paths
// use, or the Firestore subscription drops it on the next snapshot. All no-ops for
// non-BIM entities.
import {
  mintBimCloneIdentity,
  broadcastBimCloneCreated,
  broadcastBimCloneDeleted,
  broadcastBimCloneRestored,
} from '../../../bim/transforms/bim-clone-persistence';

/** Which transform produced the clones — drives `type` + `getDescription`. */
export type CloneTransformKind = 'rotate' | 'scale' | 'mirror';

export class CloneWithTransformCommand implements ICommand {
  readonly id: string;
  readonly name = 'CloneWithTransform';
  readonly type: string;
  readonly timestamp: number;

  /**
   * The clones added by this command. Stored WHOLE — not just ids — so undo/redo are
   * id-STABLE: redo re-adds the same entity instead of minting a fresh id, which would
   * orphan the previous Firestore doc. Also lets undo/redo fire the matching BIM
   * delete/restore broadcasts with the real entity payload.
   */
  private createdEntities: SceneEntity[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly sceneManager: ISceneManager,
    /** The parameter-bound geometry patch, baked into each clone at construction. */
    private readonly patch: TransformPatch,
    private readonly kind: CloneTransformKind,
    /**
     * Degenerate-params error from the shared validators (`rotateParamError` etc.),
     * or null. Passed in rather than recomputed: the params live in the patch's
     * closure, and a copy must reject a zero-angle rotate exactly like the in-place
     * command does — callers gate on `command.validate() !== null`.
     */
    private readonly paramError: string | null = null,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.type = `clone-${kind}-entities`;
  }

  /**
   * Builds the transformed clone of `entity`: applies the patch and assigns a fresh
   * identity. BIM entities get a per-type enterprise ID + a NEW IFC GlobalId
   * (ADR-363 §7.2 / N.6); everything else takes the generic id path.
   */
  private buildClone(entity: SceneEntity): SceneEntity {
    const updates = this.patch(entity);
    const identity = mintBimCloneIdentity((entity as { type?: string }).type);
    const clone = identity
      ? { ...entity, ...updates, id: identity.id, ifcGuid: identity.ifcGuid }
      : { ...entity, ...updates, id: generateEntityId() };
    return clone as unknown as SceneEntity;
  }

  execute(): void {
    this.createdEntities = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const clone = this.buildClone(entity);
      this.sceneManager.addEntity(clone);
      this.createdEntities.push(clone);
      // ADR-363 §7.2 — first Firestore save for BIM clones (no-op otherwise).
      broadcastBimCloneCreated(clone);
    }
    this.wasExecuted = this.createdEntities.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const clone of this.createdEntities) {
      this.sceneManager.removeEntity(clone.id);
      // ADR-363 §7.2 — drop the BIM clone's Firestore doc (+ tombstone).
      broadcastBimCloneDeleted(clone);
    }
  }

  redo(): void {
    // Re-add the SAME clones (id-stable) so undo/redo never orphan a Firestore doc.
    // `broadcastBimCloneRestored` clears the delete tombstone + re-saves.
    for (const clone of this.createdEntities) {
      this.sceneManager.addEntity(clone);
      broadcastBimCloneRestored(clone);
    }
  }

  getDescription(): string {
    const count = this.createdEntities.length || this.entityIds.length;
    const noun = count === 1 ? 'entity' : 'entities';
    return `Copy+${this.kind} ${count} ${noun}`;
  }

  /** The clones — this command's product. Never the sources, which it leaves untouched. */
  getAffectedEntityIds(): string[] {
    return this.createdEntities.map((e) => e.id);
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    return this.paramError;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        kind: this.kind,
        createdEntities: this.createdEntities,
      },
      version: 1,
    };
  }
}
