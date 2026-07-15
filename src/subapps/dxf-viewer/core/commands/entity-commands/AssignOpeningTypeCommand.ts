/**
 * ASSIGN OPENING TYPE COMMAND — ADR-421 SLICE C (BIM Family Types for openings).
 *
 * Sets an opening instance's family-type linkage (`typeId` + per-param
 * `typeOverrides`) AND folds the resolved effective params back onto the entity
 * atomically. The caller resolves the effective params up-front (via
 * `resolveEffectiveOpeningParams`, «type always wins»); this command patches the
 * entity and recomputes the DERIVED state so the renderer never diverges from the
 * parametric source of truth — the opening analogue of `AssignWallTypeCommand`:
 *   - `geometry`     via `computeOpeningGeometry` (host-wall relative),
 *   - `validation`   via `validateOpeningParams`,
 *   - `kind`/`ifcType` kept in lock-step with `params.kind` (a Type can switch
 *     the family → 2D symbol/3D mesh/IFC routing follow, ADR-421 SLICE B), and
 *   - `operationType` re-derived from the (possibly type-governed) `kind` + the
 *     instance `handing` via `resolveOperationType` (IFC4 export fidelity).
 *
 * Unlike the wall command there is NO hosted-element cascade — openings are not
 * hosts. The host is re-resolved on each execute/undo/redo (via
 * `computeOpeningDerivedState`) so geometry stays correct even if the wall is
 * edited between actions. ADR-615: the host is a BIM wall (`params.wallId`) OR a
 * synthetic self-host (`params.selfHost`) for a free-standing κούφωμα; both
 * branches recompute geometry. Soft-orphan policy (ADR-363 §5.4): a wall-hosted
 * opening whose host is missing → intrinsic validation only, geometry untouched.
 *
 * Covers every type-link mutation: assign, clear (detach, params kept), and
 * set/clear per-param override. Discrete undo step (NO merge) — a type
 * assignment is a deliberate action, never a drag sample.
 *
 * @see bim/family-types/resolve-effective-params.ts — effective-param SSoT
 * @see core/commands/entity-commands/AssignWallTypeCommand.ts — wall sibling
 * @see core/commands/entity-commands/UpdateOpeningParamsCommand.ts — geometry path
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import type { ISceneManager } from '../interfaces';
import type { OpeningParams } from '../../../bim/types/opening-types';
import type { OpeningTypeParams } from '../../../bim/types/bim-family-type';
import { resolveOperationType } from '../../../bim/types/opening-operation-types';
import { AssignTypeCommandBase } from './assign-type-command-base';
import { applyOpeningDerivedPatch, validateOpeningHostRef } from './opening-derived-state';
import type { SceneUnits } from '../../../utils/scene-units';

/** Immutable snapshot of an opening's family-type link + cached params. */
export interface OpeningTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<OpeningTypeParams> | undefined;
  readonly params: OpeningParams;
}

export class AssignOpeningTypeCommand extends AssignTypeCommandBase<OpeningTypeAssignment> {
  readonly name = 'AssignOpeningType';
  readonly type = 'assign-opening-type';

  constructor(
    openingId: string,
    next: OpeningTypeAssignment,
    previous: OpeningTypeAssignment,
    sceneManager: ISceneManager,
    // ADR-615 — a self-hosted opening has no host wall to read the mm↔scene
    // factor from; canonical-mm scenes default to 'mm' (mirrors the sibling
    // `UpdateOpeningParamsCommand`).
    private readonly sceneUnits: SceneUnits = 'mm',
  ) {
    super(openingId, next, previous, sceneManager);
  }

  protected applyState(state: OpeningTypeAssignment): void {
    // Re-derive the IFC operation from the (possibly type-governed) kind +
    // instance handing — a family swap via the Type must re-flow operationType.
    const params: OpeningParams = {
      ...state.params,
      operationType: resolveOperationType(state.params.kind, state.params.handing),
    };
    // `typeId`/`typeOverrides` are set explicitly (incl. to `undefined`) so undo
    // can restore the untyped/ad-hoc state — a spread merge cannot delete a key.
    // ADR-615 — the shared writer resolves the host (wall OR self-host) and
    // rebuilds geometry/validation in ONE place, so a self-hosted family-type
    // assign no longer falls through to soft-orphan and keeps stale geometry.
    applyOpeningDerivedPatch(this.sceneManager, this.entityId, params, this.sceneUnits, {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
    });
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign opening type (${this.next.typeId})`
      : 'Clear opening type';
  }

  validate(): string | null {
    if (!this.entityId) return 'Opening entity ID is required';
    // ADR-615 — an opening is hosted by EXACTLY ONE of `wallId` / `selfHost`.
    // Requiring `wallId` unconditionally silently rejected every family-type
    // assign/clear on a self-hosted opening (mirrors the same fix already made
    // in `UpdateOpeningParamsCommand`).
    const hostError = validateOpeningHostRef(this.next.params);
    if (hostError) return hostError;
    if (this.next.params.width <= 0) return 'width must be > 0';
    if (this.next.params.height <= 0) return 'height must be > 0';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return this.assignData('openingId');
  }
}
