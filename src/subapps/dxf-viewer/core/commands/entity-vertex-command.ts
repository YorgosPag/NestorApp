/**
 * @module core/commands/entity-vertex-command
 * @description Family base for commands that edit a single vertex of a scene entity.
 *
 * `AddVertexCommand`, `RemoveVertexCommand` and `MoveVertexCommand` share the same
 * target surface (an `entityId` + a `vertexIndex` + the `ISceneManager`) and therefore
 * the same `getAffectedEntityIds()` + `validate()` + associative reconcile. This base
 * owns those once; the move variant layers drag-coalescing on top, the others do not.
 *
 * @see ./base-command.ts (id/timestamp/serialize envelope)
 * @see ./vertex-command-validation.ts (validateEntityVertexTarget)
 * @see ../../bim/cascade/associative-geometry-reconcile (ADR-540 universal cascade)
 */

import type { ISceneManager } from './interfaces';
import { BaseCommand } from './base-command';
import { validateEntityVertexTarget } from './vertex-command-validation';
import { reconcileAssociativeGeometry } from '../../bim/cascade/associative-geometry-reconcile';

/** Base for a single-vertex edit on a scene entity (`entityId` + `vertexIndex`). */
export abstract class EntityVertexCommand extends BaseCommand {
  constructor(
    protected readonly entityId: string,
    protected readonly vertexIndex: number,
    protected readonly sceneManager: ISceneManager,
  ) {
    super();
  }

  /** 🏢 ENTERPRISE: Get affected entity IDs. */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /** Validate the target: entity id present + non-negative index. */
  validate(): string | null {
    return validateEntityVertexTarget(this.entityId, this.vertexIndex);
  }

  /**
   * ADR-540 / ADR-718 Μ3 — τα scene-derived εξαρτημένα, **αφού** η κορυφή έχει κάτσει στη
   * σκηνή. Προσθήκη/αφαίρεση κορυφής αλλάζει το ΣΧΗΜΑ μιας πολυγραμμής όσο και ένα σύρσιμο
   * λαβής· ένα όριο οικοπέδου ή μια ασυνέχεια που κρέμεται από αυτήν πρέπει να ακολουθήσει
   * το ίδιο. Καλείται από execute / undo / redo — οι reconcilers είναι scene-derived
   * (ξαναδιαβάζουν, δεν ακολουθούν delta), άρα καμία αντίστροφη διαδρομή.
   */
  protected reconcileDependents(): void {
    reconcileAssociativeGeometry(this.getAffectedEntityIds(), this.sceneManager);
  }
}
