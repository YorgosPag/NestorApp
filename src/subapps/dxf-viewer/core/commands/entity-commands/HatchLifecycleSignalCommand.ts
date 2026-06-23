/**
 * HATCH LIFECYCLE SIGNAL COMMAND — ADR-507 / ADR-390.
 *
 * Η γραμμοσκίαση είναι FLAT DXF primitive· δημιουργείται μέσω του γενικού
 * `completeEntity` → `CreateEntityCommand` pipeline (ΟΧΙ `CreateBimEntityCommand`),
 * άρα το create command της ΔΕΝ εκπέμπει lifecycle events. Χωρίς αυτά:
 *   · undo-of-create  → το Firestore doc μένει ορφανό (το subscribe-loop το
 *     ξανα-ενυδατώνει → η γραμμοσκίαση «ξαναζωντανεύει»),
 *   · redo-of-create  → το doc δεν ξαναγράφεται ποτέ.
 *
 * Αυτό το zero-scene-effect αδελφό-command ταξιδεύει ΜΕΣΑ στο ΙΔΙΟ `CompoundCommand`
 * με το create + send-to-back (δες `buildHatchPostCreateCommands`). ΠΡΕΠΕΙ να είναι
 * το ΤΕΛΕΥΤΑΙΟ child ώστε:
 *   · στο undo (αντίστροφη σειρά) να τρέχει ΟΣΟ το entity είναι ακόμη στη σκηνή,
 *   · στο redo (forward `execute`) να τρέχει ΑΦΟΥ το entity ξαναμπεί.
 *
 * Triptych (mirror του `CreateBimEntityCommand.deferEvents`, αποσυνδεδεμένο όμως
 * από τον γενικό `CreateEntityCommand` ώστε τα άλλα drawing tools να μένουν άθικτα):
 *   · 1ο execute  → NO-OP (το first-save το κάνει ήδη το `drawing:complete`)
 *   · undo        → `emitBimEntityDeleteRequested('hatch', id)` → `bim:hatch-delete-requested`
 *                   → το `useHatchPersistence` σβήνει το doc + tombstone (μηδέν zombie)
 *   · redo execute→ `bim:entity-restore-requested {entityType:'hatch', source:'redo-restore'}`
 *                   → το `useBimEntityRestoredPersistEffect('hatch')` ξαναγράφει το doc (ίδιο id)
 *
 * Reuse του ADR-390 event SSoT — κανένας νέος persistence μηχανισμός.
 *
 * @see ./CreateBimEntityCommand.ts — το BIM-entity ισοδύναμο (ένα command)
 * @see ../../../systems/events/bim-entity-lifecycle-events.ts — delete-event SSoT
 * @see ../../../hooks/data/useHatchPersistence.ts — η πλευρά του listener
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  emitBimEntityDeleteRequested,
  emitBimEntityRestoreRequested,
} from '../../../systems/events/bim-entity-lifecycle-events';
import { isHatchEntity } from '../../../types/entities';
import type { AnySceneEntity } from '../../../types/scene';

export class HatchLifecycleSignalCommand implements ICommand {
  readonly id: string;
  readonly name = 'HatchLifecycleSignal';
  readonly type = 'hatch-lifecycle-signal';
  readonly timestamp: number;

  /** Διακρίνει το ΠΡΩΤΟ execute (no-op) από το redo-execute (CompoundCommand.redo → execute). */
  private hasExecutedOnce = false;

  constructor(
    private readonly entityId: string,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /** 1ο execute = no-op (first-save μέσω `drawing:complete`)· redo-execute = restore. */
  execute(): void {
    if (!this.hasExecutedOnce) {
      this.hasExecutedOnce = true;
      return;
    }
    this.emitRestore();
  }

  /** undo-of-create → σβήσε το doc + tombstone (κανένα zombie). */
  undo(): void {
    emitBimEntityDeleteRequested('hatch', this.entityId);
  }

  /** Το redo περνά μέσω `CompoundCommand.redo → execute()`· standalone redo = mirror. */
  redo(): void {
    this.emitRestore();
  }

  private emitRestore(): void {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as AnySceneEntity | undefined;
    if (!entity || !isHatchEntity(entity)) return;
    emitBimEntityRestoreRequested('hatch', entity, 'redo-restore');
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return 'Hatch lifecycle signal';
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    return this.entityId ? null : 'Entity id is required';
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.entityId },
      version: 1,
    };
  }
}
