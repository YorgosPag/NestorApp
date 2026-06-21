/**
 * UPDATE BEAM PARAMS COMMAND — ADR-363 Phase 5.5a.
 *
 * Patches `params` on an existing `BeamEntity` and recomputes `geometry` +
 * `validation` atomically via `computeBeamGeometry()` + `validateBeamParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Root `kind` field is kept in sync με `params.kind` (mirror Slab Phase 3.5)
 * so the ribbon's kind switch remains undoable και ο `BeamEntity.kind`
 * discriminator δεν αποκλίνει από το `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { BeamGeometry, BeamParams } from '../../../bim/types/beam-types';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../../bim/validators/beam-validator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateBeamParamsCommand extends MergeableUpdateCommand<BeamParams> {
  readonly name = 'UpdateBeamParams';
  readonly type = 'update-beam-params';

  constructor(
    beamId: string,
    params: BeamParams,
    previousParams: BeamParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(beamId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: BeamParams): void {
    const geometry: BeamGeometry = computeBeamGeometry(params);
    const validation = validateBeamParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: BeamParams): UpdateBeamParamsCommand {
    return new UpdateBeamParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update beam params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Beam entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.depth <= 0) return 'depth must be > 0';
    const dx = this.patch.endPoint.x - this.patch.startPoint.x;
    const dy = this.patch.endPoint.y - this.patch.startPoint.y;
    const chord = Math.hypot(dx, dy);
    if (chord <= 0) return 'length must be > 0';
    if (this.patch.kind === 'curved' && !this.patch.curveControl) {
      return 'Curved beam requires curveControl';
    }
    return null;
  }
}
