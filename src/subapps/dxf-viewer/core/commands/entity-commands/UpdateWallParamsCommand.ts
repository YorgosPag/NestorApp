/**
 * UPDATE WALL PARAMS COMMAND — ADR-363 Phase 1B.
 *
 * Patches `params` on an existing `WallEntity` and recomputes `geometry` +
 * `validation` atomically via `computeWallGeometry()` + `validateWallParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Mirrors `UpdateStairParamsCommand` (ADR-358 §G15) — supports command merging
 * (DEFAULT_MERGE_CONFIG.mergeTimeWindow ms, ADR-031) for grip-drag operations
 * so consecutive drag samples collapse into a single undo entry. Phase 1B grip
 * drag is deferred (no grips on WallRenderer yet); merging path stays inert
 * until Phase 1.5 wires `wall-grips`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
// ADR-363 §5.4 — hosted-opening cascade SSoT. After the wall geometry is
// patched, every opening hosted on this wall is recomputed atomically so it
// follows the wall (grip / endpoint / length-edit / ribbon / bulk all funnel
// through this command). Same offsetFromStart, new wall → computeOpeningGeometry.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';

export class UpdateWallParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateWallParams';
  readonly type = 'update-wall-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly wallId: string,
    private readonly params: WallParams,
    private readonly previousParams: WallParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
    private readonly kind: WallKind = 'straight',
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

  private applyPatch(params: WallParams): void {
    const geometry: WallGeometry = computeWallGeometry(params, this.kind);
    const validation = validateWallParams(params).bimValidation;
    this.sceneManager.updateEntity(this.wallId, {
      params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
    // ADR-363 §5.4 — recompute hosted openings against the now-updated wall.
    cascadeHostedOpeningsForWalls([this.wallId], this.sceneManager);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateWallParamsCommand)) return false;
    if (other.wallId !== this.wallId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateWallParamsCommand;
    return new UpdateWallParamsCommand(
      this.wallId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
      this.kind,
    );
  }

  getDescription(): string {
    return `Update wall params (${this.params.category})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.wallId];
  }

  validate(): string | null {
    if (!this.wallId) return 'Wall entity ID is required';
    if (this.params.thickness <= 0) return 'thickness must be > 0';
    if (this.params.height <= 0) return 'height must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        wallId: this.wallId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
        kind: this.kind,
      },
      version: 1,
    };
  }
}
