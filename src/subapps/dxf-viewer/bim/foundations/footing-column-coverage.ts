/**
 * Footing ↔ Column bearing coverage — SSoT criterion (ADR-459 Phase 2).
 *
 * ΕΝΑ μοναδικό κριτήριο «αυτό το πέδιλο στηρίζει τη βάση αυτής της κολόνας»,
 * μοιραζόμενο από:
 *   · `structural-graph.ts` (`buildFootingEdges`) — DERIVED `footing-bearing` ακμές.
 *   · `foundation-column-attach-coordinator.ts` — explicit FK auto-attach detection.
 *
 * Boy Scout (N.0.2): το κριτήριο ζούσε inline στον graph builder· εξήχθη εδώ ώστε
 * graph + coordinator να ΜΗΝ αποκλίνουν ποτέ (μηδέν duplicate detection logic).
 *
 * Κριτήριο (plan coincidence + κατακόρυφο gate):
 *   1. Άνω παρειά πεδίλου ΟΧΙ ψηλότερα από τη βάση της κολόνας (με slack gate).
 *   2. Το κέντρο της βάσης της κολόνας πέφτει μέσα στο footprint του πεδίλου.
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see structural-graph.ts
 * @see foundation-column-attach-coordinator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 */

import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

/** Plan-space σημείο (canvas units — ίδιο space με footprints). */
export interface CoveragePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * mm. Ένα πέδιλο στηρίζει τη βάση κολόνας μόνο όταν η άνω παρειά του δεν είναι
 * ΠΑΝΩ από τη βάση της κολόνας (ίδια λογική με τον `AUTO_ATTACH_Z_GATE_MM`).
 */
export const FOOTING_Z_GATE_MM = 1;

/** Plan-centroid ενός footprint (μέσος όρος κορυφών). */
export function polygonCentroid(poly: readonly CoveragePoint[]): CoveragePoint {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/**
 * True αν το πέδιλο στηρίζει τη βάση της κολόνας (το ΕΝΑ SSoT κριτήριο).
 *   - `footing.topZmm` — absolute mm, άνω παρειά πεδίλου.
 *   - `column.baseZmm` — absolute mm, κάτω παρειά (βάση) κολόνας.
 *   - `column.baseCentroid` — plan-centroid του footprint βάσης της κολόνας.
 */
export function footingSupportsColumnBase(
  footing: { readonly footprint: readonly CoveragePoint[]; readonly topZmm: number },
  column: { readonly baseCentroid: CoveragePoint; readonly baseZmm: number },
): boolean {
  if (footing.footprint.length < 3) return false;
  if (footing.topZmm > column.baseZmm + FOOTING_Z_GATE_MM) return false;
  return isPointInPolygon(column.baseCentroid, [...footing.footprint]);
}
