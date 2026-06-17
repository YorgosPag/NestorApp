/**
 * CREATE COLUMN-FOOTING COMMAND — ADR-459 Phase 2 (proactive «βάλε πέδιλο»).
 *
 * ΕΝΑ undoable βήμα που: (α) δημιουργεί ένα pad πέδιλο στον όροφο **Θεμελίωσης**
 * (cross-level Firestore + scene write μέσω του `FoundationCrossLevelWriter`) και
 * (β) εδραιώνει το αναλυτικό FK `ColumnParams.footingId` της κολόνας (ενεργός
 * όροφος) — συνθέτοντας το υπάρχον `AttachColumnFootingCommand` (μηδέν duplicate FK
 * λογική, N.0.2).
 *
 * Γιατί ΟΧΙ `CreateFoundationsCommand`: εκείνο εκπέμπει `drawing:entity-created`
 * (tool='foundation') που ο single-level `useFoundationPersistence` πιάνει και
 * persist-άρει στο scope του **ενεργού** ορόφου → λάθος όροφος. Ο cross-level
 * writer γράφει απευθείας στο foundation scope.
 *
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — ο writer
 * @see ./AttachColumnFootingCommand.ts — το FK command που συνθέτουμε
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import { AttachColumnFootingCommand } from './AttachColumnFootingCommand';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class CreateColumnFootingCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateColumnFooting';
  readonly type = 'create-column-footing';
  readonly timestamp: number;

  /** Συντιθέμενο FK command (γεωμετρικά ουδέτερο, ενεργός όροφος). */
  private readonly attachFk: AttachColumnFootingCommand;

  constructor(
    private readonly footing: FoundationEntity,
    private readonly columnId: string,
    private readonly writer: FoundationCrossLevelWriter,
    sceneManager: ISceneManager,
  ) {
    this.attachFk = new AttachColumnFootingCommand(footing.id, [columnId], sceneManager);
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.writer.create(this.footing);
    this.attachFk.execute();
  }

  undo(): void {
    this.attachFk.undo();
    this.writer.remove(this.footing.id);
  }

  redo(): void {
    this.writer.create(this.footing);
    this.attachFk.redo();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create footing ${this.footing.id} for column ${this.columnId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.footing.id, this.columnId];
  }

  validate(): string | null {
    if (!this.footing.id) return 'Footing entity id is required';
    if (!this.columnId) return 'Column id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { footingId: this.footing.id, columnId: this.columnId },
      version: 1,
    };
  }
}
