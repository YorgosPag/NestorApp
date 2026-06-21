/**
 * UPDATE ROOF PARAMS COMMAND — ADR-417 Φ1-part-2.
 *
 * Patches `params` (και optionally `typeId`) on an existing `RoofEntity` and
 * recomputes `geometry` + `validation` atomically via `computeRoofGeometry()` +
 * `validateRoofParams()` so renderer reads never diverge from the parametric
 * source of truth (FOOTPRINT ⊥ TYPE — geometry derived, never persisted as truth).
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Unlike the other params commands the patch is a COMPOSITE `{ params, typeId }`:
 * the optional Roof Type assignment carries a forward (`next`) and undo (`prev`)
 * `typeId` that must travel WITH the params through execute/undo/redo. The base
 * applies `this.patch` on execute/redo and `this.previousPatch` on undo, so each
 * direction already carries its own `typeId`. A pure geometry edit leaves
 * `typeChange` undefined and the entity's `typeId` is never touched.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { RoofGeometry, RoofParams } from '../../../bim/types/roof-types';
import { computeRoofGeometry, validateRoofParams } from '../../../bim/geometry/roof-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

/** Optional Roof Type (family type) assignment carried by the command. */
export interface RoofTypeChange {
  /** Forward/redo value (built-in RoofType id, or `undefined` to clear). */
  readonly next: string | undefined;
  /** Undo value (previous `entity.typeId`). */
  readonly prev: string | undefined;
}

/** Composite patch — params travel with the directional `typeId`. */
interface RoofPatch {
  readonly params: RoofParams;
  readonly typeId: string | undefined;
}

export class UpdateRoofParamsCommand extends MergeableUpdateCommand<RoofPatch> {
  readonly name = 'UpdateRoofParams';
  readonly type = 'update-roof-params';

  private readonly typeChange?: RoofTypeChange;

  constructor(
    roofId: string,
    params: RoofParams,
    previousParams: RoofParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
    typeChange?: RoofTypeChange,
  ) {
    super(
      roofId,
      { params, typeId: typeChange?.next },
      { params: previousParams, typeId: typeChange?.prev },
      sceneManager,
      isDragging,
    );
    this.typeChange = typeChange;
  }

  protected applyPatch(patch: RoofPatch): void {
    const geometry: RoofGeometry = computeRoofGeometry(patch.params);
    const validation = validateRoofParams(patch.params).bimValidation;
    const scenePatch: Record<string, unknown> = { params: patch.params, geometry, validation };
    // Only touch the root `typeId` for an explicit Roof Type assignment — a pure
    // geometry edit (shape / slope / elevation) leaves the type link intact.
    if (this.typeChange) scenePatch.typeId = patch.typeId;
    this.sceneManager.updateEntity(this.entityId, scenePatch as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: RoofPatch): UpdateRoofParamsCommand {
    return new UpdateRoofParamsCommand(
      this.entityId,
      nextPatch.params,
      this.previousPatch.params,
      this.sceneManager,
      true,
      this.typeChange,
    );
  }

  getDescription(): string {
    return `Update roof params (${this.patch.params.outline.vertices.length} verts)`;
  }

  validate(): string | null {
    const params = this.patch.params;
    if (!this.entityId) return 'Roof entity ID is required';
    if (!params.outline || params.outline.vertices.length < 3) {
      return 'outline must have at least 3 vertices';
    }
    if (params.edges.length !== params.outline.vertices.length) {
      return 'edges length must match outline vertices';
    }
    if (params.thickness <= 0) return 'thickness must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    // Canonical base shape + Roof's genuine extra state (the Type assignment).
    return { ...this.baseSerializedData(), typeChange: this.typeChange ?? null };
  }
}
