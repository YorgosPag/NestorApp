/**
 * CREATE BIM ENTITY COMMAND — ADR-390 (symmetric create/undo).
 *
 * Makes the **manual-draw + Ctrl-COPY** creation of a single BIM entity an
 * **undoable** transaction. Before this, `appendEntityToScene` did a BARE
 * `setLevelScene()` (no command) + emitted `drawing:entity-created` → the entity
 * was added to the scene but **never entered the undo history**, so Ctrl+Z could
 * not remove it (the only undoable step was a downstream structural reaction, e.g.
 * `ApplyFoundationLayoutCommand`, leaving the column/beam/slab orphaned on canvas).
 *
 * Symmetric with `DeleteEntityCommand` (ADR-390):
 *   · execute/redo → add to scene + (microtask) emit `drawing:entity-created`
 *     so the `use*Persistence` hook schedules the first Firestore save (UNCHANGED
 *     side-effect — same event `appendEntityToScene` used to fire).
 *   · undo        → remove from scene + (microtask) emit `bim:<type>-delete-requested`
 *     via the `emitBimEntityDeleteRequested` SSoT → Firestore deleteDoc (no zombie
 *     doc), mirror of the manual smart-delete path.
 *
 * Side-effects deferred to a microtask so they run AFTER the synchronous
 * `CommandHistory.execute()` returns — avoids re-entrancy when a structural
 * reaction listening to `drawing:entity-created` calls `history.appendToLast(...)`
 * (it then groups WITH this create command → ONE Ctrl+Z removes the member AND its
 * auto-foundation, Revit-grade). Precedent: `CreateColumnsCommand` /
 * `CreateFoundationsCommand`.
 *
 * ADR-632 Φ4.1 (2026-07-11) — CREATE-time associative reconcile. After the scene
 * mutation (execute/redo add, undo remove) the command runs
 * `reconcileAssociativeGeometryOnCreate` (mirror of `MergeableUpdateCommand` running
 * `reconcileAssociativeGeometry`): a freshly-drawn ceiling slab over an existing stair
 * (or vice-versa) opens the auto stairwell «well» opening IMMEDIATELY, and undo removes
 * it again (idempotent re-run against the reverted scene). Type-gated → no-op for
 * non slab/stair creates (column/beam/furniture/…).
 *
 * @see ../../../bim/scene/append-entity-to-scene.ts — the SSoT caller (draw + copy)
 * @see ../../../bim/cascade/associative-geometry-reconcile.ts — create-time reconcile SSoT
 * @see ../../../systems/events/bim-entity-lifecycle-events.ts — create + undo delete-event SSoT
 * @see ./CreateColumnsCommand.ts — batch grid-gen precedent (deferred-Firestore pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import type { Entity } from '../../../types/entities';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { emitBimEntityCreated, emitBimEntityDeleteRequested } from '../../../systems/events/bim-entity-lifecycle-events';
import { reconcileAssociativeGeometryOnCreate } from '../../../bim/cascade/associative-geometry-reconcile';

export class CreateBimEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateBimEntity';
  readonly type = 'create-bim-entity';
  readonly timestamp: number;

  /** Defensive deep-clone snapshot — independent of later live-scene edits. */
  private readonly entity: AnySceneEntity;
  /** Entity-type discriminator for the undo delete-event (falls back to `tool`). */
  private readonly entityType: string;
  private wasExecuted = false;

  constructor(
    entity: AnySceneEntity,
    private readonly tool: string,
    private readonly sceneManager: ISceneManager,
  ) {
    this.entity = deepClone(entity);
    this.entityType = (entity as { type?: string }).type ?? tool;
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyScene();
    this.wasExecuted = true;
    // ADR-632 Φ4.1 — create-time reconcile BEFORE the deferred emit, ώστε ο planner να
    // δει το νέο entity ήδη στη σκηνή. No-op για μη σκάλα/πλάκα creates.
    reconcileAssociativeGeometryOnCreate(this.entity as unknown as Entity, this.sceneManager);
    this.deferEvents('apply');
  }

  redo(): void {
    this.applyScene();
    reconcileAssociativeGeometryOnCreate(this.entity as unknown as Entity, this.sceneManager);
    this.deferEvents('apply');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.removeEntity(this.entity.id);
    // ADR-632 Φ4.1 — μετά την αφαίρεση του host, ο idempotent cascade σβήνει το πλέον
    // orphan auto «well» opening (σύγκλιση προς τη σωστή προ-create κατάσταση).
    reconcileAssociativeGeometryOnCreate(this.entity as unknown as Entity, this.sceneManager);
    this.deferEvents('revert');
  }

  /** scene: add the (cloned) entity. */
  private applyScene(): void {
    this.sceneManager.addEntity(deepClone(this.entity) as unknown as SceneEntity);
  }

  /**
   * Persistence side-effects, deferred to a microtask so they run after the
   * synchronous command dispatch (mirror `CreateColumnsCommand.deferFirestore`).
   */
  private deferEvents(direction: 'apply' | 'revert'): void {
    const entity = this.entity;
    const tool = this.tool;
    const entityType = this.entityType;
    queueMicrotask(() => {
      if (direction === 'apply') {
        emitBimEntityCreated(deepClone(entity) as unknown as AnySceneEntity, tool);
      } else {
        emitBimEntityDeleteRequested(entityType, entity.id);
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.entityType}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entity.id];
  }

  validate(): string | null {
    return this.entity.id ? null : 'Entity must have an id';
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.entity.id, tool: this.tool },
      version: 1,
    };
  }
}
