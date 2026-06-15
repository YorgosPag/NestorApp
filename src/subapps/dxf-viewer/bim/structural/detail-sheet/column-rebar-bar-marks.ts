/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · longitudinal bar marks (SSoT).
 *
 * Assigns a stable position number (#1…#N) to each longitudinal reinforcement bar
 * so the SAME physical bar carries the SAME mark in every view (plan + 3D). The
 * ordering is **left → right as seen in the isometric 3D**: in that view the
 * screen-x of a bar is proportional to `worldX − worldZ`, and the cage maps a bar
 * to `world = columnLocalMmToWorld(...)` with `worldZ = −worldY` (the AXIS_FLIP),
 * so the ranking key is simply `worldX + worldY`. Deterministic tie-breaks keep
 * the numbering reproducible for bars that share a screen-x.
 *
 * Pure (no THREE / no DOM) → consumed by both the 2D plan builder and the 3D
 * capture, and unit-testable. Geometry-is-SSoT: bar positions come from
 * `computeColumnRebarLayout` (the same layout the cage/plan already draw).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-rebar-bar-marks
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { ColumnParams } from '../../types/column-types';
import { columnLocalMmToWorld } from '../../geometry/column-geometry';
import { resolveColumnRebarLayoutForParams } from '../reinforcement/column-rebar-layout-resolve';

/**
 * Returns the bar mark number (1-based) for each longitudinal bar, aligned to the
 * index order of `computeColumnRebarLayout(...).longitudinalBarsMm` (so a view
 * iterating those bars reads `numbers[i]` directly). Returns `null` for an
 * unsupported kind / missing reinforcement / degenerate layout.
 */
export function assignColumnBarNumbers(params: ColumnParams): number[] | null {
  const r = params.reinforcement;
  if (!r) return null;
  const layout = resolveColumnRebarLayoutForParams(r, params);
  if (!layout || layout.longitudinalBarsMm.length === 0) return null;

  const world = columnLocalMmToWorld(params, layout.longitudinalBarsMm);
  const order = world.map((_, i) => i).sort((a, b) => {
    const ka = world[a].x + world[a].y;
    const kb = world[b].x + world[b].y;
    if (ka !== kb) return ka - kb;            // primary: left → right in iso
    if (world[a].y !== world[b].y) return world[a].y - world[b].y; // tie-break
    return world[a].x - world[b].x;
  });

  const numbers = new Array<number>(world.length);
  order.forEach((barIndex, rank) => { numbers[barIndex] = rank + 1; });
  return numbers;
}
