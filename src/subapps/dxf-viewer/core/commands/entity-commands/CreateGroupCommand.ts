/**
 * CREATE GROUP COMMAND — ADR-575 «Ομαδοποίηση»
 *
 * Wraps N selected entities into ONE composite GROUP container (BlockEntity) with
 * full undo/redo. The container-flavour inverse of «Διάλυση» (EXPLODE); the exact
 * structural mirror of {@link JoinEntityCommand} (JOIN builds a merged polyline,
 * GROUP builds a block container — same snapshot/remove/add lifecycle).
 *
 * Pattern:
 * - execute(): snapshot members → build container (once) → remove members → add container
 * - undo():    remove container → restore members
 * - redo():    remove members again → re-add the SAME container (stable id)
 *
 * UNGROUP is EXPLODE of the container (see systems/explode/explode-entity.ts),
 * so it needs no command of its own.
 *
 * @see systems/group/group-entity.ts (pure GROUP/UNGROUP SSoT)
 * @see core/commands/entity-commands/ExplodeEntityCommand.ts (the forward direction)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { createGroupEntity, GROUP_MIN_MEMBERS } from '../../../systems/group/group-entity';

export class CreateGroupCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateGroup';
  readonly type = 'create-group';
  readonly timestamp: number;

  /** Snapshots of the original members (for undo). */
  private memberSnapshots: SceneEntity[] = [];
  /** The container produced by the group op — built once, reused on redo. */
  private groupEntity: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly memberEntityIds: readonly string[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.memberSnapshots = [];
    const members: Entity[] = [];
    for (const entityId of this.memberEntityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      this.memberSnapshots.push(deepClone(entity));
      members.push(entity as unknown as Entity);
    }
    if (members.length < GROUP_MIN_MEMBERS) return; // nothing to group — no-op

    // Build the container ONCE so redo re-adds the exact same entity (stable id).
    this.groupEntity = createGroupEntity(members) as unknown as SceneEntity;

    for (const entityId of this.memberEntityIds) this.sceneManager.removeEntity(entityId);
    this.sceneManager.addEntity(deepClone(this.groupEntity));
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted || !this.groupEntity) return;
    this.sceneManager.removeEntity(this.groupEntity.id);
    for (const snapshot of this.memberSnapshots) {
      this.sceneManager.addEntity(deepClone(snapshot));
    }
  }

  redo(): void {
    if (!this.groupEntity) return;
    for (const snapshot of this.memberSnapshots) this.sceneManager.removeEntity(snapshot.id);
    this.sceneManager.addEntity(deepClone(this.groupEntity));
  }

  /** Id of the created container (for post-group reselect). */
  getCreatedEntityId(): string | null {
    return this.groupEntity?.id ?? null;
  }

  getAffectedEntityIds(): string[] {
    return [...this.memberEntityIds, ...(this.groupEntity ? [this.groupEntity.id] : [])];
  }

  getDescription(): string {
    return `Group ${this.memberSnapshots.length} entities → block`;
  }

  canMergeWith(): boolean {
    return false;
  }

  validate(): string | null {
    if (!this.memberEntityIds || this.memberEntityIds.length < GROUP_MIN_MEMBERS) {
      return `At least ${GROUP_MIN_MEMBERS} entities are required to group`;
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
        memberEntityIds: [...this.memberEntityIds],
        memberSnapshots: this.memberSnapshots,
        groupEntity: this.groupEntity,
      },
      version: 1,
    };
  }
}
