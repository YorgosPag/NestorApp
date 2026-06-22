/**
 * UPDATE HATCH GRADIENT COMMAND — ADR-507 Φ5 (A4 gradient angle grip).
 *
 * Patches το nested `gradient` object μιας `HatchEntity` (ως σύνολο — immutable).
 * Χρησιμοποιείται από το gradient-angle grip-drag (`commitHatchGripDrag` → νέα
 * `gradient.angleDeg` μέσω του SSoT `withGradientPatch`), αλλά είναι generic: κάθε
 * gradient-property edit μπορεί να περάσει από εδώ.
 *
 * Merge/undo/redo skeleton από `MergeableUpdateCommand` (ADR-507 §8) — συνεχόμενα
 * grip-drag samples της γωνίας συμπτύσσονται σε ΕΝΑ undo entry μέσα στο merge
 * window. Mirror του `UpdateHatchOriginCommand` (ίδιο flat-primitive pattern, αλλά
 * το patch εδώ είναι ολόκληρο το `HatchGradient` αντί για `Point2D`). Το `gradient`
 * είναι στο `HATCH_SCALAR_KEYS` → `useHatchPersistence` το auto-save-άρει.
 *
 * @see core/commands/entity-commands/UpdateHatchOriginCommand.ts — αδελφό (A3)
 * @see bim/hatch/hatch-gradient-build.ts — `withGradientPatch` (immutable nested merge)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { HatchGradient } from '../../../bim/hatch/hatch-gradient';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateHatchGradientCommand extends MergeableUpdateCommand<HatchGradient> {
  readonly name = 'UpdateHatchGradient';
  readonly type = 'update-hatch-gradient';

  constructor(
    hatchId: string,
    gradient: HatchGradient,
    previousGradient: HatchGradient,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(hatchId, gradient, previousGradient, sceneManager, isDragging);
  }

  protected applyPatch(gradient: HatchGradient): void {
    this.sceneManager.updateEntity(this.entityId, {
      gradient,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: HatchGradient): UpdateHatchGradientCommand {
    return new UpdateHatchGradientCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return 'Update gradient angle';
  }

  validate(): string | null {
    if (!this.entityId) return 'Hatch entity ID is required';
    if (!this.patch || typeof this.patch.type !== 'string') return 'gradient is required';
    if (this.patch.angleDeg !== undefined && !Number.isFinite(this.patch.angleDeg)) {
      return 'gradient.angleDeg must be finite';
    }
    return null;
  }
}
