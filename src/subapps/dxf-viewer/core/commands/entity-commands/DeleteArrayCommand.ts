/**
 * DELETE ARRAY COMMAND — ADR-353 Session A2
 *
 * Atomically removes an ArrayEntity (including its hiddenSources, which
 * live inside the entity — not in the scene). Undo restores the whole
 * ArrayEntity back to the scene (hiddenSources remain embedded).
 *
 * Note: hiddenSources are NOT re-added as independent scene entities on undo
 * because they were never independent once the array was created.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';

export class DeleteArrayCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteArray';
  readonly type = 'delete-array';
  readonly timestamp: number;

  private arraySnapshot: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly arrayId: string,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.arrayId);
    if (!entity) return;
    this.arraySnapshot = deepClone(entity);
    this.sceneManager.removeEntity(this.arrayId);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted || !this.arraySnapshot) return;
    this.sceneManager.addEntity(this.arraySnapshot);
  }

  redo(): void {
    this.sceneManager.removeEntity(this.arrayId);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return 'Delete array';
  }

  getAffectedEntityIds(): string[] {
    return [this.arrayId];
  }

  validate(): string | null {
    if (!this.arrayId) return 'Array entity ID is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        arrayId: this.arrayId,
        arraySnapshot: this.arraySnapshot,
      },
      version: 1,
    };
  }
}
