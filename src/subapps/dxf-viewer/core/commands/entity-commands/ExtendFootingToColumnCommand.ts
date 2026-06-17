/**
 * EXTEND FOOTING-TO-COLUMN COMMAND — ADR-459 Phase 3 (combined footing).
 *
 * ΕΝΑ undoable βήμα που: (α) επεκτείνει ένα υπάρχον pad πέδιλο στον όροφο
 * **Θεμελίωσης** ώστε να καλύψει και 2η κολόνα (cross-level update params μέσω του
 * `FoundationCrossLevelWriter`) και (β) εδραιώνει το αναλυτικό FK της 2ης κολόνας
 * (συνθέτοντας το `AttachColumnFootingCommand` — μηδέν duplicate, N.0.2). Έτσι 2
 * κολόνες + 1 πέδιλο γίνονται ένας στατικός οργανισμός.
 *
 * @see ../../../bim/foundations/pad-extend.ts — buildExtendedPadParams
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — ο writer
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 3
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import { AttachColumnFootingCommand } from './AttachColumnFootingCommand';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class ExtendFootingToColumnCommand implements ICommand {
  readonly id: string;
  readonly name = 'ExtendFootingToColumn';
  readonly type = 'extend-footing-to-column';
  readonly timestamp: number;

  private readonly attachFk: AttachColumnFootingCommand;

  constructor(
    private readonly prevFooting: FoundationEntity,
    private readonly nextFooting: FoundationEntity,
    private readonly columnId: string,
    private readonly writer: FoundationCrossLevelWriter,
    sceneManager: ISceneManager,
  ) {
    this.attachFk = new AttachColumnFootingCommand(nextFooting.id, [columnId], sceneManager);
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.writer.update(this.nextFooting);
    this.attachFk.execute();
  }

  undo(): void {
    this.attachFk.undo();
    this.writer.update(this.prevFooting);
  }

  redo(): void {
    this.writer.update(this.nextFooting);
    this.attachFk.redo();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Extend footing ${this.nextFooting.id} to column ${this.columnId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.nextFooting.id, this.columnId];
  }

  validate(): string | null {
    if (!this.nextFooting.id) return 'Footing entity id is required';
    if (!this.columnId) return 'Column id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { footingId: this.nextFooting.id, columnId: this.columnId },
      version: 1,
    };
  }
}
