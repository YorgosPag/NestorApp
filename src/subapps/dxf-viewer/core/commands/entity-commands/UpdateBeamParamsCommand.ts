/**
 * UPDATE BEAM PARAMS COMMAND — ADR-363 Phase 5.5a.
 *
 * Patches `params` on an existing `BeamEntity` and recomputes `geometry` +
 * `validation` atomically via `computeBeamGeometry()` + `validateBeamParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Mirrors `UpdateWallParamsCommand` (ADR-363 §6 Phase 1B) — supports command
 * merging (DEFAULT_MERGE_CONFIG.mergeTimeWindow ms, ADR-031) for grip-drag
 * operations so consecutive drag samples collapse into a single undo entry.
 * Root `kind` field is kept in sync με `params.kind` (mirror Slab Phase 3.5)
 * so the ribbon's kind switch remains undoable και ο `BeamEntity.kind`
 * discriminator δεν αποκλίνει από το `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { BeamGeometry, BeamParams } from '../../../bim/types/beam-types';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../../bim/validators/beam-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateBeamParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateBeamParams';
  readonly type = 'update-beam-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly beamId: string,
    private readonly params: BeamParams,
    private readonly previousParams: BeamParams,
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

  private applyPatch(params: BeamParams): void {
    const geometry: BeamGeometry = computeBeamGeometry(params);
    const validation = validateBeamParams(params).bimValidation;
    this.sceneManager.updateEntity(this.beamId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateBeamParamsCommand)) return false;
    if (other.beamId !== this.beamId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateBeamParamsCommand;
    return new UpdateBeamParamsCommand(
      this.beamId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update beam params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.beamId];
  }

  validate(): string | null {
    if (!this.beamId) return 'Beam entity ID is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.depth <= 0) return 'depth must be > 0';
    const dx = this.params.endPoint.x - this.params.startPoint.x;
    const dy = this.params.endPoint.y - this.params.startPoint.y;
    const chord = Math.hypot(dx, dy);
    if (chord <= 0) return 'length must be > 0';
    if (this.params.kind === 'curved' && !this.params.curveControl) {
      return 'Curved beam requires curveControl';
    }
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        beamId: this.beamId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
