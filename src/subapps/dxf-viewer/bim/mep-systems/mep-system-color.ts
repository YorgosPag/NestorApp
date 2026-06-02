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
  '#0891b2', // cyan
  '#ca8a04', // gold
  '#db2777', // pink
  '#4d7c0f', // olive
  '#7c3aed', // violet
  '#0d9488', // teal
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

/** Parse a `#rrggbb` hex into a THREE colour int (0xrrggbb). Returns null if invalid. */
export function hexToThreeInt(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1]!, 16) : null;
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

/** Hex colour → `rgba(r,g,b,a)` string for translucent 2D fills. Falls back to the hex. */
export function hexToRgba(hex: string, alpha: number): string {
  const int = hexToThreeInt(hex);
  if (int === null) return hex;
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
