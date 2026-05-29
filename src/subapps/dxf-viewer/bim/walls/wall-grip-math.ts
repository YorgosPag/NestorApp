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
import { DEGENERATE_EPS, perpUnit, project2D, unitVector } from '../grips/grip-math';

// ADR-397 §12 D3 — primitives now live in the shared `bim/grips/grip-math.ts`
// SSoT; re-exported here so existing `wall-grips.ts` / `wall-grip-transforms.ts`
// import sites keep working unchanged.
export { DEGENERATE_EPS, perpUnit, project2D };

/** Unit axis vector from `params.start → params.end`. Returns null when degenerate. */
export function unitAxis(params: WallParams): { x: number; y: number } | null {
  return unitVector(params.start, params.end);
}
