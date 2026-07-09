/**
 * @module core/commands/entity-commands/assign-type-command-base
 * @description Template-Method base (SSoT) for `Assign<X>TypeCommand` — the BIM
 * Family-Type link writers (wall / slab / roof / opening).
 *
 * Every `Assign*TypeCommand` sets an instance's family-type linkage
 * (`typeId` + per-param `typeOverrides`) AND folds the resolved effective params
 * back onto the entity, recomputing the DERIVED geometry/validation so the
 * renderer never diverges from the parametric source of truth. The caller
 * resolves the effective params up-front («type always wins»); the command just
 * applies a full `next`/`previous` state.
 *
 * Discrete undo step (NO merge): a type assignment is a deliberate user action,
 * never a drag sample. The base owns the `next`/`previous` state machine
 * (`execute → applyState(next)`, `undo → applyState(previous)`, `redo` re-runs
 * execute); a concrete command supplies only {@link applyState} (its domain
 * geometry recompute) plus identity/validation/serialize payload.
 *
 * Adopts the generic {@link BaseCommand} root (id/timestamp/`redo`/`serialize`
 * envelope + no-merge default).
 *
 * @see ADR-617 (entity-command SSoT)
 * @see bim/family-types/resolve-effective-params.ts — effective-param SSoT
 * @see ./AssignWallTypeCommand.ts ./AssignSlabTypeCommand.ts — reference leaves
 * @since 2026-07-09
 */

import type { ISceneManager } from '../interfaces';
import { BaseCommand } from '../base-command';

/** The common shape every `Assign*TypeCommand` snapshot shares (ADR-412/417/421). */
export interface FamilyTypeAssignmentState {
  readonly typeId: string | undefined;
  readonly typeOverrides: unknown;
  readonly params: unknown;
}

/**
 * Abstract base for a family-type assignment command.
 *
 * @typeParam TState the immutable `{typeId, typeOverrides, params}` snapshot.
 */
export abstract class AssignTypeCommandBase<
  TState extends FamilyTypeAssignmentState,
> extends BaseCommand {
  private wasExecuted = false;

  constructor(
    protected readonly entityId: string,
    protected readonly next: TState,
    protected readonly previous: TState,
    protected readonly sceneManager: ISceneManager,
  ) {
    super();
  }

  /**
   * Fold `state` (typeId/typeOverrides/params + the recomputed DERIVED
   * geometry/validation) onto the entity. Symmetric — called with `next`
   * (execute/redo) and `previous` (undo).
   */
  protected abstract applyState(state: TState): void;

  execute(): void {
    this.applyState(this.next);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyState(this.previous);
  }
  // redo() inherited from BaseCommand → execute() → applyState(next).

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /**
   * Fold the type link (`typeId`/`typeOverrides`/`params`) plus the caller-
   * recomputed DERIVED `geometry`/`validation` onto the entity. `typeId`/
   * `typeOverrides` are written explicitly (incl. `undefined`) so undo can
   * restore the untyped/ad-hoc state — a spread merge cannot delete a key.
   */
  protected applyResolvedState(state: TState, geometry: unknown, validation: unknown): void {
    this.sceneManager.updateEntity(this.entityId, {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
      params: state.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  /**
   * Canonical serialized `data` payload. A subclass passes its domain id key
   * (`wallId`/`slabId`/…) and any genuine extra state (e.g. wall `kind`) so the
   * persisted envelope shape is preserved byte-for-byte.
   */
  protected assignData(idKey: string, extra?: Record<string, unknown>): Record<string, unknown> {
    return { [idKey]: this.entityId, next: this.next, previous: this.previous, ...extra };
  }
}
