/**
 * wall-attach-detach.ts — wall-typed thin wrappers over the generic
 * `entity-attach-detach` SSoT.
 *
 * ADR-401 (Wall Top/Base Constraints — Attach to Structural).
 *
 * The binding-reset logic now lives ONCE in `bim/entities/entity-attach-detach.ts`
 * (shared by wall + column — Phase F.3 Boy-Scout, N.0.2). This module re-exports it
 * typed for `WallParams` so the existing wall consumers
 * (`DetachWallsCommand`, `bim3d-resize-bridge`, `dispatchWallParamPatch`) keep their
 * imports unchanged.
 *
 * @see bim/entities/entity-attach-detach.ts — the generic SSoT
 * @see core/commands/entity-commands/DetachWallsCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */

import type { WallParams } from '../types/wall-types';
import {
  detachEntitySide,
  isEntitySideAttached,
  detachSidesAffectedByVerticalEdit as detachSidesGeneric,
  type EntityAttachSide,
} from '../entities/entity-attach-detach';

/** Which vertical side of a wall is attached / being detached. */
export type WallAttachSide = EntityAttachSide;

/** Reset the side-specific binding to its default + clear its host list (wall). */
export function detachWallSide(params: WallParams, side: WallAttachSide): WallParams {
  return detachEntitySide(params, side);
}

/** True when the wall's given vertical side is currently attached to a structural host. */
export function isWallSideAttached(params: WallParams, side: WallAttachSide): boolean {
  return isEntitySideAttached(params, side);
}

/**
 * ADR-401 Phase E.4 — «manual vertical edit breaks attach» (Revit semantics), wall.
 *
 * Full-params variant: pass the previous params and the proposed next params
 * (already merged with the edit). Resets the binding of any vertical side whose
 * driving scalar the edit changed while that side is attached (`height` → top,
 * `baseOffset` → base). Pure — returns `next` untouched otherwise.
 */
export function detachSidesAffectedByVerticalEdit(prev: WallParams, next: WallParams): WallParams {
  return detachSidesGeneric(prev, next);
}
