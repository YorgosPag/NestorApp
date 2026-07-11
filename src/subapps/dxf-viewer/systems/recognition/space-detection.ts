/**
 * ADR-423 / ADR-424 — Stage 0 room/space detection (agnostic).
 *
 * Promotes every closed wall loop to a `RecognizedSpace`, by REUSING the ADR-419
 * region/perimeter engine (`getCachedRegionPerimeters`) — zero new geometry math.
 * Pure polygon helpers (`polygonArea`/`polygonCentroid`) come from the ADR-363
 * polygon-math SSoT. No MEP/structural coupling: this is the shared foundation.
 *
 * @see ../../bim/walls/perimeter-from-faces.ts (getCachedRegionPerimeters)
 * @see ../../bim/walls/perimeter-polygon-math.ts (polygonArea, polygonCentroid)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  getCachedRegionPerimeters,
  type ClosedPerimeter,
} from '../../bim/walls/perimeter-from-faces';
import { polygonArea, polygonCentroid } from '../../bim/walls/perimeter-polygon-math';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import type { RecognizedSpace } from './recognition-types';

/** Default gap-tolerant loop-closure (ADR-419 Layer 2), in mm. */
export const DEFAULT_SPACE_TOLERANCE_MM = REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM;

/** Scene-units² → m². `scale` = scene units per mm (`mmToSceneUnits`). */
function sceneAreaToM2(areaScene: number, scale: number): number {
  const s = scale > 0 ? scale : 1;
  return areaScene / (s * s * 1_000_000);
}

/** Deterministic, geometry-hashed space id — no Date/random (stable + testable). */
function spaceIdFor(storeyId: string, centroid: Point2D, areaM2: number): string {
  const cx = Math.round(centroid.x);
  const cy = Math.round(centroid.y);
  const a = Math.round(areaM2 * 100);
  return `space:${storeyId}:${cx}:${cy}:${a}`;
}

/**
 * Direct inner voids of `outer`: smaller perimeters whose centroid lies inside it
 * and that are NOT nested inside another such void. Mirror of the auto-area
 * hole-detection rule (ADR-419), applied to the region perimeters.
 */
function findHoles(
  outer: readonly Point2D[],
  all: readonly ClosedPerimeter[],
): readonly (readonly Point2D[])[] {
  const outerArea = polygonArea(outer);
  const candidates = all
    .filter((q) => q.polygon !== outer && polygonArea(q.polygon) < outerArea)
    .filter((q) => isPointInPolygon(polygonCentroid(q.polygon), [...outer]))
    .map((q) => q.polygon);
  // Keep only DIRECT holes: drop any candidate nested inside another candidate.
  return candidates.filter(
    (h) =>
      !candidates.some(
        (other) =>
          other !== h &&
          polygonArea(other) > polygonArea(h) &&
          isPointInPolygon(polygonCentroid(h), [...other]),
      ),
  );
}

function buildSpace(
  perimeter: ClosedPerimeter,
  all: readonly ClosedPerimeter[],
  storeyId: string,
  scale: number,
): RecognizedSpace {
  const { polygon, shape } = perimeter;
  const centroid = polygonCentroid(polygon);
  const area = sceneAreaToM2(polygonArea(polygon), scale);
  return {
    spaceId: spaceIdFor(storeyId, centroid, area),
    polygon,
    holes: findHoles(polygon, all),
    area,
    centroid,
    shape,
    classification: 'unknown',
    classificationConfidence: 0,
    containedElementIds: [],
    storeyId,
  };
}

/**
 * Detect every wall-bounded space in a storey's entities. `tolMm` is the
 * gap-tolerant loop-closure tolerance (ADR-419 Layer 2). Returns gross-area
 * spaces with their direct holes; classification is filled later.
 */
export function detectSpaces(
  entities: readonly Entity[],
  storeyId: string,
  sceneUnits: SceneUnits,
  tolMm: number = DEFAULT_SPACE_TOLERANCE_MM,
): readonly RecognizedSpace[] {
  const scale = mmToSceneUnits(sceneUnits); // scene units per mm
  const tol = tolMm * scale; // mm → scene units
  // ADR-638 §wall-aware (Giorgio 2026-07-11) — οι BIM τοίχοι/κολόνες οριοθετούν χώρους
  // ΟΠΩΣ οι DXF γραμμές (Revit «room bounding»). Χωρίς αυτό, ένα δωμάτιο σχεδιασμένο
  // μόνο με BIM τοίχους δεν αναγνωριζόταν ως χώρος (μόνο DXF loops πιάνονταν).
  const perimeters = getCachedRegionPerimeters(entities, tol, tol, true);
  return perimeters.map((p) => buildSpace(p, perimeters, storeyId, scale));
}
