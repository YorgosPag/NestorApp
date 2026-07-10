/**
 * @module core/commands/entity-vertex-command
 * @description Family base for commands that edit a single vertex of a scene entity.
 *
 * `RemoveVertexCommand` and `MoveVertexCommand` share the same target surface
 * (an `entityId` + a `vertexIndex` + the `ISceneManager`) and therefore the same
 * `getAffectedEntityIds()` + `validate()`. This base owns those once; the move
 * variant layers drag-coalescing on top, the remove variant does not.
 *
 * @see ./base-command.ts (id/timestamp/serialize envelope)
 * @see ./vertex-command-validation.ts (validateEntityVertexTarget)
 */

import type { ISceneManager } from './interfaces';
import { BaseCommand } from './base-command';
import { validateEntityVertexTarget } from './vertex-command-validation';

/** Base for a single-vertex edit on a scene entity (`entityId` + `vertexIndex`). */
export abstract class EntityVertexCommand extends BaseCommand {
  constructor(
    protected readonly entityId: string,
    protected readonly vertexIndex: number,
    protected readonly sceneManager: ISceneManager,
  ) {
    super();
  }

  /** 🏢 ENTERPRISE: Get affected entity IDs. */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /** Validate the target: entity id present + non-negative index. */
  validate(): string | null {
    return validateEntityVertexTarget(this.entityId, this.vertexIndex);
  }
}
