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
 * @see ../../../bim/scene/append-entity-to-scene.ts — the SSoT caller (draw + copy)
 * @see ../../../systems/events/emit-bim-entity-delete-requested.ts — undo delete-event SSoT
 * @see ./CreateColumnsCommand.ts — batch grid-gen precedent (deferred-Firestore pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';
import { emitBimEntityDeleteRequested } from '../../../systems/events/emit-bim-entity-delete-requested';

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
    this.deferEvents('apply');
  }

  redo(): void {
    this.applyScene();
    this.deferEvents('apply');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.removeEntity(this.entity.id);
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
        EventBus.emit('drawing:entity-created', {
          entity: deepClone(entity) as unknown as AnySceneEntity,
          tool,
        });
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
