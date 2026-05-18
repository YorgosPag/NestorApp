/**
 * UPDATE ENTITY COMMAND — ADR-357 §4 G9 Phase 9
 *
 * Generic undoable command for patching arbitrary fields on a scene entity.
 * Used by Quick Properties Mini-Panel and any editor needing field-level updates.
 *
 * Pattern mirrors LengthenCommand (snapshot-based undo, ADR-349).
 * Snapshot stores the full entity state before execute so undo is exact.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';

export type EntityPatch = Record<string, unknown>;

export class UpdateEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateEntity';
  readonly type = 'update-entity';
  readonly timestamp: number;

  private snapshot: SceneEntity | null = null;

  constructor(
    private readonly entityId: string,
    private readonly patch: EntityPatch,
    private readonly sceneManager: ISceneManager,
    private readonly label: string = 'Update entity',
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.entityId);
    if (!entity) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.entityId, this.patch as Partial<SceneEntity>);
  }

  undo(): void {
    if (!this.snapshot) return;
    const { id: _id, ...rest } = this.snapshot;
    this.sceneManager.updateEntity(this.entityId, rest as Partial<SceneEntity>);
  }

  redo(): void {
    this.sceneManager.updateEntity(this.entityId, this.patch as Partial<SceneEntity>);
  }

  getDescription(): string {
    return this.label;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity ID required';
    if (Object.keys(this.patch).length === 0) return 'Patch is empty';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        patch: this.patch,
        snapshot: this.snapshot,
        label: this.label,
      },
      version: 1,
    };
  }
}
