/**
 * plan-to-world-math — the DXF-plan → three-world AXIS CONVENTION, in one THREE-free place.
 *
 * DXF plan:  x = east, y = north, z = elevation   (millimetres, or metres in the metre-domains)
 * three:     x = east, y = elevation, z = −north  (Y-up, right-handed, metres — ADR-009)
 *
 * ### Why this file exists (ADR-650 M5α.2 / N.0.2)
 * The mapping `(x, elev, −y)` was written out in TWO places that could not import each other:
 * `coordinate-transforms.ts` (metres, needs `three` for its `Vector3` overload) and
 * `clash-marker-math.ts` (deliberately THREE-free so it stays unit-testable and importable from
 * DOM panels). Adding the topography-QA marker would have made three copies of a convention where
 * a single flipped sign is invisible in review and shows up as markers mirrored across the site.
 *
 * So the convention now lives HERE, importing nothing — and both of the above delegate to it.
 * THREE-free is the load-bearing property: it is what lets a DOM report panel convert its own
 * domain coordinates before putting them on the view-focus bus, without pulling three into the
 * panel's module graph.
 *
 * @see ./coordinate-transforms.ts — the three-typed callers (`dxfPlanToWorld`, `writeDxfPlanToWorld`)
 * @see ../coordination/clash-marker-math.ts — clash points (already metres)
 * @see ../coordination/topo-qa-marker-math.ts — topography QA flags (ΕΓΣΑ mm + datum)
 */

/** A three-world position in metres, Y-up. Plain tuple — no `THREE.Vector3` allocation. */
export interface WorldTriple {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const MM_TO_M = 0.001;

/**
 * Plan METRES → three-world metres. The pure axis swap, no scaling.
 *
 * `0 - north` (not `-north`) so plan-north 0 maps to +0, never −0: a −0 leaks into serialized
 * coordinates and into `Object.is` comparisons as a value that is equal to 0 but not identical.
 */
export function planMetresToWorld(east: number, north: number, elevation: number): WorldTriple {
  return { x: east, y: elevation, z: 0 - north };
}

/** Plan canonical MILLIMETRES (ADR-462) → three-world metres. Scale, then the same axis swap. */
export function planMmToWorld(eastMm: number, northMm: number, elevationMm: number): WorldTriple {
  return planMetresToWorld(eastMm * MM_TO_M, northMm * MM_TO_M, elevationMm * MM_TO_M);
}
