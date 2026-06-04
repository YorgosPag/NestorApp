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

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { SlabGeometry, SlabParams } from '../../../bim/types/slab-types';
import type { SlabTypeParams } from '../../../bim/types/bim-family-type';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../../bim/validators/slab-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Immutable snapshot of a slab's family-type link + cached params. */
export interface SlabTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<SlabTypeParams> | undefined;
  readonly params: SlabParams;
}

export class AssignSlabTypeCommand implements ICommand {
  readonly id: string;
  readonly name = 'AssignSlabType';
  readonly type = 'assign-slab-type';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly slabId: string,
    private readonly next: SlabTypeAssignment,
    private readonly previous: SlabTypeAssignment,
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

  private applyState(state: SlabTypeAssignment): void {
    const geometry: SlabGeometry = computeSlabGeometry(state.params);
    const validation = validateSlabParams(state.params).bimValidation;
    // `typeId`/`typeOverrides` are set explicitly (incl. to `undefined`) so undo
    // can restore the untyped/ad-hoc state — a spread merge cannot delete a key.
    this.sceneManager.updateEntity(this.slabId, {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
      params: state.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign slab type (${this.next.typeId})`
      : 'Clear slab type';
  }

  getAffectedEntityIds(): string[] {
    return [this.slabId];
  }

  validate(): string | null {
    if (!this.slabId) return 'Slab entity ID is required';
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
        slabId: this.slabId,
        next: this.next,
        previous: this.previous,
      },
      version: 1,
    };
  }
}
