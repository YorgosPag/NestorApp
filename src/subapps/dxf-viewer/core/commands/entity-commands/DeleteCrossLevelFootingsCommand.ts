/**
 * DELETE CROSS-LEVEL FOOTINGS COMMAND — ADR-459 Phase 7.
 *
 * ΕΝΑ undoable batch για διαγραφή πεδίλων που ζουν στον όροφο **Θεμελίωσης** ενώ ο
 * ενεργός όροφος είναι άλλος (π.χ. επιλογή πεδίλου στο 3Δ + Delete). Ο γενικός
 * `useSmartDelete` ψάχνει το entity μόνο στον ενεργό όροφο → δεν το βρίσκει → silent
 * fail. Αυτή η command το διαγράφει cross-level μέσω του `FoundationCrossLevelWriter`
 * (foundation scene + Firestore + foundation-level-store) και **αποσυνδέει** τα FK
 * των κολωνών που στηρίζονταν σε αυτό (`DetachColumnFootingCommand`) — ώστε ο
 * στατικός οργανισμός να επανέλθει σωστά («λείπει το πέδιλο» / spatial fallback).
 *
 * Συνθέτει αποκλειστικά υπάρχοντα (writer + DetachColumnFootingCommand· μηδέν νέα
 * μηχανική). Atomic: 1 βήμα undo/redo.
 *
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — create/remove
 * @see ./DetachColumnFootingCommand.ts — clear column FK
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import { DetachColumnFootingCommand } from './DetachColumnFootingCommand';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class DeleteCrossLevelFootingsCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteCrossLevelFootings';
  readonly type = 'delete-cross-level-footings';
  readonly timestamp: number;

  /** Detach των στηριζόμενων κολωνών (active όροφος)· null όταν καμία. */
  private readonly detach: DetachColumnFootingCommand | null;

  constructor(
    private readonly footings: readonly FoundationEntity[],
    columnIds: readonly string[],
    private readonly writer: FoundationCrossLevelWriter,
    activeSceneManager: ISceneManager,
  ) {
    this.detach = columnIds.length > 0 ? new DetachColumnFootingCommand(columnIds, activeSceneManager) : null;
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.detach?.execute();
    for (const f of this.footings) this.writer.remove(f.id);
  }

  undo(): void {
    for (const f of this.footings) this.writer.create(f);
    this.detach?.undo();
  }

  redo(): void {
    this.detach?.redo();
    for (const f of this.footings) this.writer.remove(f.id);
  }

  /** Πλήθος πεδίλων που διαγράφηκαν — για toast/feedback. */
  removedCount(): number {
    return this.footings.length;
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Delete ${this.footings.length} cross-level footing(s)`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.footings.map((f) => f.id), ...(this.detach?.getAffectedEntityIds() ?? [])];
  }

  validate(): string | null {
    if (this.footings.length === 0) return 'At least one footing is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { footingIds: this.footings.map((f) => f.id) },
      version: 1,
    };
  }
}
