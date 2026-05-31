/**
 * wall-attach-detach.ts — SSoT for resetting a wall's top/base attach binding.
 *
 * ADR-401 (Wall Top/Base Constraints — Attach to Structural).
 *
 * Pure (no scene, no command, no React). One place owns the «detach» reset:
 * restore the side's binding to its default (`storey-ceiling` for top /
 * `storey-floor` for base) and clear the host id list (`attachTopToIds` /
 * `attachBaseToIds`). Consumed by:
 *   • `DetachWallsCommand` (Phase E.1 — manual ribbon detach),
 *   • the 3D vertical grip (`bim3d-resize-bridge`, Phase E.3 — Revit
 *     "edit breaks attach": dragging the top/base while attached detaches first),
 *   • the manual height/base edit break (Phase E.4 — same reset on ribbon edit).
 *
 * @see core/commands/entity-commands/DetachWallsCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */

import type { WallParams } from '../types/wall-types';
import {
  DEFAULT_WALL_TOP_BINDING,
  DEFAULT_WALL_BASE_BINDING,
} from '../types/bim-binding';

/** Which vertical side of a wall is attached / being detached. */
export type WallAttachSide = 'top' | 'base';

/**
 * Reset the side-specific binding to its default + clear its host list.
 * UNCONDITIONAL — the manual «Detach» button (`DetachWallsCommand`) always resets.
 * Callers that should only act when actually attached (the 3D grip's
 * Revit "edit breaks attach") guard with `isWallSideAttached` first.
 */
export function detachWallSide(params: WallParams, side: WallAttachSide): WallParams {
  return side === 'top'
    ? { ...params, topBinding: DEFAULT_WALL_TOP_BINDING, attachTopToIds: undefined }
    : { ...params, baseBinding: DEFAULT_WALL_BASE_BINDING, attachBaseToIds: undefined };
}

/** True when the wall's given vertical side is currently attached to a structural host. */
export function isWallSideAttached(params: WallParams, side: WallAttachSide): boolean {
  return side === 'top' ? params.topBinding === 'attached' : params.baseBinding === 'attached';
}

/**
 * ADR-401 Phase E.4 — «manual vertical edit breaks attach» (Revit semantics).
 *
 * Given a manual UI param patch, reset the binding of any vertical side whose
 * driving scalar the patch explicitly changes while that side is attached:
 *   • `height`     → top side (the top extent driver),
 *   • `baseOffset` → base side (the base extent driver).
 *
 * Mirror of the 3D vertical grip's edit-breaks-attach (Phase E.3): an explicit
 * numeric edit wins over the structural follow. Pure — returns `params`
 * untouched when the patch touches neither driver or the side isn't attached.
 * Wire this BEFORE merging the patch so the detached binding survives the merge
 * (the patch never carries binding/host-id keys).
 */
export function detachSidesAffectedByVerticalEdit(
  params: WallParams,
  patch: Partial<WallParams>,
): WallParams {
  let next = params;
  if (
    patch.height !== undefined &&
    patch.height !== params.height &&
    isWallSideAttached(next, 'top')
  ) {
    next = detachWallSide(next, 'top');
  }
  if (
    patch.baseOffset !== undefined &&
    patch.baseOffset !== params.baseOffset &&
    isWallSideAttached(next, 'base')
  ) {
    next = detachWallSide(next, 'base');
  }
  return next;
}
