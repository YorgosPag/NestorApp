/**
 * Beam Axis Projection — pure SSoT (ADR-398 §Column→Beam axis snap).
 *
 * Snap-to-beam-axis perpendicular projection — **ακριβές mirror** του
 * `projectPointOnWallAxis` (ADR-363 Phase 5.5e). Γεμίζει το κενό της οικογένειας
 * per-member axis projection: walls/slabs/openings είχαν SSoT, τα δοκάρια **όχι**.
 * Το καταναλώνουν ο `NearestSnapEngine` (γενικό nearest snap, parity με τοίχο/πλάκα)
 * **και** το `column-placement-snap-context` (snap κολώνας στον άξονα δοκαριού).
 *
 * Δεν αναπαράγει Bezier maths: διαβάζει `beam.geometry.axisPolyline.points` (ήδη
 * cached· straight = 2 vertices, curved = tessellated) → όλα τα beam kinds λύνονται
 * uniformly σαν polyline projection. Ίδια shared utils με τον τοίχο
 * (`getNearestPointOnLine` + `calculateDistance`) → μηδέν διπλό geometry primitive.
 *
 * @see ../walls/wall-axis-projection.ts — το pattern που mirror-άρει (SSoT τοίχου)
 * @see ../../snapping/engines/NearestSnapEngine.ts — γενικός consumer
 * @see ../columns/column-placement-snap-context.ts — column-tool consumer
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

/** Float-noise ανοχή (world units) για το «το foot συμπίπτει με άκρο» τεστ. */
const ENDPOINT_EPS = 1e-6;

/** Πλούσιο αποτέλεσμα προβολής στον άξονα δοκαριού (foot + απόσταση + endpoint flag). */
export interface BeamAxisProjection {
  /** Πλησιέστερο σημείο πάνω στον centerline (clamped στο polyline). */
  readonly foot: Point2D;
  /** Απόσταση cursor→foot (≈ κάθετη απόσταση όταν εντός segment). */
  readonly distance: number;
  /** `true` όταν το foot συμπίπτει με άκρο του δοκαριού (ο cursor είναι **πέρα** από το μέλος). */
  readonly atEndpoint: boolean;
}

/**
 * Πλήρης clamped-nearest προβολή του cursor στον άξονα δοκαριού (NEAREST semantics,
 * mirror `projectPointOnWallAxis`). `null` όταν λείπει cached axis (defensive). Ο
 * column-tool consumer χρειάζεται `distance` (capture gate) + `atEndpoint` (μόνο πάνω
 * στο σώμα, όχι πέρα από τα άκρα).
 */
export function projectPointOnBeamAxisDetailed(
  beam: BeamEntity,
  cursor: Point2D,
): BeamAxisProjection | null {
  const points = beam.geometry?.axisPolyline?.points;
  if (!points || points.length < 2) return null;

  let foot: Point2D | null = null;
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a: Point2D = { x: points[i - 1].x, y: points[i - 1].y };
    const b: Point2D = { x: points[i].x, y: points[i].y };
    const candidate = getNearestPointOnLine(cursor, a, b, true);
    const d = calculateDistance(cursor, candidate);
    if (d < distance) {
      distance = d;
      foot = candidate;
    }
  }
  if (!foot) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const atEndpoint =
    calculateDistance(foot, { x: first.x, y: first.y }) < ENDPOINT_EPS ||
    calculateDistance(foot, { x: last.x, y: last.y }) < ENDPOINT_EPS;
  return { foot, distance, atEndpoint };
}

/**
 * Clamped nearest foot πάνω στον άξονα δοκαριού — NEAREST semantics (mirror
 * `projectPointOnWallAxis`). `null` όταν λείπει cached axis. Ο `NearestSnapEngine`
 * το καταναλώνει ώστε τα δοκάρια να αποκτούν nearest-snap parity με walls/slabs.
 */
export function projectPointOnBeamAxis(beam: BeamEntity, cursor: Point2D): Point2D | null {
  return projectPointOnBeamAxisDetailed(beam, cursor)?.foot ?? null;
}
