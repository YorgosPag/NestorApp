/**
 * stair-attach-detach.ts — stair-typed wrappers over the generic attach/detach SSoT.
 *
 * ADR-401 (Wall/Column/Stair Top/Base Constraints — Attach to Structural), Phase G.3.
 *
 * Pure (no scene, no command, no React). Mirror του `wall-attach-detach.ts`, αλλά
 * με **stair-honest defaults**: top → 'unconnected' (το ύψος οδηγείται από τα
 * σκαλοπάτια, `rise × stepCount`, ΟΧΙ ταβάνι ορόφου), base → 'storey-floor'. Η
 * γενική επαναφορά binding ζει στο `entity-attach-detach.ts` — εδώ απλώς δένεται
 * με τα stair defaults + προστίθεται ο stair-specific edit-break driver mapping.
 *
 * Driver mapping (Revit «edit breaks attach»):
 *   - top side  → ο οδηγός είναι τα σκαλοπάτια (`totalRise` / `rise` / `stepCount`).
 *     Manual αλλαγή τους = ο χρήστης override-άρει το host-driven re-step → detach top.
 *   - base side → ο οδηγός είναι το `basePoint.z` (ή `offsetFromStorey`). Manual
 *     αλλαγή = override του host top-face → detach base.
 *
 * @see bim/entities/entity-attach-detach.ts — generic binding-reset SSoT
 * @see bim/walls/wall-attach-detach.ts — ο δίδυμος του τοίχου (height/baseOffset drivers)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 */

import type { StairParams } from '../types/stair-types';
import { DEFAULT_STAIR_TOP_BINDING, DEFAULT_STAIR_BASE_BINDING } from '../types/bim-binding';
import {
  detachEntitySide,
  isEntitySideAttached,
  type EntityAttachSide,
  type AttachDetachDefaults,
} from '../entities/entity-attach-detach';

/** Stair detach defaults — top falls back to 'unconnected' (step-count driven), base to FFL. */
const STAIR_ATTACH_DETACH_DEFAULTS: AttachDetachDefaults = {
  top: DEFAULT_STAIR_TOP_BINDING,
  base: DEFAULT_STAIR_BASE_BINDING,
};

/** Reset the stair's side binding to its stair-honest default + clear its host list. */
export function detachStairSide(params: StairParams, side: EntityAttachSide): StairParams {
  return detachEntitySide(params, side, STAIR_ATTACH_DETACH_DEFAULTS);
}

/** True when the stair's given vertical side is currently attached to a structural host. */
export function isStairSideAttached(params: StairParams, side: EntityAttachSide): boolean {
  return isEntitySideAttached(params, side);
}

/**
 * ADR-401 — «manual vertical edit breaks attach» (Revit semantics), stair variant.
 *
 * Given the previous params and the proposed next (already merged with the edit),
 * detach any side whose stair driver the edit changed while that side is attached:
 *   - `totalRise` / `rise` / `stepCount` changed → top side (the climb driver),
 *   - `basePoint.z` / `offsetFromStorey` changed → base side (the base elevation driver).
 *
 * Pure — returns `next` untouched when no driver changed or the side isn't attached.
 */
export function detachStairSidesAffectedByVerticalEdit(
  prev: StairParams,
  next: StairParams,
): StairParams {
  let result = next;
  const topDriverChanged =
    next.totalRise !== prev.totalRise ||
    next.rise !== prev.rise ||
    next.stepCount !== prev.stepCount;
  if (topDriverChanged && isStairSideAttached(result, 'top')) {
    result = detachStairSide(result, 'top');
  }
  const baseDriverChanged =
    next.basePoint.z !== prev.basePoint.z ||
    next.offsetFromStorey !== prev.offsetFromStorey;
  if (baseDriverChanged && isStairSideAttached(result, 'base')) {
    result = detachStairSide(result, 'base');
  }
  return result;
}
