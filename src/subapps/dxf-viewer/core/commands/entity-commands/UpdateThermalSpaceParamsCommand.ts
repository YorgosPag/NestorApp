/**
 * UPDATE THERMAL SPACE PARAMS COMMAND — ADR-422 L0.
 *
 * Patches `params` on an existing `ThermalSpaceEntity` and recomputes
 * `geometry` atomically via `computeThermalSpaceGeometry()` so the renderer
 * never reads stale data (area/volume always in sync with footprint/height).
 *
 * Mirrors `UpdateFloorFinishParamsCommand` (area-entity pattern). The contextual
 * tab bridge routes useType/setpoint/ACH/name edits through this command;
 * `useThermalSpacePersistence` picks up the patched entity via debounced auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ThermalSpaceParams } from '../../../bim/types/thermal-space-types';
import { computeThermalSpaceGeometry } from '../../../bim/types/thermal-space-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateThermalSpaceParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateThermalSpaceParams';
  readonly type = 'update-thermal-space-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly spaceId: string,
    private readonly params: ThermalSpaceParams,
    private readonly previousParams: ThermalSpaceParams,
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

  private applyPatch(params: ThermalSpaceParams): void {
    const geometry = computeThermalSpaceGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.spaceId, {
      params,
      geometry,
      // useType is the entity `kind` — keep it in sync when the use changes.
      kind: params.useType,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateThermalSpaceParamsCommand)) return false;
    if (other.spaceId !== this.spaceId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateThermalSpaceParamsCommand;
    return new UpdateThermalSpaceParamsCommand(
      this.spaceId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update thermal space params (${this.params.useType})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.spaceId];
  }

  validate(): string | null {
    if (!this.spaceId) return 'Thermal space entity ID is required';
    if (!this.params.footprint || this.params.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.params.ceilingHeightMm <= 0) return 'ceilingHeightMm must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        spaceId: this.spaceId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
