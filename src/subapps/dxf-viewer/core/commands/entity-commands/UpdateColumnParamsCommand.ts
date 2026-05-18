/**
 * UPDATE COLUMN PARAMS COMMAND — ADR-363 Phase 4.5.
 *
 * Patches `params` on an existing `ColumnEntity` and recomputes `geometry` +
 * `validation` atomically via `computeColumnGeometry()` +
 * `validateColumnParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Mirrors `UpdateBeamParamsCommand` (ADR-363 §6 Phase 5.5a) και
 * `UpdateSlabParamsCommand` (Phase 3.5) — supports command merging
 * (DEFAULT_MERGE_CONFIG.mergeTimeWindow ms, ADR-031) for grip-drag
 * operations so consecutive drag samples collapse into a single undo entry.
 * Root `kind` field is kept in sync με `params.kind` so the ribbon's kind
 * switch remains undoable και ο `ColumnEntity.kind` discriminator δεν
 * αποκλίνει από το `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateColumnParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateColumnParams';
  readonly type = 'update-column-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly columnId: string,
    private readonly params: ColumnParams,
    private readonly previousParams: ColumnParams,
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

  private applyPatch(params: ColumnParams): void {
    const geometry: ColumnGeometry = computeColumnGeometry(params);
    const validation = validateColumnParams(params).bimValidation;
    this.sceneManager.updateEntity(this.columnId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateColumnParamsCommand)) return false;
    if (other.columnId !== this.columnId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateColumnParamsCommand;
    return new UpdateColumnParamsCommand(
      this.columnId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update column params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.columnId];
  }

  validate(): string | null {
    if (!this.columnId) return 'Column entity ID is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.kind !== 'circular' && this.params.depth <= 0) {
      return 'depth must be > 0';
    }
    if (this.params.height <= 0) return 'height must be > 0';
    if (!Number.isFinite(this.params.rotation)) return 'rotation must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        columnId: this.columnId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
