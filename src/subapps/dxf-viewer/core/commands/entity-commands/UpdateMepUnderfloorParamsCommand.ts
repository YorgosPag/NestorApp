/**
 * UPDATE MEP UNDERFLOOR PARAMS COMMAND — ADR-408 Εύρος Β #3.
 *
 * Patches `params` on an existing `MepUnderfloorEntity` and recomputes
 * `geometry` atomically via `computeMepUnderfloorGeometry()` so the renderer
 * never reads stale data.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive drag samples collapse into a single undo entry within the merge
 * window. Persistence picks up the patched entity via debounced auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { MepUnderfloorParams } from '../../../bim/types/mep-underfloor-types';
import { computeMepUnderfloorGeometry } from '../../../bim/mep-underfloor/mep-underfloor-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepUnderfloorParamsCommand extends MergeableUpdateCommand<MepUnderfloorParams> {
  readonly name = 'UpdateMepUnderfloorParams';
  readonly type = 'update-mep-underfloor-params';

  constructor(
    underfloorId: string,
    params: MepUnderfloorParams,
    previousParams: MepUnderfloorParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(underfloorId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepUnderfloorParams): void {
    const geometry = computeMepUnderfloorGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: MepUnderfloorParams): UpdateMepUnderfloorParamsCommand {
    return new UpdateMepUnderfloorParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update underfloor heating params (${this.entityId})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Underfloor entity ID is required';
    if (!this.patch.footprint || this.patch.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.patch.pipeSpacingMm <= 0) return 'pipeSpacingMm must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      underfloorId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
