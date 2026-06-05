/**
 * ASSIGN ROOF TYPE COMMAND — ADR-417 §10 #3 (BIM Family Types UI). Roof analogue
 * of {@link AssignSlabTypeCommand}.
 *
 * Sets a roof instance's family-type linkage (`typeId` + per-param
 * `typeOverrides`) AND folds the resolved effective params back onto the entity
 * atomically. The caller resolves the effective params up-front (via
 * `resolveEffectiveRoofParams`, «type always wins»); this command patches the
 * entity and recomputes `geometry` + `validation` so the renderer never diverges
 * from the parametric source of truth.
 *
 * Covers every mutation that touches the type link:
 *   - assign a type      → next typeId set, params resolved from the type,
 *   - clear (detach)     → next typeId `undefined`, params kept (non-destructive),
 *   - set/clear override → next typeOverrides changed, params re-resolved.
 *
 * Discrete undo step (NO merge): a type assignment is a deliberate user action.
 *
 * @see bim/family-types/resolve-effective-params.ts — effective-param SSoT
 * @see core/commands/entity-commands/AssignSlabTypeCommand.ts — the slab sibling
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { RoofGeometry, RoofParams } from '../../../bim/types/roof-types';
import type { RoofTypeParams } from '../../../bim/types/bim-family-type';
import { computeRoofGeometry, validateRoofParams } from '../../../bim/geometry/roof-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Immutable snapshot of a roof's family-type link + cached params. */
export interface RoofTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<RoofTypeParams> | undefined;
  readonly params: RoofParams;
}

export class AssignRoofTypeCommand implements ICommand {
  readonly id: string;
  readonly name = 'AssignRoofType';
  readonly type = 'assign-roof-type';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly roofId: string,
    private readonly next: RoofTypeAssignment,
    private readonly previous: RoofTypeAssignment,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyState(this.next);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyState(this.previous);
  }

  redo(): void {
    this.applyState(this.next);
  }

  private applyState(state: RoofTypeAssignment): void {
    const geometry: RoofGeometry = computeRoofGeometry(state.params);
    const validation = validateRoofParams(state.params).bimValidation;
    // `typeId`/`typeOverrides` are set explicitly (incl. to `undefined`) so undo
    // can restore the untyped/ad-hoc state — a spread merge cannot delete a key.
    this.sceneManager.updateEntity(this.roofId, {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
      params: state.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign roof type (${this.next.typeId})`
      : 'Clear roof type';
  }

  getAffectedEntityIds(): string[] {
    return [this.roofId];
  }

  validate(): string | null {
    if (!this.roofId) return 'Roof entity ID is required';
    if (this.next.params.thickness <= 0) return 'thickness must be > 0';
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
        next: this.next,
        previous: this.previous,
      },
      version: 1,
    };
  }
}
