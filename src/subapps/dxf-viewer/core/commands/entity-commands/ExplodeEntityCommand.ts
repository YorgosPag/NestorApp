/**
 * EXPLODE ENTITY COMMAND — ADR-510 Φ5
 *
 * Breaks one or more COMPOUND entities (polyline / rectangle) into their
 * constituent primitive segments (AutoCAD EXPLODE). Generic multi-select mirror
 * of `ExplodeArrayCommand`:
 *
 *   execute/redo: for each source → addEntity(primitives) → removeEntity(source).
 *   undo:         removeEntity(created) → addEntity(sourceSnapshots).
 *
 * Sources with nothing to explode (primitives) are left untouched. The scene is
 * mutated ONLY through the injected {@link ISceneManager} (LevelSceneManagerAdapter),
 * the same boundary as every other entity command.
 *
 * @see systems/explode/explode-entity.ts (pure geometry SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ5
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { deepClone } from '../../../utils/clone-utils';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { explodeEntity } from '../../../systems/explode/explode-entity';

export class ExplodeEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'ExplodeEntity';
  readonly type = 'explode-entity';
  readonly timestamp: number;

  private createdEntityIds: string[] = [];
  private sourceSnapshots: SceneEntity[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: readonly string[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this._doExplode();
    this.wasExecuted = true;
  }

  redo(): void {
    // Sources are back in scene from undo — explode them again.
    this._doExplode();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const id of this.createdEntityIds) this.sceneManager.removeEntity(id);
    for (const snap of this.sourceSnapshots) this.sceneManager.addEntity(snap);
  }

  canMergeWith(_other: ICommand): boolean {
    return false;
  }

  private _doExplode(): void {
    this.createdEntityIds = [];
    this.sourceSnapshots = [];
    for (const id of this.entityIds) {
      const raw = this.sceneManager.getEntity(id);
      if (!raw) continue;
      const primitives = explodeEntity(raw as unknown as Entity);
      if (!primitives || primitives.length === 0) continue; // primitive → leave as-is
      this.sourceSnapshots.push(deepClone(raw));
      for (const prim of primitives) {
        this.sceneManager.addEntity(prim as unknown as SceneEntity);
        this.createdEntityIds.push(prim.id);
      }
      this.sceneManager.removeEntity(id);
    }
  }

  getDescription(): string {
    return `Explode ${this.sourceSnapshots.length} entities into ${this.createdEntityIds.length} primitives`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds, ...this.createdEntityIds];
  }

  /** IDs of the primitives created by the last explode (for post-explode reselect). */
  getCreatedEntityIds(): string[] {
    return [...this.createdEntityIds];
  }

  validate(): string | null {
    if (!this.entityIds.length) return 'At least one entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: [...this.entityIds],
        createdEntityIds: this.createdEntityIds,
        sourceSnapshots: this.sourceSnapshots as unknown as Record<string, unknown>[],
      },
      version: 1,
    };
  }
}
