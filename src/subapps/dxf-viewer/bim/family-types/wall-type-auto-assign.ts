/**
 * Wall auto-typing policy (ADR-412 / ADR-414) — the SINGLE source of truth that
 * decides which built-in wall family type a freshly-drawn or freshly-loaded wall
 * should be linked to.
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * Before ADR-414 walls were created and persisted WITHOUT a `typeId`, so the
 * «Edit Wall Type» panel edited a type no instance referenced («every wall shows
 * the same layers»). This policy gives every *default* wall the read-only
 * built-in type of its category, so selection → type resolution → edit re-flow
 * all work (the rest of the ADR-412 «type always wins» machine is already wired).
 *
 * ─── NON-DESTRUCTIVE (locked, Giorgio «Read-only built-in + Duplicate-to-edit») ─
 * We auto-assign the built-in id ONLY when the wall's type-governed params still
 * MATCH the category default (identical `thickness` + deep-equal `dna`). A wall
 * with a customised cross-section — or a manual wall built from an explicit
 * thickness (`dna` absent, `buildDefaultWallParams`) — returns `undefined` and
 * stays ad-hoc/untyped, so resolution NEVER snaps its geometry back to the
 * category default. Editing a built-in always goes through Duplicate first.
 *
 * Pure + deterministic: no store read, no time/random — the built-in id is a
 * fixed string and the default DNA is the wall-DNA SSoT. Both the creation path
 * (`hooks/drawing/wall-completion.ts`) and the load path
 * (`hooks/data/wall-persistence-helpers.ts docToEntity`) call this one function.
 *
 * @see ./built-in-types.ts §getBuiltInWallTypeId
 * @see ../types/wall-dna-types.ts §getDefaultDnaForCategory
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { dequal } from 'dequal';
import { WALL_TYPE_SEEDS } from '../types/wall-dna-types';
import type { WallParams } from '../types/wall-types';
import { getBuiltInWallTypeId } from './built-in-types';

/**
 * The built-in wall family-type id this wall should be linked to, or `undefined`
 * when the wall must stay ad-hoc/untyped (manual / customised cross-section).
 *
 * Non-destructive gate: returns an id only when the wall's `thickness` + `dna`
 * are byte-equal to the category default — so the resolved effective params are
 * identical to the cached params (zero visual change on assignment).
 *
 * @param params Instance params (only `category`/`thickness`/`dna` are read).
 */
export function resolveAutoWallTypeId(
  params: Pick<WallParams, 'category' | 'thickness' | 'dna'>,
): string | undefined {
  // Manual wall (explicit thickness → no DNA) or legacy params missing a
  // category cannot match a built-in seed — leave ad-hoc.
  if (!params.category || !params.dna) return undefined;
  // ADR-447 — match against ALL built-in wall-type seeds of this category (not
  // just the category default), so a wall placed from the «25cm με θερμοπρόσοψη»
  // / «20cm» variants links to its own built-in. First byte-equal seed wins.
  for (const seed of WALL_TYPE_SEEDS) {
    if (seed.category !== params.category) continue;
    if (params.thickness !== seed.dna.totalThickness) continue;
    if (!dequal(params.dna, seed.dna)) continue;
    return getBuiltInWallTypeId(seed.key);
  }
  return undefined;
}
