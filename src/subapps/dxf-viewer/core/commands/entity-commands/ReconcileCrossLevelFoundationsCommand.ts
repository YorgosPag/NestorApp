/**
 * RECONCILE CROSS-LEVEL FOUNDATIONS COMMAND — ADR-484 Slice 6.
 *
 * ΕΝΑ undoable batch για το managed reconcile της εσχάρας πεδίλων (create + delete +
 * update) ΟΤΑΝ τα πέδιλα ζουν στον όροφο **Θεμελίωσης** ενώ ο ενεργός όροφος είναι
 * άλλος (Revit-canonical level assignment). Ο single-level grid commit
 * (`commitFoundationGridFromGuides`) χρησιμοποιεί `LevelSceneManagerAdapter` +
 * `CreateFoundationsCommand`, που persist-άρει μέσω `drawing:entity-created` →
 * `useFoundationPersistence` στο **active-floor scope** → τα strips κολλούσαν στον λάθος
 * (ενεργό) όροφο. Αυτή η command δρομολογεί όλο το reconcile delta μέσω του
 * `FoundationCrossLevelWriter` (Firestore foundation scope + foundation scene όταν
 * loaded + `foundation-level-store`) — ίδιο SSoT routing με τα manual πέδιλα
 * (`add-foundation-to-scene`).
 *
 * Συνθέτει αποκλειστικά τον writer (μηδέν νέα persistence μηχανική) — mirror του
 * `DeleteCrossLevelFootingsCommand`. Atomic: 1 βήμα undo/redo για ΟΛΗ την εσχάρα.
 *
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — create/remove/update
 * @see ./DeleteCrossLevelFootingsCommand.ts — cross-level command precedent
 * @see ./CreateFoundationsCommand.ts — single-level (active) grid batch
 * @see docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md §Slice 6
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';

/**
 * In-place update ενός strip (coordinate-follow / rehost / re-justify / junction-miter):
 * `original` = προ-εφαρμογής (για undo), `rehosted` = μετά (για apply). Structurally
 * συμβατό με το `RehostedStrip` του grid reconcile.
 */
export interface CrossLevelFoundationUpdate {
  readonly original: FoundationEntity;
  readonly rehosted: FoundationEntity;
}

export class ReconcileCrossLevelFoundationsCommand implements ICommand {
  readonly id: string;
  readonly name = 'ReconcileCrossLevelFoundations';
  readonly type = 'reconcile-cross-level-foundations';
  readonly timestamp: number;

  private readonly toCreate: readonly FoundationEntity[];
  private readonly toDelete: readonly FoundationEntity[];
  private readonly updates: readonly CrossLevelFoundationUpdate[];
  private wasExecuted = false;

  constructor(
    toCreate: readonly FoundationEntity[],
    toDelete: readonly FoundationEntity[],
    updates: readonly CrossLevelFoundationUpdate[],
    private readonly writer: FoundationCrossLevelWriter,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.toCreate = toCreate.map((f) => deepClone(f));
    this.toDelete = toDelete.map((f) => deepClone(f));
    this.updates = updates.map((u) => ({ original: deepClone(u.original), rehosted: deepClone(u.rehosted) }));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyForward();
    this.wasExecuted = true;
  }

  redo(): void {
    this.applyForward();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    // Αντίστροφη σειρά: ξαναδημιούργησε τα deleted, επανέφερε τα originals των updates,
    // αφαίρεσε τα created.
    for (const u of this.updates) this.writer.update(u.original);
    for (const f of this.toDelete) this.writer.create(f);
    for (const f of this.toCreate) this.writer.remove(f.id);
  }

  /** Forward (execute / redo): updates → deletes → creates (mirror buildReconcileCommand). */
  private applyForward(): void {
    for (const u of this.updates) this.writer.update(u.rehosted);
    for (const f of this.toDelete) this.writer.remove(f.id);
    for (const f of this.toCreate) this.writer.create(f);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Reconcile cross-level foundation grid (+${this.toCreate.length} −${this.toDelete.length} ~${this.updates.length})`;
  }

  getAffectedEntityIds(): string[] {
    return [
      ...this.toCreate.map((f) => f.id),
      ...this.toDelete.map((f) => f.id),
      ...this.updates.map((u) => u.rehosted.id),
    ];
  }

  validate(): string | null {
    if (this.toCreate.length === 0 && this.toDelete.length === 0 && this.updates.length === 0) {
      return 'At least one create / delete / update is required';
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
        createIds: this.toCreate.map((f) => f.id),
        deleteIds: this.toDelete.map((f) => f.id),
        updateIds: this.updates.map((u) => u.rehosted.id),
      },
      version: 1,
    };
  }
}
