/**
 * UPDATE HATCH BOUNDARY COMMAND — ADR-507.
 *
 * Patches `boundaryPaths` on an existing `HatchEntity`. The hatch is a FLAT
 * primitive — no derived geometry to recompute (area is computed on demand via
 * `computeHatchAreaMm2`), so unlike `UpdateFloorFinishParamsCommand` this only
 * writes the new outline.
 *
 * Mirrors the `UpdateFloorFinishParamsCommand` merge pattern (ADR-031) —
 * consecutive grip-drag samples collapse into a single undo entry within the
 * merge window. `useHatchPersistence` picks up the patched entity via its
 * debounced auto-save (the `dequal(pickHatchData(...))` diff catches the new
 * `boundaryPaths`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateHatchBoundaryCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateHatchBoundary';
  readonly type = 'update-hatch-boundary';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly hatchId: string,
    private readonly boundaryPaths: Point2D[][],
    private readonly previousBoundaryPaths: Point2D[][],
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.boundaryPaths);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousBoundaryPaths);
  }

  redo(): void {
    this.applyPatch(this.boundaryPaths);
  }

  private applyPatch(boundaryPaths: Point2D[][]): void {
    this.sceneManager.updateEntity(this.hatchId, {
      boundaryPaths,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateHatchBoundaryCommand)) return false;
    if (other.hatchId !== this.hatchId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateHatchBoundaryCommand;
    return new UpdateHatchBoundaryCommand(
      this.hatchId,
      o.boundaryPaths,
      this.previousBoundaryPaths,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return 'Update hatch boundary';
  }

  getAffectedEntityIds(): string[] {
    return [this.hatchId];
  }

  validate(): string | null {
    if (!this.hatchId) return 'Hatch entity ID is required';
    if (!this.boundaryPaths || this.boundaryPaths.length === 0) return 'boundaryPaths must have at least one ring';
    if (this.boundaryPaths[0].length < 3) return 'outer boundary must have at least 3 vertices';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        hatchId: this.hatchId,
        boundaryPaths: this.boundaryPaths,
        previousBoundaryPaths: this.previousBoundaryPaths,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
