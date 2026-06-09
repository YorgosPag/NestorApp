/**
 * Boiler combustion-flue VENT TERMINAL (Revit «Vent Terminal / Flue Cap», καμινάδα).
 *
 * Pure SSoT for the *terminal* of a gas/oil boiler's combustion flue (καπναγωγός) — the
 * cap/cowl that closes the flue where it discharges to atmosphere. The flue connector +
 * its chevron vent stub are built by `mep-boiler-symbol`; THIS file adds the distinct
 * terminal-cap glyph drawn at the chevron tip, one shape per termination type. Like the
 * rest of the boiler symbol it is geometry-driven + rotation-aware (the `outward` unit
 * vector is already world-rotated by the caller), so the renderer just strokes the result.
 *
 * Termination types (real residential gas/oil boiler flue terminals):
 *   - `roof-cowl`           — κατακόρυφος καπναγωγός με καπέλο οροφής (vertical, roof cowl).
 *                             Glyph: an open hood box («∩») capping the flue tip.
 *   - `wall-horizontal`     — οριζόντιος επίτοιχος εξισορροπημένος (through-wall balanced).
 *                             Glyph: a long wall bar with a short outlet + cap beyond it.
 *   - `balanced-concentric` — ομοαξονικός εξισορροπημένος (concentric air/exhaust).
 *                             Glyph: two concentric diamonds (ring) at the tip.
 *
 * Kept separate from `mep-boiler-symbol` so the glyph math is unit-tested in isolation and
 * the symbol stays a thin orchestrator. NO import from `mep-boiler-symbol` (would cycle).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./mep-boiler-symbol
 */

import type { Point3D } from '../types/bim-base';

/** A polyline of world-space points (canvas units) — mirrors `BoilerStroke`. */
export type FlueTerminalStroke = readonly Point3D[];

/** Flue termination kind (Revit Vent Terminal type). Persisted as a kebab-case string. */
export type FlueTerminationType = 'roof-cowl' | 'wall-horizontal' | 'balanced-concentric';

/** Ordered list of every termination type (drives the ribbon picker + enum validation). */
export const FLUE_TERMINATION_TYPES: readonly FlueTerminationType[] = [
  'roof-cowl',
  'wall-horizontal',
  'balanced-concentric',
];

/** Default termination for a combustion boiler — a vertical roof cowl (most common). */
export const DEFAULT_FLUE_TERMINATION: FlueTerminationType = 'roof-cowl';

const TERMINATION_SET: ReadonlySet<string> = new Set<string>(FLUE_TERMINATION_TYPES);

/** Narrowing guard — `true` when `value` is a known {@link FlueTerminationType}. */
export function isFlueTerminationType(value: string): value is FlueTerminationType {
  return TERMINATION_SET.has(value);
}

/** Terminal glyph size as a fraction of the flue stub length. */
const TERMINAL_SIZE_FRAC = 0.28;

/**
 * Build the terminal-cap glyph for a combustion flue, anchored at the chevron `tip` and
 * oriented along `outward` (a world-space unit vector — already host-rotated). `stubLen`
 * scales the cap so it tracks the flue stub. Pure + rotation-aware. Returns an array of
 * world-space polylines (the renderer strokes them with the vent weight).
 */
export function buildFlueTerminalGlyph(
  tip: Point3D,
  outward: { x: number; y: number },
  stubLen: number,
  termination: FlueTerminationType,
): FlueTerminalStroke[] {
  const size = stubLen * TERMINAL_SIZE_FRAC;
  // Perpendicular to `outward` (chevron's lateral axis).
  const perp = { x: -outward.y, y: outward.x };
  switch (termination) {
    case 'wall-horizontal':
      return buildWallHorizontal(tip, outward, perp, size);
    case 'balanced-concentric':
      return buildBalancedConcentric(tip, outward, perp, size);
    case 'roof-cowl':
    default:
      return buildRoofCowl(tip, outward, perp, size);
  }
}

// ─── Glyph builders (pure, rotation-aware) ─────────────────────────────────────

function pt(
  origin: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  alongOut: number,
  alongPerp: number,
): Point3D {
  return {
    x: origin.x + outward.x * alongOut + perp.x * alongPerp,
    y: origin.y + outward.y * alongOut + perp.y * alongPerp,
    z: 0,
  };
}

/**
 * Roof cowl — an open hood box («∩») capping the flue tip: a cross-plate at the tip and
 * a hood projecting outward, three sides drawn so it reads as a downturned cowl.
 */
function buildRoofCowl(
  tip: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  size: number,
): FlueTerminalStroke[] {
  const half = size * 0.6;
  const depth = size;
  const plateL = pt(tip, outward, perp, 0, half);
  const plateR = pt(tip, outward, perp, 0, -half);
  const hoodL = pt(tip, outward, perp, depth, half);
  const hoodR = pt(tip, outward, perp, depth, -half);
  return [
    [plateL, plateR], // terminal cross-plate at the tip
    [plateL, hoodL], // hood left wall
    [plateR, hoodR], // hood right wall
    [hoodL, hoodR], // hood top — closes the «∩»
  ];
}

/**
 * Through-wall balanced terminal — a long wall bar crossing the flue, a short outlet
 * projecting beyond the wall, and a small cap plate at the outlet end.
 */
function buildWallHorizontal(
  tip: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  size: number,
): FlueTerminalStroke[] {
  const wallHalf = size * 1.1;
  const outletLen = size * 0.7;
  const capHalf = size * 0.4;
  const wallL = pt(tip, outward, perp, 0, wallHalf);
  const wallR = pt(tip, outward, perp, 0, -wallHalf);
  const outletEnd = pt(tip, outward, perp, outletLen, 0);
  const capL = pt(outletEnd, outward, perp, 0, capHalf);
  const capR = pt(outletEnd, outward, perp, 0, -capHalf);
  return [
    [wallL, wallR], // wall line the flue passes through
    [tip, outletEnd], // short outlet beyond the wall
    [capL, capR], // terminal cap plate
  ];
}

/**
 * Concentric (balanced) terminal — two concentric diamonds centred on the tip,
 * reading as an air-intake/exhaust ring.
 */
function buildBalancedConcentric(
  tip: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  size: number,
): FlueTerminalStroke[] {
  return [diamond(tip, outward, perp, size * 0.85), diamond(tip, outward, perp, size * 0.45)];
}

/** A closed diamond (4 corners on the outward/perp axes) centred on `c`, radius `r`. */
function diamond(
  c: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  r: number,
): FlueTerminalStroke {
  const a = pt(c, outward, perp, r, 0);
  const b = pt(c, outward, perp, 0, r);
  const d = pt(c, outward, perp, -r, 0);
  const e = pt(c, outward, perp, 0, -r);
  return [a, b, d, e, a];
}
