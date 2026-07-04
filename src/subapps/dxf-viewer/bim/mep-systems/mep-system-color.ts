/**
 * MEP System colour SSoT — ADR-408 Φ5 (colour-by-system).
 *
 * The System **owns** its colour (`MepSystemParams.color`, Revit "System
 * Colour"). This module is the single place that:
 *   - hands out a deterministic palette default at circuit creation
 *     ({@link pickNextSystemColor}) so a circuit is never colourless;
 *   - resolves the colour to paint a given host entity (panel/fixture) from the
 *     live systems ({@link buildEntitySystemColorIndex} /
 *     {@link resolveEntitySystemColor}), consumed by the 2D renderers and the
 *     3D `BimSceneLayer`.
 *
 * Pure — no store / React. An entity is coloured when it is a system's **source**
 * (the panel) or one of its **members** (a fixture); unassigned entities keep
 * their renderer default. Mirrors the discipline-visibility threading shape
 * (ADR-405 §4): a pure index built once, read at draw time.
 *
 * @see ./mep-system-coordinator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepSystemEntity } from '../types/mep-system-types';
import type {
  PlumbingSystemClassification,
  DuctSystemClassification,
  FuelSystemClassification,
} from '../types/mep-connector-types';
// 🏢 ADR-571: cyan/teal εγγραφές της categorical παλέτας → SSoT
import { MEP_WATER_COLOR, MEP_TEAL_COLOR } from '../../config/color-config';
// 🏢 ADR-571: color-conversion SSoT (μηδέν local duplicate — delegate κάτω)
import { hexToRgba as hexToRgbaSSoT } from '../../config/color-math';
import { hexToTrueColor } from '../../utils/dxf-true-color';

/**
 * Curated, high-contrast palette for electrical circuits (distinct hues, readable
 * on both light and dark canvases). Chosen for categorical distinguishability —
 * the colour-by-system equivalent of Revit's auto-assigned system colours.
 */
export const MEP_SYSTEM_PALETTE: readonly string[] = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  MEP_WATER_COLOR, // cyan (ADR-571 SSoT)
  '#ca8a04', // gold
  '#db2777', // pink
  '#4d7c0f', // olive
  '#7c3aed', // violet
  MEP_TEAL_COLOR, // teal (ADR-571 SSoT)
  '#b45309', // brown
];

/** Stable palette colour for a system id when no explicit colour is stored. */
function paletteColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % MEP_SYSTEM_PALETTE.length;
  return MEP_SYSTEM_PALETTE[idx]!;
}

/** A system's effective colour: its owned `color`, or a deterministic fallback. */
export function systemColor(system: MepSystemEntity): string {
  return system.params.color ?? paletteColorForId(system.id);
}

/**
 * Industry-convention colour for a plumbing classification (ADR-408 Φ9/Φ10) —
 * unlike electrical circuits (categorical palette), pipe networks are coloured by
 * **what they carry** (Revit/CIBSE plumbing convention): cold water blue, hot
 * water red, drainage brown, heating supply red / return blue. Used to seed a
 * derived network's owned `color` so colour-by-system reads it for free.
 */
export function classificationDefaultColor(
  classification: PlumbingSystemClassification,
): string {
  switch (classification) {
    case 'domestic-cold-water':
      return '#2563eb'; // blue
    case 'domestic-hot-water':
      return '#dc2626'; // red
    case 'sanitary-drainage':
      return '#b45309'; // brown
    case 'hydronic-supply':
      return '#dc2626'; // red (heating flow)
    case 'hydronic-return':
      return '#2563eb'; // blue (heating return)
    case 'fire-sprinkler':
      return '#b91c1c'; // deep fire-red (ADR-433 — distinct from hot-water #dc2626)
  }
}

/**
 * Industry-convention colour for a duct classification (ADR-408 + ADR-432). Mirror of
 * {@link classificationDefaultColor} for the air domain: `exhaust` grey (flue gas),
 * `supply-air` light blue, `return-air` teal (Revit/HVAC convention — supply cool, return
 * warmer). Exhaustive over {@link DuctSystemClassification}.
 */
export function ductClassificationDefaultColor(
  classification: DuctSystemClassification,
): string {
  switch (classification) {
    case 'exhaust':
      return '#6b7280'; // grey (flue gas)
    case 'supply-air':
      return '#38bdf8'; // light blue (supply air)
    case 'return-air':
      return MEP_TEAL_COLOR; // teal (return air, ADR-571 SSoT)
  }
}

