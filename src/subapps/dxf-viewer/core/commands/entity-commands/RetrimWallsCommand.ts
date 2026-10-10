/**
 * RETRIM WALLS COMMAND — ADR-911 Φ2 (undoable neighbour-join patch).
 *
 * Όταν γράφονται νέοι τοίχοι, οι ΥΠΑΡΧΟΝΤΕΣ γείτονες αλλάζουν ένωση (miter/bevel). Αυτή η
 * εντολή είναι το **αναιρέσιμο** μισό εκείνης της αλλαγής: φέρει προϋπολογισμένα `{prev, next}`
 * params ανά γείτονα και τα γράφει συμμετρικά (execute/redo → `next`, undo → `prev`), ώστε το
 * Ctrl+Z μιας εγγραφής τοίχων να επαναφέρει ΚΑΙ τους γείτονες — χωρίς να βασίζεται σε παρενέργεια
 * του persistence hook. Ζει πάντα μέσα στην ίδια ατομική ομάδα με το `CreateWallsCommand`.
 *
 * ΔΕΝ υπολογίζει ενώσεις: ο υπολογισμός γίνεται ΜΙΑ φορά στο `addWallsToScene` (ένα πέρασμα
 * `computeWallTrims`) και εδώ φτάνει μόνο το αποτέλεσμα. Thin leaf πάνω στο
 * {@link BatchEntityPatchCommand} (ADR-617).
 *
 * Persistence: κάθε εφαρμογή εκπέμπει `drawing:entity-created` με `origin:'retrim'` ανά
 * γείτονα (το ίδιο σήμα που εξέπεμπε ο `addWallToScene`) — re-save, όχι νέα οντότητα.
 *
 * @see ../../../bim/walls/add-wall-to-scene.ts — ο μοναδικός παραγωγός των entries
 * @see ./batch-entity-patch-command.ts — το κοινό lifecycle
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import type { WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { emitBimEntityCreated } from '../../../systems/events/bim-entity-lifecycle-events';
import { BatchEntityPatchCommand, type BatchPatchEntry } from './batch-entity-patch-command';

/** Η αλλαγή ένωσης ενός υπάρχοντος τοίχου: params πριν και μετά + το kind για τη γεωμετρία. */
export interface WallRetrimEntry extends BatchPatchEntry<WallParams> {
  readonly kind: WallKind;
}

export class RetrimWallsCommand extends BatchEntityPatchCommand<WallParams, WallRetrimEntry> {
  readonly name = 'RetrimWalls';
  readonly type = 'retrim-walls';

  constructor(
    private readonly entries: readonly WallRetrimEntry[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): WallRetrimEntry[] {
    return [...this.entries];
  }

  protected applyState(entry: WallRetrimEntry, state: WallParams): void {
    this.sceneManager.updateEntity(entry.entityId, {
      params: state,
      geometry: computeWallGeometry(state, entry.kind),
    } as unknown as Partial<SceneEntity>);
  }

  /** Re-save των γειτόνων με τα params που μόλις γράφτηκαν (διαβασμένα από τη σκηνή). */
  protected afterApply(): void {
    for (const entry of this.entries) {
      const entity = this.sceneManager.getEntity(entry.entityId);
      if (entity) emitBimEntityCreated(entity as unknown as AnySceneEntity, 'wall', 'retrim');
    }
  }

  getDescription(): string {
    return `Retrim ${this.entries.length} walls`;
  }

  getAffectedEntityIds(): string[] {
    return this.entries.map((e) => e.entityId);
  }

  validate(): string | null {
    return this.entries.length === 0 ? 'At least one wall is required' : null;
  }

  protected serializeData(): Record<string, unknown> {
    return { wallIds: this.getAffectedEntityIds() };
  }
}
