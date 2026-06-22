/**
 * UPDATE HATCH ORIGIN COMMAND — ADR-507 Φ5 (A3 gradient origin/seed).
 *
 * Patches `patternOrigin` on an existing `HatchEntity` — το «κέντρο» (seed) από
 * το οποίο ξεκινά το gradient γέμισμα (reuse του υπάρχοντος hatch-origin πεδίου,
 * όπως το AutoCAD μοιράζεται το hatch origin μεταξύ pattern ΚΑΙ gradient). Flat
 * primitive → κανένα derived geometry· γράφει μόνο το νέο σημείο.
 *
 * Merge/undo/redo skeleton από `MergeableUpdateCommand` (ADR-507 §8) — συνεχόμενα
 * grip-drag samples του origin συμπτύσσονται σε ΕΝΑ undo entry μέσα στο merge
 * window. Mirror του `UpdateHatchBoundaryCommand` (ίδιο flat-primitive pattern).
 * `useHatchPersistence` εντοπίζει το patched `patternOrigin` (στο HATCH_SCALAR_KEYS
 * diff) και κάνει auto-save.
 *
 * @see core/commands/entity-commands/UpdateHatchBoundaryCommand.ts — αδελφό
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateHatchOriginCommand extends MergeableUpdateCommand<Point2D> {
  readonly name = 'UpdateHatchOrigin';
  readonly type = 'update-hatch-origin';

  constructor(
    hatchId: string,
    patternOrigin: Point2D,
    previousPatternOrigin: Point2D,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(hatchId, patternOrigin, previousPatternOrigin, sceneManager, isDragging);
  }

  protected applyPatch(patternOrigin: Point2D): void {
    this.sceneManager.updateEntity(this.entityId, {
      patternOrigin,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: Point2D): UpdateHatchOriginCommand {
    return new UpdateHatchOriginCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return 'Update gradient origin';
  }

  validate(): string | null {
    if (!this.entityId) return 'Hatch entity ID is required';
    if (!this.patch || !Number.isFinite(this.patch.x) || !Number.isFinite(this.patch.y)) {
      return 'patternOrigin must be a finite point';
    }
    return null;
  }
}
