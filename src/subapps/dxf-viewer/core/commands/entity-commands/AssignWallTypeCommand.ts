/**
 * ASSIGN WALL TYPE COMMAND — ADR-412 Φ4 (BIM Family Types UI).
 *
 * Sets a wall instance's family-type linkage (`typeId` + per-param
 * `typeOverrides`) AND folds the resolved effective params back onto the entity
 * atomically. The caller resolves the effective params up-front (via
 * `resolveEffectiveWallParams`, «type always wins»); this command just patches
 * the entity and recomputes `geometry` + `validation` so the renderer never
 * diverges from the parametric source of truth — exactly like
 * `UpdateWallParamsCommand`, but it ALSO carries the two top-level family-type
 * fields (`typeId`/`typeOverrides`) which `UpdateWallParamsCommand` does not own.
 *
 * Covers every Φ4 mutation that touches the type link:
 *   - assign a type      → next typeId set, params resolved from the type,
 *   - clear (detach)     → next typeId `undefined`, params kept (non-destructive),
 *   - set/clear override → next typeOverrides changed, params re-resolved.
 *
 * Discrete undo step (NO merge): a type assignment is a deliberate user action,
 * never a drag sample, so consecutive assignments stay separate history entries.
 *
 * @see bim/family-types/resolve-effective-params.ts — effective-param SSoT
 * @see core/commands/entity-commands/UpdateWallParamsCommand.ts — sibling pattern
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.3 §3.4
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import type { WallTypeParams } from '../../../bim/types/bim-family-type';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
// ADR-363 §5.4 — after the wall geometry is patched, every hosted opening is
// recomputed atomically so it follows the wall (same SSoT as the param command).
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';

/** Immutable snapshot of a wall's family-type link + cached params. */
export interface WallTypeAssignment {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<WallTypeParams> | undefined;
  readonly params: WallParams;
}

export class AssignWallTypeCommand implements ICommand {
  readonly id: string;
  readonly name = 'AssignWallType';
  readonly type = 'assign-wall-type';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly wallId: string,
    private readonly next: WallTypeAssignment,
    private readonly previous: WallTypeAssignment,
    private readonly sceneManager: ISceneManager,
    private readonly kind: WallKind = 'straight',
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

  private applyState(state: WallTypeAssignment): void {
    const geometry: WallGeometry = computeWallGeometry(state.params, this.kind);
    const validation = validateWallParams(state.params).bimValidation;
    // `typeId`/`typeOverrides` are set explicitly (incl. to `undefined`) so undo
    // can restore the untyped/ad-hoc state — a spread merge cannot delete a key.
    this.sceneManager.updateEntity(this.wallId, {
      typeId: state.typeId,
      typeOverrides: state.typeOverrides,
      params: state.params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
    // ADR-363 §5.4 — recompute hosted openings against the now-updated wall.
    cascadeHostedOpeningsForWalls([this.wallId], this.sceneManager);
  }

  getDescription(): string {
    return this.next.typeId
      ? `Assign wall type (${this.next.typeId})`
      : 'Clear wall type';
  }

  getAffectedEntityIds(): string[] {
    return [this.wallId];
  }

  validate(): string | null {
    if (!this.wallId) return 'Wall entity ID is required';
    if (this.next.params.thickness <= 0) return 'thickness must be > 0';
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
        wallId: this.wallId,
        next: this.next,
        previous: this.previous,
        kind: this.kind,
      },
      version: 1,
    };
  }
}
