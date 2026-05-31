/**
 * entity-attach-detach.ts — SSoT for resetting a BIM entity's top/base attach binding.
 *
 * ADR-401 (Wall/Column Top/Base Constraints — Attach to Structural), Phase F.3 Boy-Scout.
 *
 * Pure (no scene, no command, no React). ONE place owns the «detach» reset for ANY
 * entity whose vertical extent uses the Revit-style hybrid binding (wall + column —
 * the binding fields are identical, and `ColumnTopBinding`/`ColumnBaseBinding` are
 * aliases of the wall unions in `bim-binding.ts`). Generalises the wall-only
 * `wall-attach-detach.ts` (which now re-exports these typed for `WallParams`).
 *
 * Consumed by:
 *   • `DetachWallsCommand` / `DetachColumnsCommand` (manual ribbon detach),
 *   • the 3D vertical grips (`bim3d-resize-bridge`, Revit "edit breaks attach":
 *     dragging the top/base while attached detaches first),
 *   • the manual height/baseOffset edit break (ribbon / panel dispatchers).
 *
 * @see bim/walls/wall-attach-detach.ts — wall-typed thin wrappers
 * @see core/commands/entity-commands/DetachWallsCommand.ts / DetachColumnsCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5 §5 (Phase F)
 */

import {
  DEFAULT_WALL_TOP_BINDING,
  DEFAULT_WALL_BASE_BINDING,
  type WallTopBinding,
  type WallBaseBinding,
} from '../types/bim-binding';

/** Which vertical side of an entity is attached / being detached. */
export type EntityAttachSide = 'top' | 'base';

/**
 * Structural subset of the params an attachable BIM entity exposes. Both
 * `WallParams` and `ColumnParams` satisfy this (same field names; binding types
 * are aliases). The detach helpers are generic over this shape so the binding
 * reset lives in ONE place.
 */
export interface VerticalAttachParams {
  readonly topBinding: WallTopBinding;
  readonly baseBinding: WallBaseBinding;
  readonly attachTopToIds?: readonly string[];
  readonly attachBaseToIds?: readonly string[];
  /** mm. Top extent driver (a manual edit of it breaks a top attach). */
  readonly height: number;
  /** mm. Base extent driver (a manual edit of it breaks a base attach). */
  readonly baseOffset: number;
}

/**
 * Reset the side-specific binding to its default + clear its host list.
 * UNCONDITIONAL — the manual «Detach» button always resets. Callers that should
 * only act when actually attached (the 3D grip's "edit breaks attach") guard
 * with `isEntitySideAttached` first. Returns a fresh object preserving `T`.
 */
export function detachEntitySide<T extends VerticalAttachParams>(params: T, side: EntityAttachSide): T {
  return side === 'top'
    ? { ...params, topBinding: DEFAULT_WALL_TOP_BINDING, attachTopToIds: undefined }
    : { ...params, baseBinding: DEFAULT_WALL_BASE_BINDING, attachBaseToIds: undefined };
}

/** True when the entity's given vertical side is currently attached to a structural host. */
export function isEntitySideAttached(params: VerticalAttachParams, side: EntityAttachSide): boolean {
  return side === 'top' ? params.topBinding === 'attached' : params.baseBinding === 'attached';
}

/**
 * ADR-401 — «manual vertical edit breaks attach» (Revit semantics), full-params variant.
 *
 * Given the previous params and the proposed next params (already merged with the
 * edit), reset the binding of any vertical side whose driving scalar the edit
 * changed while that side is attached:
 *   • `height`     → top side (the top extent driver),
 *   • `baseOffset` → base side (the base extent driver).
 *
 * An explicit numeric edit wins over the structural follow. Pure — returns `next`
 * untouched when neither driver changed or the side isn't attached. Works on full
 * params (the column ribbon writes a full `ColumnParams`; the wall dispatcher
 * merges its patch first and passes the merged result as `next`).
 */
export function detachSidesAffectedByVerticalEdit<T extends VerticalAttachParams>(
  prev: VerticalAttachParams,
  next: T,
): T {
  let result = next;
  if (next.height !== prev.height && isEntitySideAttached(result, 'top')) {
    result = detachEntitySide(result, 'top');
  }
  if (next.baseOffset !== prev.baseOffset && isEntitySideAttached(result, 'base')) {
    result = detachEntitySide(result, 'base');
  }
  return result;
}
