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
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { mirrorEntity } from '../../../utils/mirror-math';
import type { MirrorAxis } from '../../../utils/mirror-math';
import type { Entity } from '../../../types/entities';
// ADR-363 Phase 7.2 — BIM-aware mirror (axis-aware reflection per kind +
// atomic geometry recompute). Returns null for non-BIM, falls through to the
// generic mirrorEntity() path below.
import { calculateBimMirroredGeometry } from '../../../bim/transforms/bim-mirror-geometry';
// ADR-363 §5.4 — recompute hosted openings against mirrored walls (in-place mode).
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-492 Φ2 — an in-place mirrored beam (or column) re-frames the associated beams to the
// column faces, then announces transformed + reframed in ONE `bim:entities-moved`. Command-time,
// single emit, no reactive loop. copy+mirror clones carry no association (handled separately).
import {
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../../../bim/beams/beam-column-reframe-cascade';
// ADR-363 §7.2 — copy+mirror clones of BIM entities need a fresh enterprise ID +
// the create/delete/restore EventBus broadcasts the draw + delete paths use, or
// the Firestore subscription drops the clone on the next snapshot.
import {
  mintBimCloneIdentity,
  broadcastBimCloneCreated,
  broadcastBimCloneDeleted,
  broadcastBimCloneRestored,
} from '../../../bim/transforms/bim-clone-persistence';

export class MirrorEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'MirrorEntities';
  readonly type = 'mirror-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  /**
   * The mirrored clones added by this command (keepOriginals mode). Stored whole
   * — not just ids — so undo/redo are id-STABLE (redo re-adds the same entity
   * instead of minting a fresh id, which would orphan the previous Firestore
   * doc) and so undo/redo can fire the matching BIM delete/restore broadcasts.
   */
  private createdEntities: SceneEntity[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly mirrorAxis: MirrorAxis,
    private readonly keepOriginals: boolean = true,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.entitySnapshots.clear();
    this.createdEntities = [];

    // ADR-492 Φ2 — in-place mirrored entities (snapshot+updates), for the reframe announce.
    const transformed: SceneEntity[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;

      if (this.keepOriginals) {
        const clone = this.buildMirroredClone(entity);
        this.sceneManager.addEntity(clone);
        this.createdEntities.push(clone);
        // ADR-363 §7.2 — first Firestore save for BIM clones (no-op otherwise).
        broadcastBimCloneCreated(clone);
      } else {
        const updates = this.computeMirrorUpdates(entity);
        this.entitySnapshots.set(entityId, deepClone(entity));
        this.sceneManager.updateEntity(entityId, updates);
        transformed.push({ ...entity, ...updates } as SceneEntity);
      }
    }

    this.wasExecuted = this.keepOriginals
      ? this.createdEntities.length > 0
      : this.entitySnapshots.size > 0;

    // ADR-363 §5.4 — in-place mirror: hosted openings follow the mirrored wall.
    // (copy+mirror clones carry no hosted openings.)
    if (!this.keepOriginals) {
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — an in-place mirrored beam re-snaps its ends to the column faces;
      // transformed + reframed announced in ONE emit (persist + organism + footing-follow).
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
    }
  }

  /**
   * Builds the mirrored clone of `entity`: applies the mirror patch and assigns
   * a fresh identity. BIM entities get a per-type enterprise ID + a NEW IFC
   * GlobalId (ADR-363 §7.2 / N.6); other entities keep the generic id path.
   */
  private buildMirroredClone(entity: SceneEntity): SceneEntity {
    const updates = this.computeMirrorUpdates(entity);
    const identity = mintBimCloneIdentity((entity as { type?: string }).type);
    const clone = identity
      ? { ...entity, ...updates, id: identity.id, ifcGuid: identity.ifcGuid }
      : { ...entity, ...updates, id: generateEntityId() };
    return clone as unknown as SceneEntity;
  }

  /**
   * Computes the mirror patch for a single entity. ADR-363 Phase 7.2:
   * tries BIM-aware mirror first (returns `{params, geometry}` atomic patch
   * for the 7 BIM kinds); falls through to the generic `mirrorEntity()`
   * path otherwise.
   */
  private computeMirrorUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const bimPatch = calculateBimMirroredGeometry(
      entity as unknown as Entity,
      this.mirrorAxis,
    );
    if (bimPatch !== null) return bimPatch;
    const generic = mirrorEntity(entity as unknown as Entity, this.mirrorAxis);
    return generic as Partial<SceneEntity>;
  }

  undo(): void {
    if (!this.wasExecuted) return;

    if (this.keepOriginals) {
      for (const clone of this.createdEntities) {
        this.sceneManager.removeEntity(clone.id);
        // ADR-363 §7.2 — drop the BIM clone's Firestore doc (+ tombstone).
        broadcastBimCloneDeleted(clone);
      }
    } else {
      // ADR-492 Φ2 — race-guarded restore-first emit (mark dirty before scene mutation: the doc
      // still holds the MIRRORED geometry). SSoT helper — same ordering as Move/Rotate/Scale undo.
      emitRestoredEntities([...this.entitySnapshots.values()]);
      for (const [entityId, snapshot] of this.entitySnapshots) {
        const { id: _id, type: _type, layer: _layer, visible: _visible, ...geometry } = snapshot;
        this.sceneManager.updateEntity(entityId, geometry);
      }
      // ADR-363 §5.4 — re-derive hosted openings against the restored walls.
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — re-frame beams against the restored geometry; separate emit (restore first).
      reframeBeamsAndEmitAfterRestore(this.entityIds, this.sceneManager);
    }
  }

  redo(): void {
    if (this.keepOriginals) {
      // Re-add the SAME clones (id-stable) so undo/redo never orphan a Firestore
      // doc. `broadcastBimCloneRestored` clears the delete tombstone + re-saves.
      for (const clone of this.createdEntities) {
        this.sceneManager.addEntity(clone);
        broadcastBimCloneRestored(clone);
      }
    } else {
      const transformed: SceneEntity[] = [];
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) {
          const updates = this.computeMirrorUpdates(snapshot);
          this.sceneManager.updateEntity(entityId, updates);
          transformed.push({ ...snapshot, ...updates } as SceneEntity);
        }
      }
      // ADR-363 §5.4 — hosted openings follow the re-mirrored walls.
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — reframe beams + announce transformed + reframed in ONE emit (mirror execute).
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
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
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => {
      snapshotsArray.push({ id, entity });
    });

    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        mirrorAxis: this.mirrorAxis,
        keepOriginals: this.keepOriginals,
        entitySnapshots: snapshotsArray,
        createdEntityIds: this.createdEntities.map((e) => e.id),
      },
      version: 1,
    };
  }
}
