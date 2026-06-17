/**
 * APPLY FOUNDATION-LAYOUT COMMAND — ADR-459 Phase 7 (Αυτόματος Σχεδιασμός Θεμελίωσης).
 *
 * ΕΝΑ undoable batch που εφαρμόζει το αποτέλεσμα του `reconcileFoundationLayout`:
 *   · **removes** — αφαιρεί auto πέδιλα που δεν αντιστοιχούν πλέον σε ομάδα.
 *   · **creates** — δημιουργεί τα νέα/ανα-διαστασιολογημένα πέδιλα στον όροφο
 *      **Θεμελίωσης** (cross-level writer), εδραιώνει τα FK των κολωνών
 *      (`AttachColumnFootingCommand`) και **πάντα** οπλίζει τον οργανισμό
 *      κολώνα+πέδιλο (`ReinforceColumnFootingCommand`) — χωρίς ερώτηση.
 *
 * Συνθέτει αποκλειστικά υπάρχοντα commands + τον cross-level writer (μηδέν νέα
 * μηχανική, N.0.2). Atomic: όλη η αυτόματη απόφαση είναι ΕΝΑ βήμα undo/redo.
 *
 * @see ../../../bim/foundations/auto-foundation-reconcile.ts — ο reconciler
 * @see ./AttachColumnFootingCommand.ts / ./ReinforceColumnFootingCommand.ts — συντίθενται
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — ο writer
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import { AttachColumnFootingCommand } from './AttachColumnFootingCommand';
import { ReinforceColumnFootingCommand } from './ReinforceColumnFootingCommand';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Ένα νέο πέδιλο προς δημιουργία + οι κολώνες που στηρίζει. */
export interface FoundationCreateStep {
  readonly footing: FoundationEntity;
  readonly columnIds: readonly string[];
}

/**
 * In-place ενημέρωση υπάρχοντος πεδίλου (ADR-459 Φ7 — Revit stable-identity):
 * `next` = ίδιο id, νέα γεωμετρία (rotation/resize/move)· `prev` = το υπάρχον entity
 * (για ακριβές undo — επαναφορά γεωμετρίας + παλιού οπλισμού).
 */
export interface FoundationUpdateStep {
  readonly prev: FoundationEntity;
  readonly next: FoundationEntity;
  readonly columnIds: readonly string[];
}

/** Internal: create step + τα συντιθέμενα commands (FK attach + reinforce). */
interface CompiledCreate {
  readonly footing: FoundationEntity;
  readonly attach: AttachColumnFootingCommand;
  readonly reinforce: ReinforceColumnFootingCommand;
  readonly combined: boolean;
}

/** Internal: update step + το συντιθέμενο reinforce (re-derive στη νέα γεωμετρία). */
interface CompiledUpdate {
  readonly prev: FoundationEntity;
  readonly next: FoundationEntity;
  readonly reinforce: ReinforceColumnFootingCommand;
}

export class ApplyFoundationLayoutCommand implements ICommand {
  readonly id: string;
  readonly name = 'ApplyFoundationLayout';
  readonly type = 'apply-foundation-layout';
  readonly timestamp: number;

  private readonly compiledCreates: CompiledCreate[];
  private readonly compiledUpdates: CompiledUpdate[];

  constructor(
    creates: readonly FoundationCreateStep[],
    updates: readonly FoundationUpdateStep[],
    private readonly removes: readonly FoundationEntity[],
    private readonly writer: FoundationCrossLevelWriter,
    sceneManager: ISceneManager,
    provider: StructuralCodeProvider,
  ) {
    this.compiledCreates = creates.map((c) => ({
      footing: c.footing,
      attach: new AttachColumnFootingCommand(c.footing.id, c.columnIds, sceneManager),
      reinforce: new ReinforceColumnFootingCommand(
        c.columnIds, c.footing, this.writer, sceneManager, provider,
      ),
      combined: c.columnIds.length > 1,
    }));
    // ADR-459 Φ7 — in-place updates: re-derive οπλισμού στη νέα γεωμετρία (mirror create).
    this.compiledUpdates = updates.map((u) => ({
      prev: u.prev,
      next: u.next,
      reinforce: new ReinforceColumnFootingCommand(
        u.columnIds, u.next, this.writer, sceneManager, provider,
      ),
    }));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    for (const f of this.removes) this.writer.remove(f.id);
    for (const c of this.compiledCreates) {
      this.writer.create(c.footing);
      c.attach.execute();
      c.reinforce.execute();
    }
    // In-place update: σταθερό id, νέα γεωμετρία + re-derive οπλισμού.
    for (const u of this.compiledUpdates) {
      this.writer.update(u.next);
      u.reinforce.execute();
    }
  }

  undo(): void {
    // Αντίστροφη σειρά: πρώτα τα updates (έτρεξαν τελευταία στο execute).
    for (let i = this.compiledUpdates.length - 1; i >= 0; i--) {
      const u = this.compiledUpdates[i];
      u.reinforce.undo();
      this.writer.update(u.prev); // πλήρης επαναφορά γεωμετρίας + παλιού οπλισμού
    }
    for (let i = this.compiledCreates.length - 1; i >= 0; i--) {
      const c = this.compiledCreates[i];
      c.reinforce.undo();
      c.attach.undo();
      this.writer.remove(c.footing.id);
    }
    for (const f of this.removes) this.writer.create(f);
  }

  redo(): void {
    for (const f of this.removes) this.writer.remove(f.id);
    for (const c of this.compiledCreates) {
      this.writer.create(c.footing);
      c.attach.redo();
      c.reinforce.redo();
    }
    for (const u of this.compiledUpdates) {
      this.writer.update(u.next);
      u.reinforce.redo();
    }
  }

  /** Πλήθος νέων πεδίλων (για info toast). */
  createdCount(): number {
    return this.compiledCreates.length;
  }

  /** Πλήθος combined πεδίλων (≥2 κολώνες) — για info toast. */
  combinedCount(): number {
    return this.compiledCreates.filter((c) => c.combined).length;
  }

  /** Πλήθος πεδίλων που ενημερώθηκαν in-place (rotation/resize follow) — για info toast. */
  updatedCount(): number {
    return this.compiledUpdates.length;
  }

  /** Πλήθος πεδίλων που αφαιρέθηκαν (re-derive) — για info toast. */
  removedCount(): number {
    return this.removes.length;
  }

  /** Όλα τα affected entity ids (κολώνες + νέα + αφαιρεθέντα πέδιλα). */
  attachedColumnIds(): string[] {
    return this.compiledCreates.flatMap((c) => c.attach.getAffectedEntityIds());
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Apply foundation layout: +${this.createdCount()} (combined ${this.combinedCount()}), ~${this.updatedCount()}, -${this.removedCount()}`;
  }

  getAffectedEntityIds(): string[] {
    return [
      ...this.compiledCreates.flatMap((c) => [c.footing.id, ...c.attach.getAffectedEntityIds()]),
      ...this.compiledUpdates.map((u) => u.next.id),
      ...this.removes.map((f) => f.id),
    ];
  }

  validate(): string | null {
    if (
      this.compiledCreates.length === 0 &&
      this.compiledUpdates.length === 0 &&
      this.removes.length === 0
    ) {
      return 'No-op foundation layout (nothing to create, update or remove)';
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
        createFootingIds: this.compiledCreates.map((c) => c.footing.id),
        updateFootingIds: this.compiledUpdates.map((u) => u.next.id),
        removeFootingIds: this.removes.map((f) => f.id),
      },
      version: 1,
    };
  }
}
