/**
 * Tread label generator (ADR-358 §5.1 G21, Phase 3b).
 *
 * Pure function. Used by every kind computer (straight, l-shape, u-shape,
 * gamma, …) to derive `StairGeometry.treadLabels` from the tread polygons +
 * the `treadLabel*` params. Centralized to enforce SSoT — every kind shares
 * identical numbering semantics.
 *
 *   - `display === 'none'`  → returns `undefined` (caller emits no labels).
 *   - `display === 'all'`   → emits one label per tread.
 *   - `display === 'nth'`   → emits when `localIndex % everyN === 0`.
 *
 * Local index resets at each flight boundary when `restartPerFlight === true`,
 * otherwise it equals the global tread index. The displayed text is
 * `treadNumberStart + localIndex` (raw integer, formatter is a render concern).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 G21
 */

import type { Point3D } from '../../rendering/types/Types';
import type {
  Polygon3D,
  StairTreadLabel,
  StairTreadLabelDisplay,
} from '../../types/stair';

const DEFAULT_NTH = 5;

export function buildTreadLabels(
  treads: readonly Polygon3D[],
  flightSplit: readonly number[],
  display: StairTreadLabelDisplay,
  everyN: number | undefined,
  restartPerFlight: boolean,
  treadNumberStart: number,
): readonly StairTreadLabel[] | undefined {
  if (display === 'none') return undefined;
  const step = display === 'nth' ? Math.max(1, everyN ?? DEFAULT_NTH) : 1;
  const labels: StairTreadLabel[] = [];
  let globalIdx = 0;
  for (const flightSize of flightSplit) {
    for (let i = 0; i < flightSize; i++) {
      if (globalIdx >= treads.length) return labels;
      const localIdx = restartPerFlight ? i : globalIdx;
      if (localIdx % step === 0) {
        labels.push({
          treadIndex: globalIdx,
          position: centroid3D(treads[globalIdx]),
          text: String(treadNumberStart + localIdx),
        });
      }
      globalIdx++;
    }
  }
  return labels;
}

/**
 * ADR-358 Phase 3e — Tread + landing label generator (convention γ).
 *
 * Used by l-shape / u-shape / gamma. Landings are interleaved between
 * flights and numbered with the same global counter as treads, so
 * `flight1 (1..n1) → landing1 (n1+1) → flight2 (n1+2..) → [landing2 → flight3]`.
 * When `restartPerFlight === true`, the local index resets at each flight
 * boundary; the landing's local index equals `flightSize` (i.e. it is the
 * trailing step of the preceding flight in plan-view convention).
 *
 * `landings.length` must equal `flightSplit.length - 1` (one landing per
 * inter-flight boundary). Out-of-range landings are ignored.
 */
export function buildTreadLabelsWithLandings(
  treads: readonly Polygon3D[],
  landings: readonly Polygon3D[],
  flightSplit: readonly number[],
  display: StairTreadLabelDisplay,
  everyN: number | undefined,
  restartPerFlight: boolean,
  treadNumberStart: number,
): readonly StairTreadLabel[] | undefined {
  if (display === 'none') return undefined;
  const step = display === 'nth' ? Math.max(1, everyN ?? DEFAULT_NTH) : 1;
  const labels: StairTreadLabel[] = [];
  let globalIdx = 0;
  let treadCursor = 0;
  for (let f = 0; f < flightSplit.length; f++) {
    const flightSize = flightSplit[f];
    for (let i = 0; i < flightSize; i++) {
      if (treadCursor >= treads.length) break;
      const localIdx = restartPerFlight ? i : globalIdx;
      if (localIdx % step === 0) {
        labels.push({
          treadIndex: treadCursor,
          position: centroid3D(treads[treadCursor]),
          text: String(treadNumberStart + localIdx),
          kind: 'tread',
        });
      }
      treadCursor++;
      globalIdx++;
    }
    if (f < flightSplit.length - 1) {
      const landing = landings[f];
      if (landing !== undefined) {
        const localIdx = restartPerFlight ? flightSize : globalIdx;
        if (localIdx % step === 0) {
          labels.push({
            treadIndex: treadCursor,
            position: centroid3D(landing),
            text: String(treadNumberStart + localIdx),
            kind: 'landing',
          });
        }
      }
      globalIdx++;
    }
  }
  return labels;
}

function centroid3D(polygon: Polygon3D): Point3D {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const p of polygon) {
    sx += p.x;
    sy += p.y;
    sz += p.z;
  }
  const n = polygon.length;
  return { x: sx / n, y: sy / n, z: sz / n };
}
