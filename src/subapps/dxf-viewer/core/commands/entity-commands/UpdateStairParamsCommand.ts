/**
 * UPDATE STAIR PARAMS COMMAND — ADR-358 Phase 5b (G15).
 *
 * Patches `params` on an existing `StairEntity` and recomputes `geometry`
 * atomically via `computeStairGeometry()` so renderer reads never diverge
 * from the parametric source of truth. Supports command merging
 * (`DEFAULT_MERGE_CONFIG.mergeTimeWindow` ms, ADR-031 pattern) for grip-drag
 * operations — consecutive drag samples collapse into a single undo entry.
 *
 * Mirrors `UpdateArrayParamsCommand` (ADR-353) and is the commit path used by
 * `commitDxfGripDragModeAware` when the active grip carries a `stairGripKind`.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { StairGeometry, StairParams } from '../../../bim/types/stair-types';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
// ADR-358 Phase 6.1 — re-validate on every grip/edit commit so the red
// badge (Phase 7b1) reflects the live state and the user sees overflow
// warnings the moment they exceed code/story-height limits.
import { validateStairParams } from '../../../bim/stairs/stair-validator';

export class UpdateStairParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateStairParams';
  readonly type = 'update-stair-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly stairId: string,
    private readonly params: StairParams,
    private readonly previousParams: StairParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const geometry: StairGeometry = computeStairGeometry(this.params);
    const validation = validateStairParams(this.params);
    this.sceneManager.updateEntity(this.stairId, {
      params: this.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    const geometry: StairGeometry = computeStairGeometry(this.previousParams);
    const validation = validateStairParams(this.previousParams);
    this.sceneManager.updateEntity(this.stairId, {
      params: this.previousParams,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  redo(): void {
    const geometry: StairGeometry = computeStairGeometry(this.params);
    const validation = validateStairParams(this.params);
    this.sceneManager.updateEntity(this.stairId, {
      params: this.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateStairParamsCommand)) return false;
    if (other.stairId !== this.stairId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateStairParamsCommand;
    return new UpdateStairParamsCommand(
      this.stairId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update stair params (${this.params.variant.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.stairId];
  }

  validate(): string | null {
    if (!this.stairId) return 'Stair entity ID is required';
    if (this.params.stepCount < 2) return 'stepCount must be >= 2';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.tread <= 0) return 'tread must be > 0';
    if (this.params.rise <= 0) return 'rise must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        stairId: this.stairId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
