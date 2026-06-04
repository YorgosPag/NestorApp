/**
 * UPDATE ROOF PARAMS COMMAND — ADR-417 Φ1-part-2.
 *
 * Patches `params` (και optionally `typeId`) on an existing `RoofEntity` and
 * recomputes `geometry` + `validation` atomically via `computeRoofGeometry()` +
 * `validateRoofParams()` so renderer reads never diverge from the parametric
 * source of truth (FOOTPRINT ⊥ TYPE — geometry derived, never persisted as truth).
 *
 * Mirrors `UpdateSlabParamsCommand` (ADR-363 Phase 3.5 merge pattern) —
 * consecutive drag samples within the merge window collapse into a single undo
 * entry. The contextual roof tab dispatches one command per edit (`isDragging
 * = false`) so shape / slope / base-elevation / roof-type changes are each their
 * own undo entry.
 *
 * `typeChange` carries the optional Roof Type assignment: when present the root
 * `typeId` field is patched (forward → `next`, undo → `prev`) alongside the
 * params (which already fold in the type's dna/thickness via the bridge). When
 * absent the entity's `typeId` is left untouched (pure geometry edit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see core/commands/entity-commands/UpdateSlabParamsCommand.ts — το πρότυπο (clone)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { RoofGeometry, RoofParams } from '../../../bim/types/roof-types';
import { computeRoofGeometry, validateRoofParams } from '../../../bim/geometry/roof-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

/** Optional Roof Type (family type) assignment carried by the command. */
export interface RoofTypeChange {
  /** Forward/redo value (built-in RoofType id, or `undefined` to clear). */
  readonly next: string | undefined;
  /** Undo value (previous `entity.typeId`). */
  readonly prev: string | undefined;
}

export class UpdateRoofParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateRoofParams';
  readonly type = 'update-roof-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly roofId: string,
    private readonly params: RoofParams,
    private readonly previousParams: RoofParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
    private readonly typeChange?: RoofTypeChange,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.params, this.typeChange?.next);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousParams, this.typeChange?.prev);
  }

  redo(): void {
    this.applyPatch(this.params, this.typeChange?.next);
  }

  private applyPatch(params: RoofParams, typeId: string | undefined): void {
    const geometry: RoofGeometry = computeRoofGeometry(params);
    const validation = validateRoofParams(params).bimValidation;
    const patch: Record<string, unknown> = { params, geometry, validation };
    // Only touch the root `typeId` for an explicit Roof Type assignment — a pure
    // geometry edit (shape / slope / elevation) leaves the type link intact.
    if (this.typeChange) patch.typeId = typeId;
    this.sceneManager.updateEntity(this.roofId, patch as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateRoofParamsCommand)) return false;
    if (other.roofId !== this.roofId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateRoofParamsCommand;
    return new UpdateRoofParamsCommand(
      this.roofId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
      this.typeChange,
    );
  }

  getDescription(): string {
    return `Update roof params (${this.params.outline.vertices.length} verts)`;
  }

  getAffectedEntityIds(): string[] {
    return [this.roofId];
  }

  validate(): string | null {
    if (!this.roofId) return 'Roof entity ID is required';
    if (!this.params.outline || this.params.outline.vertices.length < 3) {
      return 'outline must have at least 3 vertices';
    }
    if (this.params.edges.length !== this.params.outline.vertices.length) {
      return 'edges length must match outline vertices';
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
        roofId: this.roofId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
        typeChange: this.typeChange ?? null,
      },
      version: 1,
    };
  }
}
