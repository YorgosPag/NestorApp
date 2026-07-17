/**
 * CREATE BLOCK FROM SELECTION COMMAND — ADR-652 M6 «Δημιουργία Block»
 *
 * AutoCAD `BLOCK`/`BMAKE` semantics: wraps N selected world-space entities into ONE first-class
 * {@link BlockEntity} instance (`type:'block'`) at the selection's base point, with full undo/redo.
 * The INSERT-flavour sibling of {@link CreateGroupCommand}: GROUP builds an identity container in
 * the SAME frame, BLOCK builds an INSERT-semantic container (members baked to BLOCK-LOCAL space +
 * placement transform), so the two share the exact same snapshot/remove/add lifecycle.
 *
 * Thin subclass of {@link ReplaceEntitiesWithContainerCommand}: the base owns the lifecycle; the
 * only specialisation is `buildContainer`, which derives the {@link InSessionBlockDef} from the
 * snapshots ({@link buildBlockDefFromSelection}) and assembles the instance from it via the SSoT
 * {@link buildBlockEntityFromDef} — the SAME builder the library-placement path uses (no second
 * BlockEntity shape). The created def is exposed via {@link getCreatedDef} so the caller can register
 * it in the in-session registry + persist it to the user library.
 *
 * WBLOCK (save-to-library WITHOUT replacing the drawing) does NOT use this command — the caller
 * builds the def directly and skips the scene mutation.
 *
 * @see systems/block/build-block-def-from-selection.ts (world selection → def, pure)
 * @see bim/block-library/place-block-from-library.ts (def → BlockEntity, shared)
 * @see core/commands/entity-commands/CreateGroupCommand.ts (the identity-flavour sibling)
 * @see ADR-575 §7: shared container-command base
 */

import type { ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import type { InSessionBlockDef } from '../../../bim/block-library/block-library-types';
import { buildBlockDefFromSelection } from '../../../systems/block/build-block-def-from-selection';
import { buildBlockEntityFromDef } from '../../../bim/block-library/place-block-from-library';
import { ReplaceEntitiesWithContainerCommand } from './ReplaceEntitiesWithContainerCommand';

export class CreateBlockFromSelectionCommand extends ReplaceEntitiesWithContainerCommand {
  readonly name = 'CreateBlockFromSelection';
  readonly type = 'create-block-from-selection';

  /** The def derived from the snapshots (built ONCE with the container) — for registry + library save. */
  private createdDef: InSessionBlockDef | null = null;

  constructor(
    memberEntityIds: readonly string[],
    private readonly blockName: string,
    sceneManager: ISceneManager,
  ) {
    super(memberEntityIds, sceneManager);
  }

  /**
   * Build the def + instance ONCE from the just-extracted snapshots (world space). Cached on
   * `this.container` by the base → redo re-adds the SAME id (stable). Returns `null` (abort +
   * restore sources) when the selection has no measurable geometry.
   */
  protected buildContainer(snapshots: Entity[]): SceneEntity | null {
    const built = buildBlockDefFromSelection(snapshots, this.blockName);
    if (!built) return null;
    this.createdDef = built.def;
    return buildBlockEntityFromDef(built.def, { position: built.base }) as unknown as SceneEntity;
  }

  /** The in-session def produced on execute (name + BLOCK-LOCAL members + bounds). Null before execute. */
  getCreatedDef(): InSessionBlockDef | null {
    return this.createdDef;
  }

  /** Id of the created block instance (for post-create reselect). Null before execute. */
  getCreatedEntityId(): string | null {
    return this.createdContainerId;
  }

  getDescription(): string {
    return `Create block "${this.blockName}" from ${this.snapshots.length} entities`;
  }

  validate(): string | null {
    if (!this.sourceEntityIds || this.sourceEntityIds.length < 1) {
      return 'At least 1 entity is required to create a block';
    }
    if (!this.blockName.trim()) {
      return 'Block name is required';
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
        blockName: this.blockName,
        blockEntity: this.container,
      },
      version: 1,
    };
  }
}
