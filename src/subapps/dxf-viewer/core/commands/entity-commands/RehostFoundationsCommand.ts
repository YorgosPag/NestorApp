/**
 * REHOST FOUNDATIONS COMMAND — ADR-441 Slice 6b (migration legacy ορφανών).
 *
 * Batch-attaches N legacy ορφανούς πεδιλοδοκούς στον τρέχοντα κάναβο σε ΕΝΑ
 * undoable βήμα: κάθε ορφανός αποκτά τα `guideBindings` + snapped `params/geometry`
 * του φατνώματος με το οποίο ευθυγραμμίζεται (υπολογισμένα pure από
 * `rehostOrphanStrips`), κρατώντας το **id** του + τη διατομή του. Μετά από αυτό
 * αρχίζει να ακολουθεί τη μετακίνηση των αξόνων (Slice 3 follow-on-move).
 *
 * Δεν δημιουργεί/διαγράφει entities — μόνο **mutate** υπαρχόντων (bindings+geometry)
 * → χρησιμοποιεί `updateEntity` (shallow-merge), inverse = revert στα original πεδία.
 *
 * Persistence-correct (ADR-436/401): forward & undo εκπέμπουν `bim:entities-attached`
 * (το ίδιο «binding changed» persist path με auto-attach) → `useFoundationPersistence`
 * persist-άρει params/geometry/guideBindings. Side-effects deferred σε microtask ώστε
 * να τρέχουν μετά το synchronous dispatch — mirror `DeleteFoundationsCommand`.
 *
 * @see ../../../bim/foundations/foundation-grid-rehost.ts — pure matcher (RehostedStrip)
 * @see ../../../hooks/data/useFoundationPersistence.ts — bim:entities-attached listener
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { AnySceneEntity } from '../../../types/scene';
import type { RehostedStrip } from '../../../bim/foundations/foundation-grid-rehost';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';

/** Τα πεδία που αλλάζει το re-host (shallow-merge στο scene entity). */
function rehostPatch(f: FoundationEntity): Partial<FoundationEntity> {
  return { params: f.params, geometry: f.geometry, guideBindings: f.guideBindings };
}

export class RehostFoundationsCommand implements ICommand {
  readonly id: string;
  readonly name = 'RehostFoundations';
  readonly type = 'rehost-foundations';
  readonly timestamp: number;

  private readonly rehosts: readonly RehostedStrip[];
  private wasExecuted = false;

  constructor(
    rehosts: readonly RehostedStrip[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: σταθερά snapshots forward/undo, ανεξάρτητα live edits.
    this.rehosts = rehosts.map((r) => ({
      original: deepClone(r.original),
      rehosted: deepClone(r.rehosted),
    }));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.apply('rehosted');
    this.wasExecuted = true;
    this.deferPersist('rehosted');
  }

  redo(): void {
    this.apply('rehosted');
    this.deferPersist('rehosted');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.apply('original');
    this.deferPersist('original');
  }

  /** scene: merge bindings+params+geometry της επιλεγμένης εκδοχής σε κάθε entity. */
  private apply(which: 'rehosted' | 'original'): void {
    for (const r of this.rehosts) {
      const f = r[which];
      this.sceneManager.updateEntity(f.id, rehostPatch(f));
    }
  }

  /** Firestore side-effect (deferred microtask): re-persist μέσω attach path. */
  private deferPersist(which: 'rehosted' | 'original'): void {
    const entities = this.rehosts.map((r) => deepClone(r[which]) as unknown as AnySceneEntity);
    queueMicrotask(() => EventBus.emit('bim:entities-attached', { entities }));
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Re-host ${this.rehosts.length} foundation strips`;
  }

  getAffectedEntityIds(): string[] {
    return this.rehosts.map((r) => r.rehosted.id);
  }

  validate(): string | null {
    if (this.rehosts.length === 0) return 'At least one foundation is required';
    if (this.rehosts.some((r) => !r.rehosted.id)) return 'Every foundation must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { foundationIds: this.rehosts.map((r) => r.rehosted.id) },
      version: 1,
    };
  }
}
