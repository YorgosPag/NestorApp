/**
 * UPDATE RAILING PARAMS COMMAND — ADR-407.
 *
 * Patches `params` on an existing `RailingEntity` and recomputes `geometry` +
 * `validation` atomically via `computeRailingGeometry()` +
 * `validateRailingParams()` so renderer reads never diverge from the parametric
 * source of truth (PATH ⊥ TYPE → derived geometry). Mirrors
 * `UpdateMepFixtureParamsCommand` — supports command merging for grip-drag
 * operations so consecutive drag samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { RailingGeometry, RailingParams } from '../../../bim/types/railing-types';
import { computeRailingGeometry, validateRailingParams } from '../../../bim/railings/railing-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateRailingParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateRailingParams';
  readonly type = 'update-railing-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly railingId: string,
    private readonly params: RailingParams,
    private readonly previousParams: RailingParams,
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

  private applyPatch(params: RailingParams): void {
    const geometry: RailingGeometry = computeRailingGeometry(params);
    const validation = validateRailingParams(params).bimValidation;
    this.sceneManager.updateEntity(this.railingId, {
      kind: 'railing',
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateRailingParamsCommand)) return false;
    if (other.railingId !== this.railingId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateRailingParamsCommand;
    return new UpdateRailingParamsCommand(
      this.railingId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update railing params (${this.params.type.predefinedType})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.railingId];
  }

  validate(): string | null {
    if (!this.railingId) return 'Railing entity ID is required';
    if (this.params.totalHeightMm <= 0) return 'totalHeightMm must be > 0';
    if (this.params.type.balusterPlacement.pattern.spacingMm <= 0) {
      return 'baluster spacing must be > 0';
    }
    if (!Number.isFinite(this.params.baseElevationMm)) return 'baseElevationMm must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        railingId: this.railingId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
