/**
 * UPDATE MEP SEGMENT PARAMS COMMAND — ADR-408 Φ8.
 *
 * Patches `params` on an existing `MepSegmentEntity` and recomputes
 * `geometry` atomically via `computeMepSegmentGeometry()` so renderer reads
 * never diverge from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive grip-drag samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { MepSegmentParams } from '../../../bim/types/mep-segment-types';
import { computeMepSegmentGeometry } from '../../../bim/geometry/mep-segment-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepSegmentParamsCommand extends MergeableUpdateCommand<MepSegmentParams> {
  readonly name = 'UpdateMepSegmentParams';
  readonly type = 'update-mep-segment-params';

  constructor(
    segmentId: string,
    params: MepSegmentParams,
    previousParams: MepSegmentParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(segmentId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepSegmentParams): void {
    const geometry = computeMepSegmentGeometry(params);
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.domain,
      params,
      geometry,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: MepSegmentParams): UpdateMepSegmentParamsCommand {
    return new UpdateMepSegmentParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP segment params (${this.patch.domain}/${this.patch.sectionKind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP segment entity ID is required';
    if (!this.patch.domain) return 'domain is required';
    if (!this.patch.sectionKind) return 'sectionKind is required';
    if (!Number.isFinite(this.patch.centerlineElevationMm)) {
      return 'centerlineElevationMm must be finite';
    }
    return null;
  }
}
