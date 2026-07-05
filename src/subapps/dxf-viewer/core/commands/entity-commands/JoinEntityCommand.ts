/**
 * JOIN ENTITY COMMAND
 *
 * Joins multiple entities into one merged entity with full undo/redo. Follows
 * AutoCAD JOIN semantics — result type depends on input geometry. The container
 * (the merged entity) is built UP-FRONT by EntityMergeService and handed in.
 *
 * Thin subclass of {@link ReplaceEntitiesWithContainerCommand}: it owns the
 * snapshot→remove→add→undo→redo lifecycle (shared with GROUP). JOIN's only
 * specialisation is that `buildContainer` returns the pre-built merged entity.
 *
 * @see ADR-161: Entity Join System
 * @see ADR-032: Command History / Undo-Redo
 * @see ADR-575 §7: shared container-command base
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';
import { ReplaceEntitiesWithContainerCommand } from './ReplaceEntitiesWithContainerCommand';

export class JoinEntityCommand extends ReplaceEntitiesWithContainerCommand {
  readonly name = 'JoinEntities';
  readonly type = 'join-entities';

  constructor(
    /** IDs of entities to be joined */
    sourceEntityIds: string[],
    /** The pre-built merged entity (built by EntityMergeService) */
    mergedEntity: SceneEntity,
    sceneManager: ISceneManager,
  ) {
    super(sourceEntityIds, sceneManager);
    // JOIN's container is known from the start — pre-set it so its id is stable
    // and reported by getAffectedEntityIds() even before execute().
    this.container = deepClone(mergedEntity) as SceneEntity;
  }

  /** JOIN hands in a ready container — ignore the snapshots. */
  protected buildContainer(): SceneEntity | null {
    return this.container;
  }

  getDescription(): string {
    return `Join ${this.snapshots.length} entities → ${this.container?.type ?? 'entity'}`;
  }

  validate(): string | null {
    if (!this.sourceEntityIds || this.sourceEntityIds.length < 2) {
      return 'At least 2 entity IDs are required for join';
    }
    if (!this.container) {
      return 'Merged entity is required';
    }
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        sourceEntityIds: [...this.sourceEntityIds],
        mergedEntity: this.container,
        originalSnapshots: this.snapshots,
      },
      version: 1,
    };
  }
}
