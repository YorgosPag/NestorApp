/**
 * UPDATE OPENING PARAMS COMMAND — ADR-363 Phase 2.5.
 *
 * Patches `params` on an existing `OpeningEntity` and recomputes `geometry` +
 * `validation` atomically via `computeOpeningGeometry()` +
 * `validateOpeningParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Mirrors `UpdateWallParamsCommand` / `UpdateStairParamsCommand` (ADR-031
 * merge pattern) — consecutive drag samples within the merge window collapse
 * into a single undo entry. Host-wall lookup is re-resolved on each
 * execute/undo/redo via `sceneManager.getEntity(wallId)` so the geometry stays
 * correct even if the host wall is independently edited between samples.
 *
 * Soft-orphan policy (ADR-363 §5.4): if the host wall is missing at execute
 * time, the patch still applies but geometry/validation reuse the
 * previous-known state — the persistence layer re-hydrates once the host wall
 * arrives.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  OpeningGeometry,
  OpeningParams,
} from '../../../bim/types/opening-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateOpeningParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateOpeningParams';
  readonly type = 'update-opening-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly openingId: string,
    private readonly params: OpeningParams,
    private readonly previousParams: OpeningParams,
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

  private applyPatch(params: OpeningParams): void {
    const host = this.resolveHostWall(params.wallId);
    const patch: Record<string, unknown> = { params };
    if (host) {
      const geometry: OpeningGeometry = computeOpeningGeometry(params, host);
      const validation = validateOpeningParams(params, host).bimValidation;
      patch.geometry = geometry;
      patch.validation = validation;
    } else {
      // Soft-orphan: intrinsic validation only (no host-relative checks).
      const validation = validateOpeningParams(params, null).bimValidation;
      patch.validation = validation;
    }
    this.sceneManager.updateEntity(this.openingId, patch as Partial<SceneEntity>);
  }

  private resolveHostWall(wallId: string): WallEntity | null {
    const raw = this.sceneManager.getEntity(wallId);
    if (!raw) return null;
    const candidate = raw as unknown as Partial<WallEntity>;
    if (candidate.type !== 'wall' || !candidate.params || !candidate.geometry) return null;
    return candidate as WallEntity;
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateOpeningParamsCommand)) return false;
    if (other.openingId !== this.openingId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateOpeningParamsCommand;
    return new UpdateOpeningParamsCommand(
      this.openingId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update opening params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.openingId];
  }

  validate(): string | null {
    if (!this.openingId) return 'Opening entity ID is required';
    if (!this.params.wallId) return 'Opening params.wallId is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.height <= 0) return 'height must be > 0';
    if (this.params.offsetFromStart < 0) return 'offsetFromStart must be >= 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        openingId: this.openingId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
