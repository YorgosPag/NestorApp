/**
 * ADR-422 L7.3 Slice E / ADR-369 — Σύνθεση μαζών γειτονικών κτιρίων ως εμπόδια
 * ορίζοντα (PURE SSoT).
 *
 * Παίρνει τα **εξωτ. footprints** άλλων κτιρίων του site (στο **τοπικό** τους frame) +
 * την τοποθέτησή τους (`siteOrigin`/`rotation`, ADR-369) + το συνολικό ύψος, και παράγει
 * `HorizonObstacle[]` **στο frame του ενεργού κτιρίου** (μέσω `site-placement-transform`),
 * έτοιμα για τον ray-cast ορίζοντα (`solar-horizon-geometry`). Καθαρή γεωμετρία — μηδέν
 * scene/store/React (ο hook `useSiteNeighbourMasses` δίνει τα inputs).
 *
 * **Ύψος μάζας (v1):** `topElevationM = baseElevation + floorCount · storeyHeight`
 * (απλό μοντέλο εξώθησης — ο μηχανικός/μεγάλοι παίχτες χρησιμοποιούν per-floor ύψη·
 * **per-floor elevation + setback footprints = future**). Documented heuristic — η
 * σκίαση ορίζοντα είναι advisory (όπως όλο το ΚΕΝΑΚ pipeline). Κενό footprint (<3
 * κορυφές) ή μη-θετικός αριθμός ορόφων ⇒ παραλείπεται (zero-regression).
 *
 * @see ./site-placement-transform (ADR-369 transform local→active)
 * @see ./solar-horizon-geometry (consumer — ray-cast ορίζοντα)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3 Slice E)
 */

import type { Point2DLike } from './solar-overhang-geometry';
import type { HorizonObstacle } from './solar-horizon-geometry';
import {
  transformPolygonToActiveFrame,
  type BuildingPlacement,
} from './site-placement-transform';

/** Default ύψος ορόφου (m) όταν δεν αντλείται από τη γεωμετρία — v1 heuristic. */
export const DEFAULT_STOREY_HEIGHT_M = 3;

/** Ένα γειτονικό κτίριο: footprint στο **τοπικό** του frame + τοποθέτηση + ύψος. */
export interface NeighbourBuildingInput {
  /** Εξωτ. footprint (κλειστό XY, **τοπικό** scene frame του κτιρίου, scene units). */
  readonly footprintLocalXY: readonly Point2DLike[];
  /** Τοποθέτηση του κτιρίου στο site (ADR-369) + κλίμακα της σκηνής του. */
  readonly placement: BuildingPlacement;
  /** METRES — ύψος βάσης του κτιρίου στο site datum (`Building.baseElevation`). */
  readonly baseElevationM: number;
  /** Αριθμός ορόφων (για το συνολικό ύψος εξώθησης). */
  readonly floorCount: number;
  /** METRES — ύψος ανά όροφο (default {@link DEFAULT_STOREY_HEIGHT_M}). */
  readonly storeyHeightM: number;
}

/** Απόλυτο ύψος κορυφής (site datum): `baseElevation + floorCount · storeyHeight`. Pure. */
export function resolveBuildingTopElevationM(
  baseElevationM: number,
  floorCount: number,
  storeyHeightM: number,
): number {
  const floors = Number.isFinite(floorCount) && floorCount > 0 ? floorCount : 0;
  const height = Number.isFinite(storeyHeightM) && storeyHeightM > 0 ? storeyHeightM : DEFAULT_STOREY_HEIGHT_M;
  return (Number.isFinite(baseElevationM) ? baseElevationM : 0) + floors * height;
}

/**
 * Συνθέτει τα `HorizonObstacle[]` στο frame του **ενεργού** κτιρίου από τα γειτονικά
 * κτίρια: μεταφέρει κάθε footprint (`transformPolygonToActiveFrame`, ADR-369) και
 * υπολογίζει το απόλυτο ύψος κορυφής. Παραλείπει degenerate (footprint <3 κορυφές ή
 * `floorCount ≤ 0`). Pure, idempotent — κενή λίστα ⇒ καμία σκίαση ⇒ zero-regression.
 */
export function buildHorizonObstacles(
  neighbours: readonly NeighbourBuildingInput[],
  active: BuildingPlacement,
): HorizonObstacle[] {
  const obstacles: HorizonObstacle[] = [];
  for (const n of neighbours) {
    if (n.footprintLocalXY.length < 3 || !(n.floorCount > 0)) continue;
    obstacles.push({
      polygonXY: transformPolygonToActiveFrame(n.footprintLocalXY, n.placement, active),
      topElevationM: resolveBuildingTopElevationM(n.baseElevationM, n.floorCount, n.storeyHeightM),
    });
  }
  return obstacles;
}
