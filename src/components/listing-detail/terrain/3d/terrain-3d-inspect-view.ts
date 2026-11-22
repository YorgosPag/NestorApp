/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΕΠΙΘΕΩΡΗΣΗΣ → ΤΙ ΔΕΙΧΝΕΙ Η ΣΚΗΝΗ 3Δ** — καθαρή μετάφραση, χωρίς three (ADR-920 §14.10 Ε2).
 * @related `../terrain-inspect-store` (η ΜΙΑ κατάσταση, κοινή με την κάτοψη) · `terrain-3d-inspect-overlay.ts` (ο ζωγράφος)
 * @module components/listing-detail/terrain/3d/terrain-3d-inspect-view
 *
 * 🔑 Ό,τι φαίνεται στο 3Δ είναι ό,τι φαίνεται στην κάτοψη: ίδιο σημείο, ίδια ισοϋψής (από τα `contours` του snapshot), ίδια
 *   τομή, ίδια σταγόνα. Η τομή σπάει σε κομμάτια όπου βγαίνει από την επιφάνεια — ποτέ γέφυρα πάνω από κενό.
 */

import type { TerrainPointReading } from '@/lib/terrain/inspect/terrain-point-reading';
import type { TerrainProfile } from '@/lib/terrain/inspect/terrain-profile';

import { activeReading, type TerrainInspectState, type TerrainInspectStore } from '../terrain-inspect-store';
import type { GroundPoint, Terrain3dInspectView } from './terrain-3d-inspect-overlay';

const groundOf = (reading: TerrainPointReading | null): GroundPoint | null =>
  reading === null ? null : { x: reading.x, y: reading.y, z: reading.elevationM };

/** Οι σταθμοί της τομής σε συνεχή κομμάτια πάνω στην επιφάνεια. */
function profileRunsOf(profile: TerrainProfile | null): GroundPoint[][] {
  if (profile === null) return [];
  const runs: GroundPoint[][] = [];
  let run: GroundPoint[] = [];
  profile.stations.forEach((station, i) => {
    const onSurface = station.z !== null && (i === 0 || profile.pieces[i - 1].onSurface);
    if (!onSurface && run.length > 0) { runs.push(run); run = []; }
    if (station.z !== null) run.push({ x: station.x, y: station.y, z: station.z });
  });
  if (run.length > 0) runs.push(run);
  return runs;
}

export function terrain3dInspectViewOf(state: TerrainInspectState, store: TerrainInspectStore): Terrain3dInspectView {
  const reading = activeReading(state);
  const contourIndex = reading?.nearestContour?.contour;
  return {
    probe: groundOf(state.probe),
    pinned: groundOf(state.pinned),
    contour: contourIndex === undefined ? null : store.index().snapshot.contours[contourIndex] ?? null,
    profileRuns: profileRunsOf(state.profile),
    flow: state.flow?.points ?? null,
  };
}
