/**
 * UPDATE DIM GRIP COMMAND — ADR-362 Phase I (Round 22).
 *
 * Undoable commit for a dimension grip drag (ext-line origin / dim-line offset /
 * text position / linear rotation handle / ordinate datum). Patches only the
 * touched fields of a `DimensionEntity` — the render pass recomputes the derived
 * geometry (foot points, arrows, measurement) from `defPoints`, exactly like the
 * creation path, so there is no geometry to recompute here (flat-primitive patch,
 * mirrors `UpdateHatchBoundaryCommand`).
 *
 * Merge/undo/redo skeleton inherited from `MergeableUpdateCommand` (ADR-507 §8):
 * consecutive drag samples within the merge window collapse into a single undo
 * entry. Today `commitDimensionGripDrag` runs once on mouseUp (`isDragging=false`,
 * one command per gesture) — the live feedback is the preview ghost, not scene
 * mutations — but the merge plumbing is ready if intra-drag commits are added.
 *
 * `DimGripPatch` + the symmetric `{ patch, previous }` diff are produced by
 * `diffDimEntity` (`hooks/dimensions/useDimensionGrips.ts`).
 *
 * @see hooks/dimensions/useDimensionGrips.ts — DimGripPatch + diffDimEntity (SSoT)
 * @see core/commands/entity-commands/UpdateHatchBoundaryCommand.ts — flat-patch reference
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { DimGripPatch } from '../../../hooks/dimensions/useDimensionGrips';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateDimGripCommand extends MergeableUpdateCommand<DimGripPatch> {
  readonly name = 'UpdateDimGrip';
  readonly type = 'update-dim-grip';

  constructor(
    dimId: string,
    patch: DimGripPatch,
    previousPatch: DimGripPatch,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(dimId, patch, previousPatch, sceneManager, isDragging);
  }

  protected applyPatch(patch: DimGripPatch): void {
    // SceneModel stores DimensionEntity directly (no DxfDimension wrapper) — the
    // patch fields live at the top level of the entity (defPoints / textMidpoint /
    // rotation / datum). updateEntity merges, so undo's `previous` patch restores
    // exactly the keys the forward patch touched.
    this.sceneManager.updateEntity(this.entityId, patch as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: DimGripPatch): UpdateDimGripCommand {
    return new UpdateDimGripCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return 'Update dimension grip';
  }

  validate(): string | null {
    if (!this.entityId) return 'Dimension entity ID is required';
    if (!this.patch || Object.keys(this.patch).length === 0) return 'patch must touch at least one field';
    return null;
  }
}
