/**
 * UPDATE FLOOR FINISH PARAMS COMMAND — ADR-419.
 *
 * Patches `params` on an existing `FloorFinishEntity` and recomputes
 * `geometry` atomically via `computeFloorFinishGeometry()` so the renderer
 * never reads stale data.
 *
 * Mirrors `UpdateSlabParamsCommand` (ADR-363 merge pattern) — consecutive
 * drag samples collapse into a single undo entry within the merge window.
 * `useFloorFinishPersistence` picks up the patched entity via debounced auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FloorFinishParams } from '../../../bim/types/floor-finish-types';
import { computeFloorFinishGeometry } from '../../../bim/types/floor-finish-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateFloorFinishParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateFloorFinishParams';
  readonly type = 'update-floor-finish-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly finishId: string,
    private readonly params: FloorFinishParams,
    private readonly previousParams: FloorFinishParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.params);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousParams);
  }

  redo(): void {
    this.applyPatch(this.params);
  }

  private applyPatch(params: FloorFinishParams): void {
    const geometry = computeFloorFinishGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.finishId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateFloorFinishParamsCommand)) return false;
    if (other.finishId !== this.finishId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateFloorFinishParamsCommand;
    return new UpdateFloorFinishParamsCommand(
      this.finishId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update floor finish params (${this.params.materialId})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.finishId];
  }

  validate(): string | null {
    if (!this.finishId) return 'Floor finish entity ID is required';
    if (!this.params.footprint || this.params.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.params.thicknessMm <= 0) return 'thicknessMm must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        finishId: this.finishId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
