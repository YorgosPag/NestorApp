/**
 * ADR-363 §column-polygon-sketch — «Κολώνα από σχεδιασμένο πολύγωνο» geometry bridge.
 *
 * Ο χρήστης σχεδιάζει ελεύθερα ένα κλειστό περίγραμμα με διαδοχικά κλικ (vertex chain,
 * ΙΔΙΟ engine με το slab — `usePolygonSketchChain`) → ΕΝΑ `ColumnEntity`. Αυτός ο adapter
 * είναι λεπτός: η σχεδιασμένη περίμετρος περνά από τον ΙΔΙΟ builder με τα περιγράμματα-
 * από-γραμμές («Κολώνα από περίγραμμα», ADR-363 Φ3) → **μηδέν παράλληλη geometry**.
 *
 * Το σχήμα ταξινομείται αυτόματα (SSoT `classifyPerimeter`):
 *   - ορθογώνιο aspect ≤ 4 → `rectangular` (κολώνα)
 *   - ορθογώνιο aspect > 4 → `shear-wall` (τοιχίο, Eurocode 8 §5.4.2.4)
 *   - Π (U) → `U-shape` (polygon-backed)· Γ/Τ/σύνθετο → `composite` (ακριβές πολύγωνο)
 *
 * @see ./column-from-faces.ts (κοινός builder — `buildColumnsFromPerimeters`)
 * @see ../walls/perimeter-from-faces.ts (`polygonToClosedPerimeter` SSoT)
 * @see ../../hooks/drawing/use-polygon-sketch-chain.ts (vertex-chain FSM)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity } from '../types/column-types';
import type { SceneUnits } from '../../utils/scene-units';
import { polygonToClosedPerimeter } from '../walls/perimeter-from-faces';
import { resolveRegionLoopTolWorld } from '../walls/region-tolerance';
import { buildColumnsFromPerimeters } from './column-from-faces';

/**
 * Σχεδιασμένο κλειστό πολύγωνο (≥3 κορυφές, world scene units) → ΕΝΑ `ColumnEntity`,
 * ή `null` αν ο validator το απορρίψει (π.χ. εκφυλισμένο/υπερμεγέθες). Reuse-ONLY:
 * `polygonToClosedPerimeter` (normalize+classify+decompose) → `buildColumnsFromPerimeters`
 * (ίδιο path με «από περίγραμμα»· ίδιο loop-detection tolerance).
 */
export function buildColumnFromSketchedPolygon(
  vertices: readonly Point2D[],
  layerId: string,
  sceneUnits: SceneUnits,
): ColumnEntity | null {
  if (vertices.length < 3) return null;
  const tol = resolveRegionLoopTolWorld(sceneUnits);
  const perimeter = polygonToClosedPerimeter(vertices, tol);
  const { columns } = buildColumnsFromPerimeters([perimeter], layerId, sceneUnits);
  return columns[0] ?? null;
}
