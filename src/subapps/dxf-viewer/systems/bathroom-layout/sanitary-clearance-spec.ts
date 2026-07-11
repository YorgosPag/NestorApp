/**
 * Sanitary fixture **clearance** SSoT (use-zones) · ADR-638.
 *
 * The footprint dimensions are NOT re-authored here — they are reused verbatim
 * from the existing catalogs (`SANITARY_SPEC` for the five terminals,
 * `APPLIANCE_SPEC` for the washing-machine) so there is zero dimensional drift
 * (N.0.2 / N.18). This module owns ONLY the extra data the layout solver needs
 * that those catalogs don't carry: the ergonomic **approach clearance** in front
 * of each fixture, the side comfort gap, the wet/placement/priority hints, and the
 * one fixture with no catalog yet — the vanity (επιπλομπάνιο).
 *
 * Clearance figures are typical residential ergonomics (EU / Greek practice):
 *   · WC / bidet — ~600 mm clear front approach, ~100 mm each side.
 *   · washbasin / vanity — ~550 mm front (lean-in), ~50-100 mm side.
 *   · shower / bathtub — ~600-700 mm front (towel/step-out), corner-friendly.
 *   · washing-machine — ~550 mm front (door swing / loading).
 * They are conservative defaults; a later stage can source statutory minima from
 * `src/services/building-code/` if a bathroom-clearance table is added there.
 *
 * @see ../../bim/sanitary/sanitary-symbol-spec.ts — footprint dims (reused)
 * @see ../../bim/appliances/appliance-symbol-spec.ts — appliance dims (reused)
 */

import { SANITARY_SPEC, isSanitaryKind } from '../../bim/sanitary/sanitary-symbol-spec';
import { APPLIANCE_SPEC } from '../../bim/appliances/appliance-symbol-spec';
import type { FixtureFootprintSpec, LayoutFixtureKind } from './bathroom-layout-types';

/** The extra (non-dimensional) layout rules per fixture kind. */
interface ClearanceRule {
  readonly frontMm: number;
  readonly sideMm: number;
  readonly wet: boolean;
  readonly placement: 'wall' | 'corner';
  readonly priority: number;
}

/**
 * Per-kind clearance + placement rules. `priority` is the placement order (lower
 * first): the bulky, hard-to-fit fixtures (tub, shower) claim space before the
 * small flexible ones (basin, vanity, machine).
 */
const CLEARANCE: Readonly<Record<LayoutFixtureKind, ClearanceRule>> = {
  bathtub: { frontMm: 700, sideMm: 0, wet: true, placement: 'wall', priority: 1 },
  shower: { frontMm: 600, sideMm: 0, wet: true, placement: 'corner', priority: 2 },
  wc: { frontMm: 600, sideMm: 100, wet: true, placement: 'wall', priority: 3 },
  bidet: { frontMm: 600, sideMm: 100, wet: true, placement: 'wall', priority: 4 },
  washbasin: { frontMm: 550, sideMm: 100, wet: true, placement: 'wall', priority: 5 },
  vanity: { frontMm: 550, sideMm: 50, wet: true, placement: 'wall', priority: 6 },
  'washing-machine': { frontMm: 550, sideMm: 20, wet: true, placement: 'wall', priority: 7 },
};

/**
 * Vanity (επιπλομπάνιο) footprint — authored here because no `FurnitureKind:'vanity'`
 * catalog entry exists yet (ADR-638 later stage adds one; this stays the SSoT until
 * then). Typical single-basin vanity unit: 800 × 480 mm.
 */
const VANITY_DIMS = { widthMm: 800, depthMm: 480 } as const;

/** Footprint dims (mm) for any layout kind — reuses the catalogs, never re-authors. */
function resolveDims(kind: LayoutFixtureKind): { widthMm: number; depthMm: number } {
  if (isSanitaryKind(kind)) {
    const s = SANITARY_SPEC[kind];
    return { widthMm: s.widthMm, depthMm: s.depthMm };
  }
  if (kind === 'washing-machine') {
    const a = APPLIANCE_SPEC[kind];
    return { widthMm: a.widthMm, depthMm: a.depthMm };
  }
  return { widthMm: VANITY_DIMS.widthMm, depthMm: VANITY_DIMS.depthMm };
}

/** Resolve the full footprint + clearance spec for one fixture kind. */
export function resolveFixtureSpec(kind: LayoutFixtureKind): FixtureFootprintSpec {
  const rule = CLEARANCE[kind];
  const dims = resolveDims(kind);
  return {
    kind,
    widthMm: dims.widthMm,
    depthMm: dims.depthMm,
    frontClearanceMm: rule.frontMm,
    sideClearanceMm: rule.sideMm,
    wet: rule.wet,
    placement: rule.placement,
    priority: rule.priority,
  };
}

/**
 * Resolve specs for a set of kinds, **deduped** and sorted by placement priority
 * (bulky/constrained first). Order is deterministic (priority, then kind name).
 */
export function resolveFixtureSpecs(
  kinds: readonly LayoutFixtureKind[],
): FixtureFootprintSpec[] {
  const unique = Array.from(new Set(kinds));
  return unique
    .map(resolveFixtureSpec)
    .sort((a, b) => a.priority - b.priority || a.kind.localeCompare(b.kind));
}