/**
 * Industry-convention colour for a fuel classification (ADR-434). Mirror of
 * {@link ductClassificationDefaultColor} for the combustion-fuel domain: `fuel-gas`
 * yellow (the universal gas-pipe convention), `fuel-oil` brown. Exhaustive over
 * {@link FuelSystemClassification}.
 */
export function fuelClassificationDefaultColor(
  classification: FuelSystemClassification,
): string {
  switch (classification) {
    case 'fuel-gas':
      return '#eab308'; // yellow (gas)
    case 'fuel-oil':
      return '#92400e'; // brown (oil)
  }
}

/** The 3 duct classifications, for the disjoint pipe-vs-duct dispatch below. */
const ALL_DUCT_CLASSIFICATIONS: readonly DuctSystemClassification[] = [
  'exhaust',
  'supply-air',
  'return-air',
];

/** True when `c` is a duct classification (disjoint value space from plumbing). */
function isDuctClassification(
  c: PlumbingSystemClassification | DuctSystemClassification | FuelSystemClassification,
): c is DuctSystemClassification {
  return (ALL_DUCT_CLASSIFICATIONS as readonly string[]).includes(c);
}

/** The 2 fuel classifications, for the disjoint fuel dispatch below. */
const ALL_FUEL_CLASSIFICATIONS: readonly FuelSystemClassification[] = ['fuel-gas', 'fuel-oil'];

/** True when `c` is a fuel classification (disjoint value space from plumbing/duct). */
function isFuelClassification(
  c: PlumbingSystemClassification | DuctSystemClassification | FuelSystemClassification,
): c is FuelSystemClassification {
  return (ALL_FUEL_CLASSIFICATIONS as readonly string[]).includes(c);
}

/**
 * ADR-408 Φ14 + ADR-432 — the display colour a STANDALONE pipe/duct segment carries from
 * its own instance `classification` hint (cold = blue, hot = red, drainage = brown,
 * supply-air = light blue, return-air = teal), or `null` when unclassified (the renderer
 * then falls back to its domain default). The SINGLE source shared by the 2D renderer, the
 * 3D converter AND the HVAC proposal ghost so all colour a run identically. A System
 * membership ALWAYS wins over this (the System owns the classification once joined) —
 * callers resolve system colour first.
 */
export function resolveSegmentClassificationColor(
  classification:
    | PlumbingSystemClassification
    | DuctSystemClassification
    | FuelSystemClassification
    | undefined,
): string | null {
  if (!classification) return null;
  if (isFuelClassification(classification)) return fuelClassificationDefaultColor(classification);
  return isDuctClassification(classification)
    ? ductClassificationDefaultColor(classification)
    : classificationDefaultColor(classification);
}

/** The 6 hydraulic classifications, for exhaustive default-colour checks. */
const ALL_PLUMBING_CLASSIFICATIONS: readonly PlumbingSystemClassification[] = [
  'domestic-cold-water',
  'domestic-hot-water',
  'sanitary-drainage',
  'hydronic-supply',
  'hydronic-return',
  'fire-sprinkler',
];

/**
 * True when `color` is unset or equals the convention default of ANY classification
 * (ADR-408 Φ-heating). Lets the classification picker re-seed the colour on a type
 * change ONLY when the user has not chosen a custom one — a custom colour is
 * preserved (Revit keeps an overridden System Colour across a System Type change).
 */
export function isDefaultClassificationColor(color?: string): boolean {
  if (!color) return true;
  return ALL_PLUMBING_CLASSIFICATIONS.some((c) => classificationDefaultColor(c) === color);
}

/**
 * Pick the next default colour for a new circuit: the least-used palette entry
 * across the existing systems (ties broken by palette order). Deterministic and
 * Date/Math.random-free, so it survives workflow replay.
 */
export function pickNextSystemColor(existing: readonly MepSystemEntity[]): string {
  const counts = new Map<string, number>(MEP_SYSTEM_PALETTE.map((c) => [c, 0]));
  for (const s of existing) {
    const c = s.params.color;
    if (c && counts.has(c)) counts.set(c, counts.get(c)! + 1);
  }
  let best = MEP_SYSTEM_PALETTE[0]!;
  let min = Infinity;
  for (const c of MEP_SYSTEM_PALETTE) {
    const n = counts.get(c)!;
    if (n < min) {
      min = n;
      best = c;
    }
  }
  return best;
}

