/**
 * UPDATE THERMAL SPACE PARAMS COMMAND — ADR-422 L0.
 *
 * Patches `params` on an existing `ThermalSpaceEntity` and recomputes
 * `geometry` atomically via `computeThermalSpaceGeometry()` so the renderer
 * never reads stale data (area/volume always in sync with footprint/height).
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * The contextual tab bridge routes useType/setpoint/ACH/name edits through this
 * command; `useThermalSpacePersistence` picks up the patched entity via debounced
 * auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { ThermalSpaceParams } from '../../../bim/types/thermal-space-types';
import { computeThermalSpaceGeometry } from '../../../bim/types/thermal-space-types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateThermalSpaceParamsCommand extends MergeableUpdateCommand<ThermalSpaceParams> {
  readonly name = 'UpdateThermalSpaceParams';
  readonly type = 'update-thermal-space-params';

  constructor(
    spaceId: string,
    params: ThermalSpaceParams,
    previousParams: ThermalSpaceParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(spaceId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: ThermalSpaceParams): void {
    const geometry = computeThermalSpaceGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      // useType is the entity `kind` — keep it in sync when the use changes.
      kind: params.useType,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: ThermalSpaceParams): UpdateThermalSpaceParamsCommand {
    return new UpdateThermalSpaceParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update thermal space params (${this.patch.useType})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Thermal space entity ID is required';
    if (!this.patch.footprint || this.patch.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.patch.ceilingHeightMm <= 0) return 'ceilingHeightMm must be > 0';
    return null;
  }
}
