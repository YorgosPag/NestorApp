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
 * hosts. The host wall is re-resolved on each execute/undo/redo so geometry
 * stays correct even if the wall is edited between actions (soft-orphan policy,
 * ADR-363 §5.4: missing host → intrinsic validation only).
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

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { OpeningGeometry, OpeningParams } from '../../../bim/types/opening-types';
import type { OpeningTypeParams } from '../../../bim/types/bim-family-type';
import type { WallEntity } from '../../../bim/types/wall-types';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import { resolveOperationType } from '../../../bim/types/opening-operation-types';
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Immutable snapshot of an opening's family-type link + cached params. */
export interface OpeningTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<OpeningTypeParams> | undefined;
  readonly params: OpeningParams;
}

export class AssignOpeningTypeCommand implements ICommand {
  readonly id: string;
  readonly name = 'AssignOpeningType';
  readonly type = 'assign-opening-type';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly openingId: string,
    private readonly next: OpeningTypeAssignment,
    private readonly previous: OpeningTypeAssignment,
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

  private applyState(state: OpeningTypeAssignment): void {
    // Re-derive the IFC operation from the (possibly type-governed) kind +
    // instance handing — a family swap via the Type must re-flow operationType.
    const params: OpeningParams = {
      ...state.params,
      operationType: resolveOperationType(state.params.kind, state.params.handing),
    };
    const host = this.resolveHostWall(params.wallId);
    // `typeId`/`typeOverrides` are set explicitly (incl. to `undefined`) so undo
    // can restore the untyped/ad-hoc state — a spread merge cannot delete a key.
    // `kind`/`ifcType` kept in lock-step with params.kind (renderer/IFC routing).
    const patch: Record<string, unknown> = {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
      params,
      kind: params.kind,
      ifcType: inferOpeningIfcType(params.kind),
    };
    if (host) {
      const geometry: OpeningGeometry = computeOpeningGeometry(
        params,
        host,
        host.params.sceneUnits ?? 'mm',
      );
      patch.geometry = geometry;
      patch.validation = validateOpeningParams(params, host).bimValidation;
    } else {
      // Soft-orphan: intrinsic validation only (no host-relative checks).
      patch.validation = validateOpeningParams(params, null).bimValidation;
    }
    this.sceneManager.updateEntity(this.openingId, patch as Partial<SceneEntity>);
  }

  private resolveHostWall(wallId: string): WallEntity | null {
    const raw = this.sceneManager.getEntity(wallId);
    if (!raw) return null;
    const candidate = raw as unknown as Partial<WallEntity>;
    if (candidate.type !== 'wall' || !candidate.params || !candidate.geometry) return null;
    return candidate as WallEntity;
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign opening type (${this.next.typeId})`
      : 'Clear opening type';
  }

  getAffectedEntityIds(): string[] {
    return [this.openingId];
  }

  validate(): string | null {
    if (!this.openingId) return 'Opening entity ID is required';
    if (!this.next.params.wallId) return 'Opening params.wallId is required';
    if (this.next.params.width <= 0) return 'width must be > 0';
    if (this.next.params.height <= 0) return 'height must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        openingId: this.openingId,
        next: this.next,
        previous: this.previous,
      },
      version: 1,
    };
  }
}
