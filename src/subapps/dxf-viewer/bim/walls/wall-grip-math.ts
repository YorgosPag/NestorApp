/**
 * ADR-363 Phase 1C — Wall grip shared math primitives.
 *
 * Pure geometry helpers shared by `wall-grips.ts` (position computation) and
 * `wall-grip-transforms.ts` (drag transforms). Zero React / DOM / Firestore /
 * canvas deps. Mirrors `bim/stairs/stair-grip-math.ts` (ADR-393 3-file split).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 */

import type { WallParams } from '../types/wall-types';
import { MIN_WALL_THICKNESS_MM, MAX_WALL_THICKNESS_MM } from '../types/wall-types';
import { DEGENERATE_EPS, perpUnit, project2D, unitVector } from '../grips/grip-math';

// ADR-397 §12 D3 — primitives now live in the shared `bim/grips/grip-math.ts`
// SSoT; re-exported here so existing `wall-grips.ts` / `wall-grip-transforms.ts`
// import sites keep working unchanged.
export { DEGENERATE_EPS, perpUnit, project2D };

/** Unit axis vector from `params.start → params.end`. Returns null when degenerate. */
export function unitAxis(params: WallParams): { x: number; y: number } | null {
  return unitVector(params.start, params.end);
}

// ─── Thickness clamp floor/ceiling (scene-unit-aware) ────────────────────────
// Shared SSoT for the thickness clamp used by both `wall-grip-transforms`
// (resizeThickness / moveCorner) and `wall-rect-adapter` (rect-engine path).
// Mirrors `bim/stairs/stair-grips.minWidthFloorFor()` — a thickness default of
// 0.2 (m), 20 (cm), 200 (mm) → respective floors 0.05, 5, 50 (same physical
// 50 mm everywhere).

/** Minimum-thickness floor in whatever scene units `currentThickness` uses. */
export function minThicknessFloorFor(currentThickness: number): number {
  if (!Number.isFinite(currentThickness) || currentThickness <= 0) {
    return MIN_WALL_THICKNESS_MM;
  }
  if (currentThickness < 10) return 0.05;   // metres
  if (currentThickness < 100) return 5;     // centimetres
  return MIN_WALL_THICKNESS_MM;             // millimetres (or larger units)
}

/** Same heuristic, max side. */
export function maxThicknessCeilingFor(currentThickness: number): number {
  if (!Number.isFinite(currentThickness) || currentThickness <= 0) {
    return MAX_WALL_THICKNESS_MM;
  }
  if (currentThickness < 10) return 2;         // metres (2 m)
  if (currentThickness < 100) return 200;      // centimetres (200 cm = 2 m)
  return MAX_WALL_THICKNESS_MM;                // millimetres
}
