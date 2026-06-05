/**
 * Roof auto-typing policy (ADR-417 §10 #3) — the SINGLE source of truth that
 * decides which built-in roof family type a freshly-drawn or freshly-loaded roof
 * should be linked to. Roof analogue of `slab-type-auto-assign.ts`.
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * The composite build-up lives on the TYPE (Revit «Roof → Edit Type»). A roof
 * shows its layers only when linked to a roof type whose `dna` re-flows into the
 * instance («type always wins»). This policy gives every roof whose cross-section
 * still matches a built-in build-up the read-only built-in type of that build-up,
 * so selection → resolution → per-layer 3D rendering all work.
 *
 * ─── NON-DESTRUCTIVE (locked, mirror slab «Read-only built-in + Duplicate-to-edit») ─
 * We auto-assign a built-in id ONLY when the roof's type-governed params still
 * MATCH a built-in build-up (identical `thickness` + deep-equal `dna`). A bare
 * monolithic roof (`dna` absent) — or one with a customised build-up — returns
 * `undefined` and stays ad-hoc/untyped, so resolution NEVER snaps its geometry
 * back to a built-in default. The default new roof carries the concrete δώμα
 * build-up, so it auto-links to the built-in concrete roof type (zero visual
 * change on assignment).
 *
 * Pure + deterministic: no store read, no time/random — the built-in id is a
 * fixed string and the build-ups are the roof-build-up SSoT. Both the creation
 * path (`hooks/drawing/roof-completion.ts`) and the load path
 * (`bim/roofs/roof-firestore-service.ts docToEntity`) call this one function.
 *
 * @see ./built-in-types.ts §getBuiltInRoofTypeId
 * @see ../types/roof-buildup.ts §getRoofBuildupForKey / ROOF_BUILDUP_KEYS
 * @see ./slab-type-auto-assign.ts — the slab sibling
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { dequal } from 'dequal';
import { getRoofBuildupForKey, ROOF_BUILDUP_KEYS } from '../types/roof-buildup';
import type { RoofParams } from '../types/roof-types';
import { getBuiltInRoofTypeId } from './built-in-types';

/**
 * The built-in roof family-type id this roof should be linked to, or `undefined`
 * when the roof must stay ad-hoc/untyped (bare monolithic / customised build-up).
 *
 * Non-destructive gate: returns an id only when the roof's `thickness` + `dna`
 * are byte-equal to a built-in build-up — so the resolved effective params are
 * identical to the cached params (zero visual change on assignment). Build-ups
 * are scanned in catalog order; the first exact match wins.
 *
 * @param params Instance params (only `thickness`/`dna` are read).
 */
export function resolveAutoRoofTypeId(
  params: Pick<RoofParams, 'thickness' | 'dna'>,
): string | undefined {
  // Bare monolithic roof (no DNA) cannot match a layered build-up — leave ad-hoc.
  if (!params.dna) return undefined;
  for (const key of ROOF_BUILDUP_KEYS) {
    const dna = getRoofBuildupForKey(key);
    if (params.thickness === dna.totalThickness && dequal(params.dna, dna)) {
      return getBuiltInRoofTypeId(key);
    }
  }
  return undefined;
}
