/**
 * Sanitary fixture SSoT — kinds, authored dimensions, drain diameters & 2D drawers
 * (ADR-408 Φ14).
 *
 * Revit-true "Plumbing Fixture": a WC / washbasin / shower / bathtub / bidet is a
 * connectable `mep-fixture` (sanitary-drainage outlet → drainage network), NOT a
 * 2D-only annotation. This module is the **single source of truth** for everything
 * a sanitary terminal shares between the two render paths:
 *   - the connectable `mep-fixture` (2D symbol + 3D box + drain connector), and
 *   - the legacy 2D-only `floorplan-symbol` (kept for back-compat rendering of
 *     pre-Φ14 persisted data; new sanitary placements are mep-fixtures).
 *
 * The authored footprint dimensions previously lived inline in
 * `FLOORPLAN_SYMBOL_CATALOG`; ADR-408 Φ14 made THIS the canonical home and the
 * floorplan-symbol catalog now derives its sanitary dims from here (zero drift).
 *
 * The 2D vector drawers are pure footprint→strokes functions built from the shared
 * `symbol-vector-helpers` (normalized-coord, rotation/scale-aware, zero trig).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import {
  ellipse,
  line,
  rect,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator (subset of FloorplanSymbolKind, shared by value) ──────

/** The five sanitary terminal kinds (Revit Plumbing Fixtures). */
export const SANITARY_KINDS = ['wc', 'washbasin', 'shower', 'bathtub', 'bidet'] as const;

/** A sanitary fixture kind — a member of {@link SANITARY_KINDS}. */
export type SanitaryKind = (typeof SANITARY_KINDS)[number];

/** Type-guard: is the given kind one of the five sanitary terminals? */
export function isSanitaryKind(kind: string): kind is SanitaryKind {
  return (SANITARY_KINDS as readonly string[]).includes(kind);
}

/** Placement tool id for a sanitary kind — `mep-${kind}` (e.g. `mep-wc`). */
export function sanitaryFixtureToolId(kind: SanitaryKind): string {
  return `mep-${kind}`;
}

/**
 * SSoT — map a placement tool id back to its sanitary kind (or `null` for any
 * non-sanitary tool). One tool id per kind mirrors the manifold/segment/floor-drain
 * convention; the shared fixture tool reads this to set its `kind` preset. Guards
 * against collisions (`mep-pipe`/`mep-fixture`/… resolve to `null`).
 */
export function sanitaryFixtureToolKind(toolId: string): SanitaryKind | null {
  if (!toolId.startsWith('mep-')) return null;
  const kind = toolId.slice(4);
  return isSanitaryKind(kind) ? kind : null;
}

// ─── Authored spec (dimensions, drain diameter, label) — SSoT ────────────────

/**
 * Water-supply requirement of a sanitary terminal (Revit "Plumbing Fixture"
 * Domestic Cold/Hot Water connectors). `cold` is always true (every fixture takes
 * cold water); `hot` is true for fixtures that mix hot water (a WC is cold-only).
 * `diameterMm` is the DN of the supply stub-out (typically Ø15, a bath Ø20).
 */
export interface SanitaryWaterSupplySpec {
  readonly cold: boolean;
  readonly hot: boolean;
  readonly diameterMm: number;
}

export interface SanitaryFixtureSpec {
  /** mm. Authored footprint width (X before rotation). */
  readonly widthMm: number;
  /** mm. Authored footprint depth (Y before rotation). */
  readonly depthMm: number;
  /** mm. Default sanitary-drainage outlet diameter (WC=100, basin/bidet=40, shower/tub=50). */
  readonly drainDiameterMm: number;
  /** Domestic water-supply connectors this fixture needs (ADR-408 plumbing-fixture connect). */
  readonly supply: SanitaryWaterSupplySpec;
  /** i18n label key (namespace dxf-viewer-shell) — reuses the shared symbol catalog labels. */
  readonly labelKey: string;
}

/**
 * Canonical sanitary fixture spec. Footprint dims are typical real-world plan
 * sizes (mm). Drain Ø follows DN convention: a WC soil outlet is DN100, a basin
 * waste DN40, a shower/bath waste DN50. Water supply: a WC takes cold only (cistern
 * fill); basin/shower/bath/bidet mix cold + hot (Ø15, bath Ø20).
 */
export const SANITARY_SPEC: Readonly<Record<SanitaryKind, SanitaryFixtureSpec>> = {
  wc: { widthMm: 380, depthMm: 680, drainDiameterMm: 100, supply: { cold: true, hot: false, diameterMm: 15 }, labelKey: 'floorplanSymbol.catalog.wc' },
  washbasin: { widthMm: 600, depthMm: 460, drainDiameterMm: 40, supply: { cold: true, hot: true, diameterMm: 15 }, labelKey: 'floorplanSymbol.catalog.washbasin' },
  shower: { widthMm: 900, depthMm: 900, drainDiameterMm: 50, supply: { cold: true, hot: true, diameterMm: 15 }, labelKey: 'floorplanSymbol.catalog.shower' },
  bathtub: { widthMm: 1700, depthMm: 750, drainDiameterMm: 50, supply: { cold: true, hot: true, diameterMm: 20 }, labelKey: 'floorplanSymbol.catalog.bathtub' },
  bidet: { widthMm: 360, depthMm: 560, drainDiameterMm: 40, supply: { cold: true, hot: true, diameterMm: 15 }, labelKey: 'floorplanSymbol.catalog.bidet' },
};

// ─── Pure 2D drawers (footprint → identifying strokes) — SSoT ────────────────

/**
 * Per-kind sanitary symbol drawers. Each is a pure `footprint → strokes` function
 * in normalized footprint coords (rotation/scale-aware for free). Consumed by BOTH
 * `mep-fixture-symbol.ts` (connectable fixture) and `floorplan-symbol-symbol.ts`
 * (legacy 2D-only) — zero duplicated vector geometry.
 */
export const SANITARY_DRAWERS: Readonly<Record<SanitaryKind, (fp: FootprintBasis) => SymbolStroke[]>> = {
  wc: (fp) => [rect(fp, 0.12, 0.8, 0.88, 1.0), ellipse(fp, 0.5, 0.42, 0.34, 0.36), ellipse(fp, 0.5, 0.42, 0.27, 0.29)],
  washbasin: (fp) => [ellipse(fp, 0.5, 0.45, 0.4, 0.34), ellipse(fp, 0.5, 0.45, 0.03, 0.03), ellipse(fp, 0.5, 0.88, 0.05, 0.05)],
  shower: (fp) => [line(fp, 0.02, 0.02, 0.98, 0.98), line(fp, 0.98, 0.02, 0.02, 0.98), ellipse(fp, 0.5, 0.5, 0.06, 0.06)],
  bathtub: (fp) => [rect(fp, 0.08, 0.1, 0.92, 0.9), ellipse(fp, 0.5, 0.55, 0.34, 0.3), ellipse(fp, 0.5, 0.2, 0.04, 0.04)],
  bidet: (fp) => [ellipse(fp, 0.5, 0.46, 0.36, 0.42), ellipse(fp, 0.5, 0.46, 0.2, 0.24), ellipse(fp, 0.5, 0.88, 0.04, 0.04)],
};
