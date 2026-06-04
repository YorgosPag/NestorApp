/**
 * UPDATE FLOORPLAN SYMBOL PARAMS COMMAND — ADR-415.
 *
 * Patches `params` on an existing `FloorplanSymbolEntity` and recomputes
 * `geometry` + `validation` atomically via `computeFloorplanSymbolGeometry()` +
 * `validateFloorplanSymbolParams()` so renderer reads never diverge from the
 * parametric source of truth. 1:1 mirror of `UpdateFurnitureParamsCommand`
 * (ADR-410) — supports command merging for grip-drag operations so consecutive
 * drag samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FloorplanSymbolGeometry, FloorplanSymbolParams } from '../../../bim/types/floorplan-symbol-types';
import { computeFloorplanSymbolGeometry, validateFloorplanSymbolParams } from '../../../bim/floorplan-symbols/floorplan-symbol-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateFloorplanSymbolParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateFloorplanSymbolParams';
  readonly type = 'update-floorplan-symbol-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly symbolId: string,
    private readonly params: FloorplanSymbolParams,
    private readonly previousParams: FloorplanSymbolParams,
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

  private applyPatch(params: FloorplanSymbolParams): void {
    const geometry: FloorplanSymbolGeometry = computeFloorplanSymbolGeometry(params);
    const validation = validateFloorplanSymbolParams(params).bimValidation;
    this.sceneManager.updateEntity(this.symbolId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateFloorplanSymbolParamsCommand)) return false;
    if (other.symbolId !== this.symbolId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateFloorplanSymbolParamsCommand;
    return new UpdateFloorplanSymbolParamsCommand(
      this.symbolId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update floorplan symbol params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.symbolId];
  }

  validate(): string | null {
    if (!this.symbolId) return 'Floorplan symbol entity ID is required';
    if (this.params.widthMm <= 0) return 'widthMm must be > 0';
    if (this.params.depthMm <= 0) return 'depthMm must be > 0';
    if (!Number.isFinite(this.params.rotationDeg)) return 'rotationDeg must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        symbolId: this.symbolId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
