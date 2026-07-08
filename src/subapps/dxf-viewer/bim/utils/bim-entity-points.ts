/**
 * ADR-363 BIM Entity Key Points — 2D snap/grip/dimension key-point accessor.
 *
 * Καταναλώνεται από GeometricCalculations (snap engine), grips, dimensions.
 *
 * Δύο κατηγορίες (§κεντρικοποίηση ADR-597, 2026-07-05):
 *   - **Polygon-footprint** entities (slab/slab-opening/opening/column/floor-finish/thermal/
 *     mep-underfloor) → DELEGATE στο ΕΝΑ characteristic-point SSoT (`bim-characteristic-points`)
 *     αντί για inline `outline/footprint.vertices` extraction — ΜΙΑ πηγή γεωμετρίας, μηδέν
 *     divergence (το column bbox-anchor bug ήταν ακριβώς τέτοιο divergence).
 *   - **Linear** entities (beam/wall/space-separator) → axis endpoints/midpoints. Ξεχωριστός
 *     τύπος έλξης (Revit «Endpoint» στο location line ≠ «Corner» του σώματος) — μένει εδώ.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see bim/utils/bim-characteristic-points.ts (footprint-corner/midpoint SSoT — polygon delegate)
 * @see snapping/shared/GeometricCalculations.ts (primary consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isBeamEntity,
  isSlabEntity,
  isSlabOpeningEntity,
  isOpeningEntity,
  isWallEntity,
  isColumnEntity,
  isFloorFinishEntity,
  isThermalSpaceEntity,
  isSpaceSeparatorEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
// ADR-597 §κεντρικοποίηση (2026-07-05): οι column key points διαβάζονται από το ΕΝΑ
// characteristic-point SSoT (πραγματικές footprint γωνίες), ΟΧΙ από τα 9 bbox anchors.
import { getBimCharacteristicPointsOfCategory } from './bim-characteristic-points';
import { projectPointTo2D, projectVerticesTo2D } from '../geometry/shared/polygon-utils';

/**
 * Κύρια vertex/endpoint collection για BIM entity (2D projection).
 *
 * ΓΡΑΜΜΙΚΑ (axis endpoints — ξεχωριστός τύπος έλξης, Revit-style, ΔΕΝ είναι footprint γωνίες):
 * - beam           → axis endpoints (startPoint + endPoint)
 * - wall           → axis endpoints (straight/curved) OR all spine vertices (polyline)
 * - space-separator → 2 endpoints
 *
 * POLYGON-FOOTPRINT (§κεντρικοποίηση ADR-597 — delegate στο ΕΝΑ characteristic-corner SSoT):
 * - slab / slab-opening / opening / column / floor-finish / thermal-space / mep-underfloor
 *   → REAL footprint corners (για L/Γ/T/U τα actual reentrant vertices, ΟΧΙ bbox anchors).
 *
 * Returns [] for entity types not in the BIM domain.
 */
export function getBimEntityKeyPoints2D(entity: Entity): Point2D[] {
  if (isBeamEntity(entity)) {
    return [
      projectPointTo2D(entity.params.startPoint),
      projectPointTo2D(entity.params.endPoint),
    ];
  }

  if (isWallEntity(entity)) {
    const params = entity.params;
    if (entity.kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
      return projectVerticesTo2D(params.polylineVertices);
    }
    return [
      projectPointTo2D(params.start),
      projectPointTo2D(params.end),
    ];
  }

  // ADR-437 — space separator key points = its two endpoints (γραμμικό: axis, όχι footprint).
  if (isSpaceSeparatorEntity(entity)) {
    const { start, end } = entity.params;
    if (!start || !end) return [];
    return [projectPointTo2D(start), projectPointTo2D(end)];
  }

  // §κεντρικοποίηση (Giorgio 2026-07-05): ΟΛΑ τα polygon-footprint BIM entities (slab / slab-opening
  // / opening / column / floor-finish / thermal-space / mep-underfloor) διαβάζουν τις γωνίες τους ΑΠΟ
  // ΤΟ ΕΝΑ characteristic-point SSoT — μηδέν copy-paste `outline/footprint.vertices` extraction, μηδέν
  // divergence (π.χ. το column bbox-anchor bug που έβγαζε φάντασμα ■ στο κενό της L). Beam/wall/
  // space-separator είναι ΓΡΑΜΜΙΚΑ (axis endpoints — ξεχωριστός τύπος έλξης, όπως Revit) → μένουν πάνω.
  if (
    isSlabEntity(entity) || isSlabOpeningEntity(entity) || isOpeningEntity(entity) ||
    isColumnEntity(entity) || isFloorFinishEntity(entity) || isThermalSpaceEntity(entity) ||
    isMepUnderfloorEntity(entity)
  ) {
    return getBimCharacteristicPointsOfCategory(entity, 'corner');
  }

  return [];
}

/**
 * Edge midpoints για BIM entity (2D projection).
 *
 * - beam / wall (straight) → axis midpoint · wall (polyline) → per-segment midpoints (γραμμικά)
 * - slab / slab-opening / opening → per-edge midpoints via το ΕΝΑ characteristic SSoT
 *   (§κεντρικοποίηση ADR-597 — ordered per-edge, μηδέν copy-paste loop).
 *
 * Column και άλλα BIM types → [] (τα midpoints τους τα δίνει απευθείας το BimCharacteristicSnapEngine).
 */
export function getBimEntityEdgeMidpoints2D(entity: Entity): Point2D[] {
  if (isBeamEntity(entity)) {
    const { startPoint: s, endPoint: e } = entity.params;
    return [{ x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 }];
  }

  if (isWallEntity(entity)) {
    const params = entity.params;
    if (entity.kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
      const verts = params.polylineVertices;
      const midpoints: Point2D[] = [];
      for (let i = 1; i < verts.length; i++) {
        midpoints.push({ x: (verts[i - 1].x + verts[i].x) / 2, y: (verts[i - 1].y + verts[i].y) / 2 });
      }
      return midpoints;
    }
    return [{ x: (params.start.x + params.end.x) / 2, y: (params.start.y + params.end.y) / 2 }];
  }

  // §κεντρικοποίηση (Giorgio 2026-07-05): τα polygon entities (slab / slab-opening / opening)
  // διαβάζουν per-edge midpoints ΑΠΟ ΤΟ ΕΝΑ characteristic SSoT (`footprintEdgeMidpoints`, ordered)
  // — μηδέν copy-paste midpoint loop. ΜΟΝΟ αυτά τα 3 (ίδιο σύνολο με πριν) ώστε να ΜΗ μεταβληθεί το
  // σύνολο midpoint snaps του GeometricCalculations. Beam/wall = axis midpoint (γραμμικά, μένουν πάνω).
  if (isSlabEntity(entity) || isSlabOpeningEntity(entity) || isOpeningEntity(entity)) {
    return getBimCharacteristicPointsOfCategory(entity, 'midpoint');
  }

  return [];
}
