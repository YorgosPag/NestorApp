/**
 * Slab auto-typing policy (ADR-412) — the SINGLE source of truth that decides
 * which built-in slab family type a freshly-drawn or freshly-loaded slab should
 * be linked to. Slab analogue of `wall-type-auto-assign.ts`.
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * The composite build-up lives on the TYPE (Revit «Floor → Edit Type»). A slab
 * shows its layers only when linked to a slab type whose `dna` re-flows into the
 * instance («type always wins»). This policy gives every slab whose cross-section
 * still matches its kind default the read-only built-in type of that kind, so
 * selection → resolution → per-layer 3D rendering all work.
 *
 * ─── NON-DESTRUCTIVE (locked, mirror wall «Read-only built-in + Duplicate-to-edit») ─
 * We auto-assign the built-in id ONLY when the slab's type-governed params still
 * MATCH the kind default (identical `thickness` + deep-equal `dna`). A bare
 * single-material slab (`dna` absent, `buildDefaultSlabParams` default 200 mm) —
 * or one with a customised build-up — returns `undefined` and stays ad-hoc/
 * untyped, so resolution NEVER snaps its geometry back to the kind default. This
 * is exactly the Phase-A invariant: the bare instance default is single-layer/
 * untyped (zero regression), and only a slab carrying the kind build-up gets the
 * built-in type.
 *
 * Pure + deterministic: no store read, no time/random — the built-in id is a
 * fixed string and the default build-up is the slab-DNA SSoT. Both the creation
 * path (`hooks/drawing/slab-completion.ts buildSlabEntity`) and the load path
 * (`hooks/data/slab-persistence-helpers.ts docToEntity`) call this one function.
 *
 * @see ./built-in-types.ts §getBuiltInSlabTypeId
 * @see ../types/slab-dna-types.ts §getDefaultSlabBuildupForKind
 * @see ./wall-type-auto-assign.ts — the wall sibling
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { dequal } from 'dequal';
import { getDefaultSlabBuildupForKind } from '../types/slab-dna-types';
import type { SlabParams } from '../types/slab-types';
import { getBuiltInSlabTypeId } from './built-in-types';

/**
 * The built-in slab family-type id this slab should be linked to, or `undefined`
 * when the slab must stay ad-hoc/untyped (bare single-material / customised
 * build-up).
 *
 * Non-destructive gate: returns an id only when the slab's `thickness` + `dna`
 * are byte-equal to the kind default — so the resolved effective params are
 * identical to the cached params (zero visual change on assignment).
 *
 * @param params Instance params (only `kind`/`thickness`/`dna` are read).
 */
export function resolveAutoSlabTypeId(
  params: Pick<SlabParams, 'kind' | 'thickness' | 'dna'>,
): string | undefined {
  // Bare single-material slab (no DNA) or legacy params missing a kind cannot
  // match a kind default — leave ad-hoc.
  if (!params.kind || !params.dna) return undefined;
  const def = getDefaultSlabBuildupForKind(params.kind);
  if (params.thickness !== def.totalThickness) return undefined;
  if (!dequal(params.dna, def)) return undefined;
  return getBuiltInSlabTypeId(params.kind);
}
