/**
 * ADR-650 M5β — remove elevation-bust spikes from the RAW survey.
 *
 * The ONE destructive edit the NL assistant may request — and only after the engineer
 * confirms (§9 human-certifier). It does NOT invent geometry: the M5α detector
 * (`checkElevationBusts`) is the single source of «what is a spike», so «σβήσε τα spikes»
 * removes exactly the points the deterministic QA pass already flags.
 *
 * A flagged TIN node is matched back to its raw survey point through the SAME micrometre
 * grid key the TIN builder deduped on (`localVertexKey`) — so the node↔point correspondence
 * can never round differently than the triangulation itself did. Nodes born from a breakline
 * vertex (not a survey point) match no raw point and are left untouched: we delete survey
 * blunders, never constraint geometry.
 *
 * `preview*` reports without mutating (the confirm dialog reads it); `remove*` mutates the
 * raw `TopoPointStore` through its existing `setTopoPoints` writer — so undo/derive/persist
 * behave exactly as for any other survey edit.
 */

import { getTopoPoints, setTopoPoints } from './TopoPointStore';
import { getTopoSurface } from './topo-surface';
import { localVertexKey } from './tin-builder';
import { checkElevationBusts } from './qa/check-elevation-busts';
import type { TopoSurfaceId } from './topo-types';

/** Raw-point indices whose LOCAL grid cell matches an elevation-bust TIN node. */
function collectSpikePointIndices(surfaceId: TopoSurfaceId): number[] {
  const surface = getTopoSurface(surfaceId);
  const flags = checkElevationBusts(surface);
  if (flags.length === 0) return [];

  const { origin } = surface;
  const bustKeys = new Set(
    flags.map((f) => localVertexKey(f.at.x - origin.x, f.at.y - origin.y)),
  );

  const indices: number[] = [];
  getTopoPoints(surfaceId).forEach((p, i) => {
    if (bustKeys.has(localVertexKey(p.x - origin.x, p.y - origin.y))) indices.push(i);
  });
  return indices;
}

/**
 * How many raw survey points are elevation-bust spikes right now — NO mutation. The confirm
 * step reads this so the engineer sees «Να διαγραφούν N σημεία;» before anything is deleted.
 */
export function previewElevationSpikes(surfaceId: TopoSurfaceId = 'existing'): number {
  return collectSpikePointIndices(surfaceId).length;
}

/**
 * Delete the currently-flagged elevation-bust spike points from a surface's raw survey.
 * Returns how many were removed (`0` = nothing flagged → no write). Re-running re-detects
 * against the rebuilt surface, so a clean survey removes nothing (Civil 3D's per-run model).
 */
export function removeElevationSpikes(surfaceId: TopoSurfaceId = 'existing'): number {
  const drop = new Set(collectSpikePointIndices(surfaceId));
  if (drop.size === 0) return 0;
  const points = getTopoPoints(surfaceId);
  const kept = points.filter((_, i) => !drop.has(i));
  setTopoPoints(kept, surfaceId);
  return points.length - kept.length;
}
