/**
 * Appliance fixture SSoT — kinds, authored dimensions, drain/supply & 2D drawers
 * (ADR-408 Δρόμος B).
 *
 * A household plumbing **appliance** (washing machine, dishwasher, …) is — like a
 * sanitary terminal — a connectable `mep-fixture`: it takes a domestic cold-water
 * inlet and discharges into the sanitary-drainage network. In Revit it is an
 * `IfcElectricAppliance` (a distinct family CATEGORY from Plumbing Fixtures), so it
 * lives in its OWN family here, NOT inside {@link SANITARY_KINDS} — an appliance is
 * not «είδος υγιεινής» and must not surface in the sanitary ribbon group / tab.
 *
 * The two families share everything mechanical (the `SanitaryFixtureSpec` shape, the
 * connector builders, the 2D symbol pipeline), so this module mirrors
 * `sanitary-symbol-spec.ts` exactly; the unifying dispatch lives in
 * `mep-fixtures/plumbing-fixture-spec.ts` (`isPlumbingFixtureKind` = sanitary ∪ appliance).
 *
 * @see ../sanitary/sanitary-symbol-spec.ts — the mirrored sanitary family
 * @see ../mep-fixtures/plumbing-fixture-spec.ts — the unifying SSoT (sanitary ∪ appliance)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  ellipse,
  rect,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';
import type { SanitaryFixtureSpec } from '../sanitary/sanitary-symbol-spec';

// ─── Kind discriminator (distinct from SanitaryKind) ─────────────────────────

/** The connectable appliance kinds (Revit `IfcElectricAppliance` family). */
export const APPLIANCE_KINDS = ['washing-machine'] as const;

/** An appliance fixture kind — a member of {@link APPLIANCE_KINDS}. */
export type ApplianceKind = (typeof APPLIANCE_KINDS)[number];

/** Type-guard: is the given kind a connectable appliance? */
export function isApplianceKind(kind: string): kind is ApplianceKind {
  return (APPLIANCE_KINDS as readonly string[]).includes(kind);
}

/** Placement tool id for an appliance kind — `mep-${kind}` (e.g. `mep-washing-machine`). */
export function applianceFixtureToolId(kind: ApplianceKind): string {
  return `mep-${kind}`;
}

/**
 * SSoT — map a placement tool id back to its appliance kind (or `null` for any
 * non-appliance tool). One tool id per kind (the sanitary/manifold/segment
 * convention); the shared fixture tool reads this to set its `kind` preset.
 */
export function applianceFixtureToolKind(toolId: string): ApplianceKind | null {
  if (!toolId.startsWith('mep-')) return null;
  const kind = toolId.slice(4);
  return isApplianceKind(kind) ? kind : null;
}

// ─── Authored spec (dimensions, drain diameter, supply, label) — SSoT ────────

/**
 * Canonical appliance fixture spec (reuses the {@link SanitaryFixtureSpec} shape).
 * The washing-machine footprint + height are MEASURED from the shippable glTF
 * (real-world 597×587×850 mm). Drain Ø50 (a standpipe waste). Water supply: cold
 * only (`hot: false`) — a modern EU machine heats its own water; the cold inlet is
 * Ø15.
 */
export const APPLIANCE_SPEC: Readonly<Record<ApplianceKind, SanitaryFixtureSpec>> = {
  'washing-machine': {
    widthMm: 597,
    depthMm: 587,
    drainDiameterMm: 50,
    supply: { cold: true, hot: false, diameterMm: 15 },
    labelKey: 'mepFixture.appliance.washingMachine',
  },
};

// ─── Pure 2D drawers (footprint → identifying strokes) — SSoT ────────────────

/**
 * Per-kind appliance symbol drawers. Each is a pure `footprint → strokes` function
 * in normalized footprint coords (rotation/scale-aware for free), mirroring
 * {@link SANITARY_DRAWERS}. The washing-machine reads as an inset body + a top
 * control-panel band + a round door (the architectural appliance convention).
 */
export const APPLIANCE_DRAWERS: Readonly<Record<ApplianceKind, (fp: FootprintBasis) => SymbolStroke[]>> = {
  'washing-machine': (fp) => [
    rect(fp, 0.1, 0.1, 0.9, 0.9),
    rect(fp, 0.1, 0.1, 0.9, 0.28),
    ellipse(fp, 0.5, 0.6, 0.3, 0.3),
    ellipse(fp, 0.5, 0.6, 0.2, 0.2),
  ],
};
