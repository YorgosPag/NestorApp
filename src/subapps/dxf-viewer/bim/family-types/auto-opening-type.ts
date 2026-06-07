/**
 * Auto-type-on-create policy for openings (Revit «Generic») — pure SSoT (ADR-421
 * SLICE C / ADR-412).
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * Revit never has a fully type-less door/window: placing one picks a loaded
 * Type. To give freshly-drawn openings that behaviour WITHOUT a seeding step,
 * an opening whose nominal `kind` + `width` + `height` equal the kind default is
 * linked to the read-only **built-in** opening type (`getBuiltInOpeningTypeId`).
 * It then gains «Edit Type», live propagation and «type always wins» for free.
 *
 * Unlike walls, openings carry no layered cross-section (`dna`), so there is
 * nothing to mint a per-dimension generic type FROM: an opening with custom
 * dimensions simply stays ad-hoc (`typeId === undefined`) and flows through the
 * legacy fast-path of `resolveEffectiveOpeningParams` (zero regression). The user
 * can still Duplicate-to-edit a built-in to capture custom dimensions as a named
 * Type.
 *
 * This module is React-free + deterministic: the same params yield the same id
 * on every call (no wall-clock / random). Used at opening hydrate + creation.
 *
 * @see ./built-in-types.ts §getBuiltInOpeningTypeId §getBuiltInOpeningTypes
 * @see ../types/opening-types.ts §OPENING_KIND_DEFAULTS
 * @see ./resolve-effective-params.ts §resolveEffectiveOpeningParams
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { OPENING_KIND_DEFAULTS, type OpeningKind } from '../types/opening-types';
import { getBuiltInOpeningTypeId } from './built-in-types';

/** Nominal dimensions used for built-in matching (mm, rounded to nearest mm). */
function roundMm(mm: number): number {
  return Math.round(mm);
}

/**
 * The read-only **built-in** opening type id this placement should reuse, or
 * `undefined` when no built-in matches (→ opening stays ad-hoc / untyped). A
 * built-in matches when the nominal `width` AND `height` equal the `kind`
 * default (`OPENING_KIND_DEFAULTS`). Non-destructive: a custom-dimensioned
 * opening is never force-typed.
 */
export function resolveAutoOpeningTypeId(params: {
  readonly kind: OpeningKind;
  readonly width: number;
  readonly height: number;
}): string | undefined {
  const def = OPENING_KIND_DEFAULTS[params.kind];
  const matches =
    roundMm(params.width) === def.width &&
    roundMm(params.height) === def.height;
  return matches ? getBuiltInOpeningTypeId(params.kind) : undefined;
}
