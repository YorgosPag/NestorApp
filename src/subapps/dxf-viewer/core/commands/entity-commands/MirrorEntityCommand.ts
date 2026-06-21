/**
 * MIRROR ENTITY COMMAND
 *
 * ICommand pattern for mirroring DXF entities across a two-point axis.
 * Supports undo/redo.
 *
 * Two modes:
 *  - keepOriginals = true  (default): creates mirrored copies, originals stay
 *  - keepOriginals = false: replaces originals with mirrored versions
 *
 * ADR-507 §8 — the in-place transform spine (snapshot/restore/cascade/reframe)
 * lives in `SnapshotTransformCommand`; this command supplies only the per-entity
 * mirror patch and its distinctive copy path (whole-entity clones + BIM clone
 * persistence broadcasts).
 *
 * @see SnapshotTransformCommand — shared in-place base
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { mirrorEntity } from '../../../utils/mirror-math';
import type { MirrorAxis } from '../../../utils/mirror-math';
import type { Entity } from '../../../types/entities';
// ADR-363 Phase 7.2 — BIM-aware mirror (axis-aware reflection per kind +
// atomic geometry recompute). Returns null for non-BIM, falls through to the
// generic mirrorEntity() path below.
import { calculateBimMirroredGeometry } from '../../../bim/transforms/bim-mirror-geometry';
// ADR-363 §7.2 — copy+mirror clones of BIM entities need a fresh enterprise ID +
// the create/delete/restore EventBus broadcasts the draw + delete paths use, or
// the Firestore subscription drops the clone on the next snapshot.
import {
  mintBimCloneIdentity,
  broadcastBimCloneCreated,
  broadcastBimCloneDeleted,
  broadcastBimCloneRestored,
} from '../../../bim/transforms/bim-clone-persistence';
import { SnapshotTransformCommand } from './SnapshotTransformCommand';

export class MirrorEntityCommand extends SnapshotTransformCommand {
  readonly name = 'MirrorEntities';
  readonly type = 'mirror-entities';

  /**
   * The mirrored clones added by this command (keepOriginals mode). Stored whole
   * — not just ids — so undo/redo are id-STABLE (redo re-adds the same entity
   * instead of minting a fresh id, which would orphan the previous Firestore
   * doc) and so undo/redo can fire the matching BIM delete/restore broadcasts.
   */
  private createdEntities: SceneEntity[] = [];

  constructor(
    entityIds: string[],
    private readonly mirrorAxis: MirrorAxis,
    private readonly keepOriginals: boolean = true,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager);
  }

  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const bimPatch = calculateBimMirroredGeometry(entity as unknown as Entity, this.mirrorAxis);
    if (bimPatch !== null) return bimPatch as Partial<SceneEntity>;
    return mirrorEntity(entity as unknown as Entity, this.mirrorAxis) as Partial<SceneEntity>;
  }

  /**
   * Builds the mirrored clone of `entity`: applies the mirror patch and assigns
   * a fresh identity. BIM entities get a per-type enterprise ID + a NEW IFC
   * GlobalId (ADR-363 §7.2 / N.6); other entities keep the generic id path.
   */
  private buildMirroredClone(entity: SceneEntity): SceneEntity {
    const updates = this.computeUpdates(entity);
    const identity = mintBimCloneIdentity((entity as { type?: string }).type);
    const clone = identity
      ? { ...entity, ...updates, id: identity.id, ifcGuid: identity.ifcGuid }
      : { ...entity, ...updates, id: generateEntityId() };
    return clone as unknown as SceneEntity;
  }

  execute(): void {
    if (!this.keepOriginals) {
      this.executeInPlace();
      return;
    }
    // copy+mirror: clones added, originals stay.
    this.entitySnapshots.clear();
    this.createdEntities = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const clone = this.buildMirroredClone(entity);
      this.sceneManager.addEntity(clone);
      this.createdEntities.push(clone);
      // ADR-363 §7.2 — first Firestore save for BIM clones (no-op otherwise).
      broadcastBimCloneCreated(clone);
    }
    this.wasExecuted = this.createdEntities.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    if (!this.keepOriginals) {
      this.undoInPlace();
      return;
    }
    for (const clone of this.createdEntities) {
      this.sceneManager.removeEntity(clone.id);
      // ADR-363 §7.2 — drop the BIM clone's Firestore doc (+ tombstone).
      broadcastBimCloneDeleted(clone);
    }
  }

  redo(): void {
    if (!this.keepOriginals) {
      this.redoInPlace();
      return;
    }
    // Re-add the SAME clones (id-stable) so undo/redo never orphan a Firestore
    // doc. `broadcastBimCloneRestored` clears the delete tombstone + re-saves.
    for (const clone of this.createdEntities) {
      this.sceneManager.addEntity(clone);
      broadcastBimCloneRestored(clone);
    }
  }

  getDescription(): string {
    const count = this.keepOriginals
      ? this.createdEntities.length
      : (this.entitySnapshots.size || this.entityIds.length);
    const mode = this.keepOriginals ? 'copy+mirror' : 'mirror';
    if (count === 1) return `Mirror entity (${mode})`;
    return `Mirror ${count} entities (${mode})`;
  }

  getAffectedEntityIds(): string[] {
    return this.keepOriginals
      ? this.createdEntities.map((e) => e.id)
      : [...this.entityIds];
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    const dx = this.mirrorAxis.p2.x - this.mirrorAxis.p1.x;
    const dy = this.mirrorAxis.p2.y - this.mirrorAxis.p1.y;
    if (dx * dx + dy * dy < 1e-10) return 'Mirror axis points must be distinct';
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
        mirrorAxis: this.mirrorAxis,
        keepOriginals: this.keepOriginals,
        createdEntityIds: this.createdEntities.map((e) => e.id),
      },
      version: 1,
    };
  }
}
