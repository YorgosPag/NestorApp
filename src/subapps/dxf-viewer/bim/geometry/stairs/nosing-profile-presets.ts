/**
 * Nosing Profile presets — Revit "Nosing Profile" family, preset-driven (ADR-358 Q19 Φ6).
 *
 * SSoT that TRANSLATES a user-facing preset (square / bullnose / chamfer + one size
 * dimension) ↔ the `customProfile: Point2D[]` SECTION consumed by the geometry
 * pipeline. Big players (Revit) apply nosing as a PICKED profile shape, not a
 * freehand point sketch — so the UI (Φ6) offers presets and this module GENERATES
 * the section, while `classifyNosingProfile` reverses a stored section back to a
 * preset so the picker can show the current shape.
 *
 * Section semantics (LOCKED by Φ4a `resolveTreadNosing` + Φ4b `buildTreadNosingMesh`,
 * DO NOT break):
 *   • `x` = forward depth from the riser line, `0 ≤ x ≤ size`; `max x` = overhang.
 *   • `y` = height, `y = 0` at the top face, negative downward.
 *   • Points trace the nose front → down; the mesh closes the section to the back.
 *
 * • `square`   → NO section (undefined): the flat nose overhang comes from the
 *                scalar `nosing` field instead (nothing shaped to sweep).
 * • `bullnose(r)` → quarter arc from the top-front tip `(r, 0)` down to `(0, −r)`
 *                (rounded front edge, overhang = r).
 * • `chamfer(s)`  → straight 45° bevel from `(s, 0)` to `(0, −s)` (overhang = s).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 * @see stair-tread-overrides.ts (Φ4a) · ../../../bim-3d/converters/stair-tread-nosing-3d.ts (Φ4b)
 */

import type { Point2D } from '../../types/stair-types';

/** Presets the picker can author (square = flat, no shaped section). */
export type NosingProfilePreset = 'square' | 'bullnose' | 'chamfer';

/** A stored section may also be an externally-authored freehand shape → `'custom'`. */
export type NosingProfileClass = NosingProfilePreset | 'custom';

export interface ClassifiedNosingProfile {
  readonly kind: NosingProfileClass;
  /** Overhang dimension (mm): radius for bullnose, leg for chamfer, `max x` for custom, 0 for square. */
  readonly size: number;
}

/** Default overhang (mm) when switching a fresh tread from square to a shaped preset. */
export const DEFAULT_NOSING_PROFILE_SIZE = 25;

/** Quarter-arc sampling for the bullnose (segment count → N+1 points). */
const BULLNOSE_SEGMENTS = 8;
const EPS = 1e-6;

/**
 * Build the nosing SECTION (`Point2D[]`) for a preset, or `undefined` when the
 * result is flat (square, or a non-positive size) — the caller clears
 * `customProfile` so the overhang falls back to the scalar `nosing`.
 */
export function buildNosingProfile(
  kind: NosingProfilePreset,
  sizeMm: number,
): readonly Point2D[] | undefined {
  if (kind === 'square' || !(sizeMm > EPS)) return undefined;
  if (kind === 'chamfer') {
    return [
      { x: sizeMm, y: 0 },
      { x: 0, y: -sizeMm },
    ];
  }
  return buildBullnoseArc(sizeMm);
}

/** Quarter circle centred at the riser line: `(r·cosθ, −r·sinθ)`, θ: 0 → π/2. */
function buildBullnoseArc(radius: number): readonly Point2D[] {
  const points: Point2D[] = [];
  for (let k = 0; k <= BULLNOSE_SEGMENTS; k += 1) {
    const theta = (k / BULLNOSE_SEGMENTS) * (Math.PI / 2);
    points.push({ x: radius * Math.cos(theta), y: -radius * Math.sin(theta) });
  }
  return points;
}

/**
 * Reverse a stored section back to a preset so the picker reflects the current
 * shape. Best-effort: an unrecognised (freehand / imported) section → `'custom'`
 * (size = its overhang), which the picker shows read-only until overwritten.
 */
export function classifyNosingProfile(
  section?: readonly Point2D[],
): ClassifiedNosingProfile {
  if (!section || section.length === 0) return { kind: 'square', size: 0 };
  const size = maxDepth(section);
  if (isChamfer(section, size)) return { kind: 'chamfer', size };
  if (isBullnose(section, size)) return { kind: 'bullnose', size };
  return { kind: 'custom', size };
}

function maxDepth(section: readonly Point2D[]): number {
  let max = 0;
  for (const p of section) if (p.x > max) max = p.x;
  return max;
}

/** Two points `(s,0) → (0,−s)`. */
function isChamfer(section: readonly Point2D[], size: number): boolean {
  if (section.length !== 2 || size <= EPS) return false;
  const [a, b] = section;
  return (
    near(a!.x, size) && near(a!.y, 0) && near(b!.x, 0) && near(b!.y, -size)
  );
}

/** N+1 points lying on the quarter circle radius `size` centred at the riser line. */
function isBullnose(section: readonly Point2D[], size: number): boolean {
  if (section.length < 3 || size <= EPS) return false;
  for (const p of section) {
    if (p.x < -EPS || p.y > EPS) return false; // inside the [0..size] × [−size..0] quadrant
    if (Math.abs(Math.hypot(p.x, p.y) - size) > size * 1e-3 + EPS) return false;
  }
  return true;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) <= EPS;
}
