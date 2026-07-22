/**
 * mesh-fill-union.worker — ADR-683 §10.9.2: EXACT top-view fill footprint, off the main thread.
 *
 * Big-player precision without the freeze: the mathematically exact plan outline of an imported
 * mesh is the boolean UNION of its projected triangles (few vertices, perfectly symmetric — the
 * raster trace could only approximate it). That union is heavy (~4s for the 42k-triangle seat
 * frame), so it runs HERE, on a dedicated worker thread, while the main thread shows the instant
 * raster contour as a placeholder. When this resolves, the cache swaps raster → exact and repaints.
 *
 * ⚠️ MUST stay framework-free (no react / three / DOM / stores) — same doctrine as the DXF parse
 * worker (ADR-639). Input is a PLAIN `Float32Array` of already-projected plan triangles
 * (`[x1,y1,x2,y2,x3,y3,…]`, CCW, plan meters) computed on the main thread by `computeTopFillTriangles`;
 * this worker only imports the pure MIT `polygon-clipping` and returns flat rings.
 *
 * Robustness: `polygon-clipping`'s sweep-line is fragile at meter scale (~0–2), so coordinates are
 * scaled up + snapped to an integer grid before the union and un-scaled after — the same technique
 * as `safe-polygon-boolean.ts` (`ROBUST_SPAN`), inlined here to keep the worker closure pure.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.9.2
 */

import polygonClipping from 'polygon-clipping';
import type { Polygon } from 'polygon-clipping';

/** Meter-scale → robust integer grid factor (0.5m → 5000; snap kills float micro-segments). */
const SCALE = 1e4;

interface UnionRequest {
  readonly requestId: string;
  readonly key: string;
  /** Flat CCW plan triangles `[x1,y1,x2,y2,x3,y3,…]` in plan meters (from `computeTopFillTriangles`). */
  readonly triangles: Float32Array;
}

/** Flat plan-meter rings `[x0,y0,x1,y1,…]` — outer boundaries + holes, ready for even-odd fill. */
type FlatRing = number[];

/** Union the projected triangles into exact plan rings (outer boundaries + holes). */
function unionTrianglesToRings(triangles: Float32Array): FlatRing[] {
  const polys: Polygon[] = [];
  for (let i = 0; i + 5 < triangles.length; i += 6) {
    const ax = Math.round(triangles[i] * SCALE), ay = Math.round(triangles[i + 1] * SCALE);
    const bx = Math.round(triangles[i + 2] * SCALE), by = Math.round(triangles[i + 3] * SCALE);
    const cx = Math.round(triangles[i + 4] * SCALE), cy = Math.round(triangles[i + 5] * SCALE);
    // Skip triangles that collapse to zero area on the snap grid (thin weave slivers → no signal).
    if ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay) === 0) continue;
    polys.push([[[ax, ay], [bx, by], [cx, cy], [ax, ay]]]);
  }
  if (polys.length === 0) return [];

  const merged = polygonClipping.union(polys[0], ...polys.slice(1));
  const rings: FlatRing[] = [];
  for (const poly of merged) {
    for (const ring of poly) {
      const closed =
        ring.length > 1 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1];
      const lim = closed ? ring.length - 1 : ring.length;
      const flat: FlatRing = [];
      for (let k = 0; k < lim; k++) flat.push(ring[k][0] / SCALE, ring[k][1] / SCALE);
      if (flat.length >= 6) rings.push(flat);
    }
  }
  return rings;
}

self.addEventListener('message', (event: MessageEvent<UnionRequest>) => {
  const { requestId, key, triangles } = event.data;
  try {
    const rings = unionTrianglesToRings(triangles);
    (self as unknown as Worker).postMessage({ requestId, key, rings });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      requestId,
      key,
      error: err instanceof Error ? err.message : 'mesh-fill-union failed',
    });
  }
});

// Empty export keeps this file a module under `isolatedModules`.
export {};
