/**
 * ADR-444 §Icons — MEP icon subjects for LINEAR networks & generative tools (pure).
 *
 * Pipes, ducts and loops have no fixed plan "symbol" — they are drawn along a route.
 * Their icons follow the plan's own conventions instead, reusing its SSoT pieces
 * wherever one exists:
 *   - pipe        → centreline + the plan's midpoint tick (`buildPipeTickScreen`)
 *   - drain pipe  → the same pipe glyph falling to a gravity-flow arrowhead
 *   - duct        → the two duct walls (plan width) + the supply-section cross
 *   - underfloor  → the serpentine loop the underfloor renderer strokes
 *   - networks    → a source node feeding branches (derive-networks command)
 *   - bathroom    → a room outline holding the REAL WC + washbasin plan symbols
 */

import type { PlanarPoint } from '../../../../bim/types/bim-base';
import { buildPipeTickScreen } from '../../../../bim/mep-segments/mep-segment-symbol';
import { ellipse } from '../../../../bim/floorplan-symbols/symbol-vector-helpers';
import { SANITARY_SPEC, SANITARY_DRAWERS } from '../../../../bim/sanitary/sanitary-symbol-spec';
import {
  iconFootprint, footprintOutline,
  type IconStroke, type MepIconGeometry,
} from './mep-icon-geometry';

/** A straight run + its plan midpoint tick (the pipe identity mark). */
function tickedRun(a: PlanarPoint, b: PlanarPoint): IconStroke[] {
  const tick = buildPipeTickScreen(a, b, 3);
  return tick ? [[a, b], [tick.a, tick.b]] : [[a, b]];
}

/** Small round node (pipe end / network node). */
function node(c: PlanarPoint, r: number): IconStroke {
  return ellipse(iconFootprint(1, 1, c, r * 2), 0.5, 0.5, 0.5, 0.5, 20);
}

/** Supply pipe: a diagonal run between two connector nodes, ticked mid-span. */
export function pipeIcon(): MepIconGeometry {
  const a = { x: 5, y: 19 };
  const b = { x: 19, y: 5 };
  return { body: [...tickedRun({ x: 6.6, y: 17.4 }, { x: 17.4, y: 6.6 }), node(a, 2.2), node(b, 2.2)] };
}

/** Gravity-flow arrowhead at `tip`, pointing along `from → tip`. */
function arrowHead(from: PlanarPoint, tip: PlanarPoint, len: number, halfWidth: number): IconStroke {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const back = { x: tip.x - ux * len, y: tip.y - uy * len };
  return [
    { x: back.x - uy * halfWidth, y: back.y + ux * halfWidth },
    tip,
    { x: back.x + uy * halfWidth, y: back.y - ux * halfWidth },
  ];
}

/** Drain pipe: the ticked run FALLING left→right into a gravity-flow arrowhead. */
export function drainPipeIcon(): MepIconGeometry {
  const a = { x: 3, y: 7 };
  const b = { x: 20, y: 17 };
  return { body: [...tickedRun(a, b), arrowHead(a, b, 4.5, 2.6)] };
}

/** Duct: two parallel walls (duct width) + end caps + the supply-section diagonal cross. */
export function ductIcon(): MepIconGeometry {
  const fp = iconFootprint(20, 9);
  const [v0, v1, v2, v3] = fp;
  return {
    body: [footprintOutline(fp)],
    detail: [[v0, v2], [v1, v3]],
  };
}

/** Underfloor heating: the serpentine loop inside the heated zone. */
export function underfloorIcon(): MepIconGeometry {
  const loop: PlanarPoint[] = [
    { x: 3, y: 4 }, { x: 21, y: 4 }, { x: 21, y: 9 }, { x: 3, y: 9 },
    { x: 3, y: 14 }, { x: 21, y: 14 }, { x: 21, y: 19 }, { x: 3, y: 19 },
  ];
  return { body: [loop] };
}

/** Derive networks: a source node feeding three branch nodes (topology → systems). */
export function pipeNetworkIcon(): MepIconGeometry {
  const source = { x: 5, y: 12 };
  const branches = [{ x: 19, y: 5 }, { x: 19, y: 12 }, { x: 19, y: 19 }];
  const trunkEnd = { x: 11, y: 12 };
  return {
    body: [
      footprintOutline(iconFootprint(1, 1, source, 4.4)),
      [{ x: 7.2, y: 12 }, trunkEnd],
      ...branches.map((b): IconStroke => [trunkEnd, { x: b.x - 2.2, y: b.y }]),
      ...branches.map((b) => node(b, 2.2)),
    ],
  };
}

/** Bathroom auto-arrange: a room holding the real WC + washbasin plan symbols. */
export function bathroomIcon(): MepIconGeometry {
  const room = iconFootprint(20, 20);
  const wcSpec = SANITARY_SPEC.wc;
  const basinSpec = SANITARY_SPEC.washbasin;
  const wc = iconFootprint(wcSpec.widthMm, wcSpec.depthMm, { x: 7, y: 8.5 }, 9);
  const basin = iconFootprint(basinSpec.widthMm, basinSpec.depthMm, { x: 15.5, y: 6 }, 7);
  return {
    body: [footprintOutline(room)],
    detail: [
      footprintOutline(wc), ...SANITARY_DRAWERS.wc(wc),
      footprintOutline(basin), ...SANITARY_DRAWERS.washbasin(basin),
    ],
  };
}
