/**
 * JOIN ENTITY COMMAND
 *
 * Command for joining multiple entities into one with full undo/redo support.
 * Follows AutoCAD JOIN semantics — result type depends on input geometry.
 *
 * Pattern:
 * - execute(): Snapshot originals → remove originals → add merged entity
 * - undo(): Remove merged → restore originals
 * - redo(): Remove originals again → add merged
 *
 * @see ADR-161: Entity Join System
 * @see ADR-032: Command History / Undo-Redo
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
// N.12 SSoT — shared container extract/restore lifecycle (also used by CreateArrayCommand + CreateGroupCommand).
import { extractSourcesFromScene, restoreSourcesToScene } from './entity-source-extraction';

export class JoinEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'JoinEntities';
  readonly type = 'join-entities';
  readonly timestamp: number;

  /** Snapshots of original entities (for undo) */
  private originalSnapshots: SceneEntity[] = [];
  /** The merged entity produced by join */
  private mergedEntity: SceneEntity;
  private wasExecuted = false;

  constructor(
    /** IDs of entities to be joined */
    private readonly sourceEntityIds: string[],
    /** The pre-built merged entity (built by EntityMergeService) */
    mergedEntity: SceneEntity,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.mergedEntity = deepClone(mergedEntity);
  }

  /**
   * Execute: Snapshot originals → remove originals → add merged entity
   */
  execute(): void {
    // SSoT: snapshot sources (deep-clone, for undo) + remove originals from scene.
    const sources: Entity[] = [];
    for (const entityId of this.sourceEntityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) sources.push(entity as unknown as Entity);
    }
    this.originalSnapshots = extractSourcesFromScene(sources, this.sceneManager) as unknown as SceneEntity[];

    // Add merged entity
    this.sceneManager.addEntity(deepClone(this.mergedEntity));
    this.wasExecuted = true;
  }

  /**
   * Undo: Remove merged entity → restore originals
   */
  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.removeEntity(this.mergedEntity.id);
    restoreSourcesToScene(this.originalSnapshots as unknown as Entity[], this.sceneManager);
  }

  /**
   * Redo: Remove originals again → add merged
   */
  redo(): void {
    // Remove originals
    for (const snapshot of this.originalSnapshots) {
      this.sceneManager.removeEntity(snapshot.id);
    }

    // Re-add merged entity
    this.sceneManager.addEntity(deepClone(this.mergedEntity));
  }

  getDescription(): string {
    return `Join ${this.originalSnapshots.length} entities → ${this.mergedEntity.type}`;
  }

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        sourceEntityIds: this.sourceEntityIds,
        mergedEntity: this.mergedEntity,
        originalSnapshots: this.originalSnapshots,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [...this.sourceEntityIds, this.mergedEntity.id];
  }

  validate(): string | null {
    if (!this.sourceEntityIds || this.sourceEntityIds.length < 2) {
      return 'At least 2 entity IDs are required for join';
    }
    if (!this.mergedEntity) {
      return 'Merged entity is required';
    }
    return null;
  }
}
