/**
 * CREATE GROUP COMMAND — ADR-575 «Ομαδοποίηση»
 *
 * Wraps N selected entities into ONE composite GROUP container (`type:'group'`)
 * with full undo/redo. The container-flavour inverse of «Διάλυση» (EXPLODE) and
 * the structural mirror of {@link JoinEntityCommand} (JOIN builds a merged
 * polyline, GROUP builds a block container — same snapshot/remove/add lifecycle).
 *
 * Thin subclass of {@link ReplaceEntitiesWithContainerCommand}: the base owns the
 * lifecycle; GROUP's only specialisation is that `buildContainer` produces the
 * container from the snapshots via {@link createGroupEntity} (built once, reused
 * on redo → stable id), plus the ≥2-members floor.
 *
 * UNGROUP is EXPLODE of the container (see systems/explode/explode-entity.ts),
 * so it needs no command of its own.
 *
 * @see systems/group/group-entity.ts (pure GROUP/UNGROUP SSoT)
 * @see core/commands/entity-commands/ExplodeEntityCommand.ts (the forward direction)
 * @see ADR-575 §7: shared container-command base
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { createGroupEntity, GROUP_MIN_MEMBERS } from '../../../systems/group/group-entity';
import { ReplaceEntitiesWithContainerCommand } from './ReplaceEntitiesWithContainerCommand';

export class CreateGroupCommand extends ReplaceEntitiesWithContainerCommand {
  readonly name = 'CreateGroup';
  readonly type = 'create-group';

  constructor(memberEntityIds: readonly string[], sceneManager: ISceneManager) {
    super(memberEntityIds, sceneManager);
  }

  protected get minMembers(): number {
    return GROUP_MIN_MEMBERS;
  }

  /** Build the container ONCE from the snapshots so redo re-adds the same id. */
  protected buildContainer(snapshots: Entity[]): SceneEntity | null {
    return createGroupEntity(snapshots) as unknown as SceneEntity;
  }

  /** Id of the created container (for post-group reselect). */
  getCreatedEntityId(): string | null {
    return this.createdContainerId;
  }

  getDescription(): string {
    return `Group ${this.snapshots.length} entities → block`;
  }

  validate(): string | null {
    if (!this.sourceEntityIds || this.sourceEntityIds.length < GROUP_MIN_MEMBERS) {
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
        memberEntityIds: [...this.sourceEntityIds],
        memberSnapshots: this.snapshots,
        groupEntity: this.container,
      },
      version: 1,
    };
  }
}
