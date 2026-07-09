/**
 * ASSIGN SLAB TYPE COMMAND — ADR-412 (BIM Family Types UI). Slab analogue of
 * {@link AssignWallTypeCommand}.
 *
 * Sets a slab instance's family-type linkage (`typeId` + per-param
 * `typeOverrides`) AND folds the resolved effective params back onto the entity
 * atomically. The caller resolves the effective params up-front (via
 * `resolveEffectiveSlabParams`, «type always wins»); this command patches the
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
 * @see core/commands/entity-commands/AssignWallTypeCommand.ts — the wall sibling
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.3 §3.4
 */

import type { SlabGeometry, SlabParams } from '../../../bim/types/slab-types';
import type { SlabTypeParams } from '../../../bim/types/bim-family-type';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../../bim/validators/slab-validator';
import { AssignTypeCommandBase } from './assign-type-command-base';

/** Immutable snapshot of a slab's family-type link + cached params. */
export interface SlabTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<SlabTypeParams> | undefined;
  readonly params: SlabParams;
}

export class AssignSlabTypeCommand extends AssignTypeCommandBase<SlabTypeAssignment> {
  readonly name = 'AssignSlabType';
  readonly type = 'assign-slab-type';

  protected applyState(state: SlabTypeAssignment): void {
    const geometry: SlabGeometry = computeSlabGeometry(state.params);
    this.applyResolvedState(state, geometry, validateSlabParams(state.params).bimValidation);
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign slab type (${this.next.typeId})`
      : 'Clear slab type';
  }

  validate(): string | null {
    if (!this.entityId) return 'Slab entity ID is required';
    if (this.next.params.thickness <= 0) return 'thickness must be > 0';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return this.assignData('slabId');
  }
}
