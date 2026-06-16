/**
 * PASTE ENTITIES COMMAND — ADR-466 (Cross-Floor Entity Clipboard)
 *
 * Adds pre-built clones (captured from the clipboard, re-id'd via the clone SSoT)
 * to the CURRENT level's scene as one undoable step. Unlike `BimCopyCommand` —
 * which rebuilds clones from the LIVE scene by id — this command receives FROZEN
 * clones, because the sources were copied on a different floor and are no longer
 * in the active scene.
 *
 * Persistence split:
 *   - **BIM clones** carry their own Firestore docs → execute/redo broadcast
 *     `drawing:entity-created` / restore and undo broadcasts delete, exactly like
 *     `BimCopyCommand` (ADR-363 §7.2 — else the persistence subscription drops a
 *     scene entity it has no doc for: "paste flashes then vanishes").
 *   - **DXF clones** live inside `scene.entities` → persisted by the scene
 *     autosave (ADR-420) on `addEntity`; no per-entity broadcast needed.
 *
 * @see bim/transforms/bim-copy-builder.ts — clone SSoT (buildClonesFromEntities)
 * @see core/commands/entity-commands/BimCopyCommand.ts — in-floor analog
 */
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  broadcastBimCloneCreated,
  broadcastBimCloneDeleted,
  broadcastBimCloneRestored,
} from '../../../bim/transforms/bim-clone-persistence';

export class PasteEntitiesCommand implements ICommand {
  readonly id: string;
  readonly name = 'PasteEntities';
  readonly type = 'paste-entities';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    /** Clones whose Firestore docs need the create/delete/restore broadcasts. */
    private readonly bimClones: readonly SceneEntity[],
    /** Raw DXF clones — persisted by scene autosave, no broadcast. */
    private readonly dxfClones: readonly SceneEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  private allClones(): readonly SceneEntity[] {
    return [...this.bimClones, ...this.dxfClones];
  }

  execute(): void {
    for (const clone of this.allClones()) this.sceneManager.addEntity(clone);
    // ADR-363 §7.2 — first Firestore save for BIM clones (else snapshot drops them).
    for (const clone of this.bimClones) broadcastBimCloneCreated(clone);
    this.wasExecuted = this.allClones().length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const clone of this.allClones()) this.sceneManager.removeEntity(clone.id);
    for (const clone of this.bimClones) broadcastBimCloneDeleted(clone);
  }

  redo(): void {
    for (const clone of this.allClones()) this.sceneManager.addEntity(clone);
    for (const clone of this.bimClones) broadcastBimCloneRestored(clone);
  }

  getDescription(): string {
    const n = this.allClones().length;
    return n === 1 ? 'Paste entity' : `Paste ${n} entities`;
  }

  getAffectedEntityIds(): string[] {
    return this.allClones().map((c) => c.id);
  }

  validate(): string | null {
    if (this.allClones().length === 0) return 'Clipboard is empty';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        bimCloneIds: this.bimClones.map((c) => c.id),
        dxfCloneIds: this.dxfClones.map((c) => c.id),
      },
      version: 1,
    };
  }
}
