/**
 * UPDATE HATCH BOUNDARY COMMAND — ADR-507.
 *
 * Patches `boundaryPaths` on an existing `HatchEntity`. The hatch is a FLAT
 * primitive — no derived geometry to recompute (area is computed on demand via
 * `computeHatchAreaMm2`), so unlike `UpdateFloorFinishParamsCommand` this only
 * writes the new outline.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive grip-drag samples collapse into a single undo entry within the
 * merge window. `useHatchPersistence` picks up the patched entity via its
 * debounced auto-save (the `dequal(pickHatchData(...))` diff catches the new
 * `boundaryPaths`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateHatchBoundaryCommand extends MergeableUpdateCommand<Point2D[][]> {
  readonly name = 'UpdateHatchBoundary';
  readonly type = 'update-hatch-boundary';

  constructor(
    hatchId: string,
    boundaryPaths: Point2D[][],
    previousBoundaryPaths: Point2D[][],
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(hatchId, boundaryPaths, previousBoundaryPaths, sceneManager, isDragging);
  }

  protected applyPatch(boundaryPaths: Point2D[][]): void {
    this.sceneManager.updateEntity(this.entityId, {
      boundaryPaths,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: Point2D[][]): UpdateHatchBoundaryCommand {
    return new UpdateHatchBoundaryCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return 'Update hatch boundary';
  }

  validate(): string | null {
    if (!this.entityId) return 'Hatch entity ID is required';
    if (!this.patch || this.patch.length === 0) return 'boundaryPaths must have at least one ring';
    if (this.patch[0].length < 3) return 'outer boundary must have at least 3 vertices';
    return null;
  }
}
