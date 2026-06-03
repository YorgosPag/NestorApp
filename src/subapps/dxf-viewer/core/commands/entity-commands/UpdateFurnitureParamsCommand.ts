/**
 * UPDATE FURNITURE PARAMS COMMAND — ADR-410.
 *
 * Patches `params` on an existing `FurnitureEntity` and recomputes `geometry`
 * + `validation` atomically via `computeFurnitureGeometry()` +
 * `validateFurnitureParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateMepFixtureParamsCommand` (ADR-406)
 * — supports command merging for grip-drag operations so consecutive drag
 * samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FurnitureGeometry, FurnitureParams } from '../../../bim/types/furniture-types';
import { computeFurnitureGeometry, validateFurnitureParams } from '../../../bim/furniture/furniture-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateFurnitureParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateFurnitureParams';
  readonly type = 'update-furniture-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly furnitureId: string,
    private readonly params: FurnitureParams,
    private readonly previousParams: FurnitureParams,
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

  private applyPatch(params: FurnitureParams): void {
    const geometry: FurnitureGeometry = computeFurnitureGeometry(params);
    const validation = validateFurnitureParams(params).bimValidation;
    this.sceneManager.updateEntity(this.furnitureId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateFurnitureParamsCommand)) return false;
    if (other.furnitureId !== this.furnitureId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateFurnitureParamsCommand;
    return new UpdateFurnitureParamsCommand(
      this.furnitureId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update furniture params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.furnitureId];
  }

  validate(): string | null {
    if (!this.furnitureId) return 'Furniture entity ID is required';
    if (this.params.widthMm <= 0) return 'widthMm must be > 0';
    if (this.params.depthMm <= 0) return 'depthMm must be > 0';
    if (this.params.heightMm <= 0) return 'heightMm must be > 0';
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
        furnitureId: this.furnitureId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