/**
 * Build the `entityId → colour` index from the live systems. Only a system's
 * **members** (the loads — light fixtures) are coloured by circuit. The
 * **source equipment** (the panel) is deliberately NOT coloured: it is the
 * shared feed of many circuits, so a single circuit colour would be arbitrary —
 * exactly how the industry tools behave (Revit: an Electrical Equipment panel
 * carries no Circuit Number / Panel parameter and never takes a circuit colour;
 * only the connected devices do). The panel keeps its equipment default.
 *
 * A fixture in more than one circuit takes the last one's colour — same
 * precedence as the connector cache (`buildConnectorSystemIndex`); the
 * single-circuit guard lives in the assignment UI so this is normally moot.
 */
export function buildEntitySystemColorIndex(
  systems: readonly MepSystemEntity[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const system of systems) {
    const c = systemColor(system);
    for (const m of system.params.members) index.set(m.entityId, c);
  }
  return index;
}

/** The colour to paint `entityId`, or `null` when it belongs to no system. */
export function resolveEntitySystemColor(
  entityId: string,
  index: ReadonlyMap<string, string>,
): string | null {
  return index.get(entityId) ?? null;
}

/**
 * ADR-408 Φ11 — a fitting inherits the system colour of the pipes it joins (Revit:
 * "a fitting follows the system of its connectors"). A fitting is NOT itself a
 * system member (it is auto-derived from the topology), so it has no own colour
 * index entry; instead we read the colour of the FIRST incident pipe that belongs
 * to a system. All pipes meeting at a junction share the same system, so any of
 * them gives the right colour. Returns `null` when none of the incident pipes are
 * assigned. Generic over the colour representation (hex string for the 2D renderer,
 * THREE colour int for the 3D material) so both views share this ONE derivation.
 */
export function resolveFittingSystemColor<T>(
  incidentSegmentIds: readonly string[],
  index: ReadonlyMap<string, T>,
): T | null {
  for (const id of incidentSegmentIds) {
    const c = index.get(id);
    if (c !== undefined) return c;
  }
  return null;
}

// Memo so the ADR-040 micro-leaf renderers (which read the store at draw time,
// once per entity per frame) rebuild the index only when the systems array
// reference actually changes — zustand keeps it stable between mutations.
let _idxKey: readonly MepSystemEntity[] | null = null;
let _idxVal: ReadonlyMap<string, string> = new Map();

/** Reference-memoised `buildEntitySystemColorIndex` for per-entity draw paths. */
export function getEntitySystemColorIndexCached(
  systems: readonly MepSystemEntity[],
): ReadonlyMap<string, string> {
  if (systems === _idxKey) return _idxVal;
  _idxKey = systems;
  _idxVal = buildEntitySystemColorIndex(systems);
  return _idxVal;
}

/**
 * Parse a `#rrggbb` hex into a THREE colour int (0xrrggbb). Returns null if invalid.
 * 🏢 ADR-571: delegates the parse to the `hexToTrueColor` SSoT (utils/dxf-true-color.ts);
 * keeps the nullable contract (consumers here null-skip invalid entries).
 */
export function hexToThreeInt(hex: string): number | null {
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim()) ? hexToTrueColor(hex) : null;
}

/** Build the `entityId → THREE colour int` index for 3D material tinting. */
export function buildEntitySystemColorIntIndex(
  systems: readonly MepSystemEntity[],
): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const [entityId, hex] of buildEntitySystemColorIndex(systems)) {
    const int = hexToThreeInt(hex);
    if (int !== null) out.set(entityId, int);
  }
  return out;
}

/**
 * Hex colour → `rgba(r,g,b,a)` string for translucent 2D fills. Falls back to the hex.
 * 🏢 ADR-571: delegates to the `hexToRgba` SSoT (config/color-math.ts). Kept as a re-export
 * so existing `mep-system-color` import paths stay stable — μηδέν local duplicate.
 */
export function hexToRgba(hex: string, alpha: number): string {
  return hexToRgbaSSoT(hex, alpha);
}
