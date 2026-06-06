/**
 * Auto-type-on-create policy (Revit «Generic Wall») — pure SSoT (ADR-412).
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * Region walls («Τοίχος σε περιοχή») and manual walls with an explicit thickness
 * are born WITHOUT a `dna`, so `resolveAutoWallTypeId` leaves them untyped → no
 * «Edit Type», no mass layer-edit, no «type always wins». Revit never has an
 * untyped wall: an arbitrary cross-section becomes a shared «Generic - {X}mm»
 * type, so two walls of the same thickness share ONE editable type (one edit
 * re-flows to all).
 *
 * This module is the React-free, deterministic core of that policy. The host
 * hook (`useWallAutoTyping`) wires it to the store + service + enterprise-id.
 *
 *   - SAME thickness ⇒ SAME type (grouping key = category + nominal-mm thickness).
 *   - When the thickness already equals a category's built-in default, the wall
 *     is linked to the read-only built-in instead (so a 250 mm region wall and a
 *     2-click default wall group together — cross-method consistency).
 *   - Otherwise a `'auto'`-origin, persisted, DIRECTLY-EDITABLE type is minted.
 *
 * @see ./built-in-types.ts §getBuiltInWallTypeId
 * @see ../types/wall-dna-types.ts §buildGenericWallDna §getDefaultDnaForCategory
 * @see ./useWallAutoTyping.ts — the host that mints + persists the auto-type
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { buildGenericWallDna, getDefaultDnaForCategory } from '../types/wall-dna-types';
import type { WallCategory } from '../types/wall-types';
import type { BimFamilyType, WallTypeParams } from '../types/bim-family-type';
import { getBuiltInWallTypeId } from './built-in-types';

/**
 * i18n key (NOT a literal) stored as the `name` of every auto wall type. The UI
 * resolves it via `resolveTypeDisplayName`, interpolating the `thickness` —
 * exactly how built-in names are stable keys (SOS N.11, no user-facing literal).
 */
export const AUTO_WALL_TYPE_NAME_KEY = 'auto.wall.generic';

/**
 * Nominal thickness (mm) used for BOTH grouping and the stored type thickness.
 * Region thicknesses are geometric floats; rounding to the nearest mm makes
 * same-intent walls share one type (Revit walls are nominal-thickness too).
 */
export function roundThicknessMm(thicknessMm: number): number {
  return Math.round(thicknessMm);
}

/**
 * Deterministic grouping signature for an auto wall type — `category` + nominal
 * thickness. Two walls with the same signature share one type.
 */
export function resolveAutoWallTypeSignature(
  category: WallCategory,
  thicknessMm: number,
): string {
  return `wall:${category}:${roundThicknessMm(thicknessMm)}`;
}

/**
 * The read-only **built-in** wall type id this cross-section should reuse, or
 * `undefined` when no built-in matches (→ a generic auto-type is needed). A
 * built-in matches when the nominal thickness equals the category default's
 * total thickness — covers region/manual walls (no `dna`) whose thickness
 * happens to equal a standard wall, so they group with 2-click default walls.
 */
export function resolveAutoWallTypeIdForSignature(
  category: WallCategory,
  thicknessMm: number,
): string | undefined {
  const def = getDefaultDnaForCategory(category);
  return roundThicknessMm(thicknessMm) === def.totalThickness
    ? getBuiltInWallTypeId(category)
    : undefined;
}

/**
 * Finds an existing `'auto'`-origin wall type in `types` matching the
 * signature (same category + nominal thickness), or `null`. The synchronous
 * store scan that makes find-or-create idempotent within a draw batch.
 */
export function findAutoWallType(
  types: readonly BimFamilyType[],
  category: WallCategory,
  thicknessMm: number,
): BimFamilyType<'wall'> | null {
  const nominal = roundThicknessMm(thicknessMm);
  for (const t of types) {
    if (t.category !== 'wall' || t.origin !== 'auto') continue;
    const tp = t.typeParams as WallTypeParams;
    if (tp.category === category && roundThicknessMm(tp.thickness) === nominal) {
      return t as BimFamilyType<'wall'>;
    }
  }
  return null;
}

/**
 * Builds the `BimFamilyType<'wall'>` for a generic auto-type with a caller-minted
 * (enterprise) `id`. Pure: the host generates the id + persists the result. The
 * thickness is stored nominal (rounded) so the type and its grouping agree.
 */
export function buildAutoWallType(
  id: string,
  category: WallCategory,
  thicknessMm: number,
  companyId: string,
  ownerId: string,
): BimFamilyType<'wall'> {
  const thickness = roundThicknessMm(thicknessMm);
  const typeParams: WallTypeParams = {
    category,
    thickness,
    dna: buildGenericWallDna(category, thickness),
  };
  return {
    id,
    category: 'wall',
    name: AUTO_WALL_TYPE_NAME_KEY,
    scope: 'company',
    origin: 'auto',
    typeParams,
    companyId,
    ownerId,
  };
}
