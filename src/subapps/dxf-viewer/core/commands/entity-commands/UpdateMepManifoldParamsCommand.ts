/**
 * UPDATE MEP MANIFOLD PARAMS COMMAND — ADR-408 Φ12.
 *
 * Patches `params` on an existing `MepManifoldEntity` and recomputes
 * `geometry` + `validation` atomically via `computeMepManifoldGeometry()` +
 * `validateMepManifoldParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * On execute / undo / redo emits `'bim:mep-manifold-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  MepManifoldGeometry,
  MepManifoldParams,
} from '../../../bim/types/mep-manifold-types';
import {
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../../../bim/mep-manifolds/mep-manifold-geometry';
import { EventBus } from '../../../systems/events/EventBus';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepManifoldParamsCommand extends MergeableUpdateCommand<MepManifoldParams> {
  readonly name = 'UpdateMepManifoldParams';
  readonly type = 'update-mep-manifold-params';

  constructor(
    manifoldId: string,
    params: MepManifoldParams,
    previousParams: MepManifoldParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(manifoldId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepManifoldParams): void {
    const geometry: MepManifoldGeometry = computeMepManifoldGeometry(params);
    const validation = validateMepManifoldParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-manifold-params-updated', { manifoldId: this.entityId });
  }

  protected withMergedPatch(nextPatch: MepManifoldParams): UpdateMepManifoldParamsCommand {
    return new UpdateMepManifoldParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP manifold params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP manifold entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }
}
