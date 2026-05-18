/**
 * UPDATE SLAB PARAMS COMMAND — ADR-363 Phase 3.5.
 *
 * Patches `params` on an existing `SlabEntity` and recomputes `geometry` +
 * `validation` atomically via `computeSlabGeometry()` + `validateSlabParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Mirrors `UpdateStairParamsCommand` / `UpdateWallParamsCommand` /
 * `UpdateOpeningParamsCommand` (ADR-031 merge pattern) — consecutive drag
 * samples within the merge window collapse into a single undo entry. Root
 * `kind` field is kept in sync με `params.kind` so the ribbon's kind switch
 * remains undoable.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { SlabGeometry, SlabParams } from '../../../bim/types/slab-types';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../../bim/validators/slab-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateSlabParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateSlabParams';
  readonly type = 'update-slab-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly slabId: string,
    private readonly params: SlabParams,
    private readonly previousParams: SlabParams,
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

  private applyPatch(params: SlabParams): void {
    const geometry: SlabGeometry = computeSlabGeometry(params);
    const validation = validateSlabParams(params).bimValidation;
    this.sceneManager.updateEntity(this.slabId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateSlabParamsCommand)) return false;
    if (other.slabId !== this.slabId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateSlabParamsCommand;
    return new UpdateSlabParamsCommand(
      this.slabId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update slab params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.slabId];
  }

  validate(): string | null {
    if (!this.slabId) return 'Slab entity ID is required';
    if (!this.params.outline || this.params.outline.vertices.length < 3) {
      return 'outline must have at least 3 vertices';
    }
    if (this.params.thickness <= 0) return 'thickness must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        slabId: this.slabId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
