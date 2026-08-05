/**
 * dxf-underlay-segments.ts — **η τεσελίωση του 3Δ υποστρώματος DXF**: μία οντότητα → ζεύγη
 * κορυφών σε επίπεδο buffer θέσεων, με τη χαρτογράφηση `DXF x → X, DXF y → −Z` (επίπεδο
 * δαπέδου, Y-up).
 *
 * Εξήχθη από το `DxfToThreeConverter` (N.7.1) όταν ο πίνακας απέκτησε **δεύτερο** καταναλωτή
 * (ADR-739 Φ.Θ). Δεν είναι μόνο ζήτημα μεγέθους αρχείου: ο converter κατέχει **κύκλο ζωής**
 * (root, υλικά, streaming, dispose), ενώ αυτό εδώ είναι **καθαρή γεωμετρία** — χωρίς THREE,
 * χωρίς κατάσταση, πλήρως δοκιμάσιμη. Ο διαχωρισμός σπάει επίσης τον κύκλο εισαγωγών που θα
 * γεννιόταν αν το `dxf-table-3d-decompose` εισήγαγε τη συνάρτηση από την κλάση που το εισάγει.
 *
 * @module bim-3d/converters/dxf-underlay-segments
 * @see ./DxfToThreeConverter.ts — ο κάτοχος του κύκλου ζωής (ο πρώτος καταναλωτής)
 * @see ./dxf-table-3d-decompose.ts — ο πίνακας (ο δεύτερος, ADR-739 Φ.Θ)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { circlePolyline, arcPolyline } from './dxf-arc-circle-sample';

function pushSeg(buf: number[], ax: number, az: number, bx: number, bz: number): void {
  // ADR-537 NaN-guard — ONE non-finite coordinate poisons the whole overlay `Box3`
  // (`getBounds` → `setFromObject`), which NaN-frames the SHARED camera → BOTH the DXF underlay
  // AND the lit BIM scene vanish (empty 3D). This is the SSoT chokepoint every line / circle /
  // arc / polyline segment flows through, so drop the bad segment here and keep the rest.
  if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) return;
  buf.push(ax, 0, az, bx, 0, bz);
}

/** Push a plan-mm poly-line (from the canonical sampler) as consecutive line segments,
 *  applying the DXF y → −Z floor-plane mapping. */
function pushPolyline(buf: number[], pts: readonly Point2D[]): void {
  for (let i = 0; i < pts.length - 1; i++) {
    pushSeg(buf, pts[i].x, -pts[i].y, pts[i + 1].x, -pts[i + 1].y);
  }
}

/** Append line-segment pairs for a single entity into a flat position buffer.
 *  Coordinate mapping: DXF x → X, DXF y → −Z (Y-up floor plane).
 *  Exported for unit testing. */
export function appendEntitySegments(buf: number[], entity: DxfEntityUnion): void {
  switch (entity.type) {
    case 'line': {
      pushSeg(buf, entity.start.x, -entity.start.y, entity.end.x, -entity.end.y);
      break;
    }

    case 'circle': {
      // Canonical tessellation SSoT (shared with hover-outline + grip-ghost).
      pushPolyline(buf, circlePolyline(entity.center, entity.radius));
      break;
    }

    case 'arc': {
      pushPolyline(buf, arcPolyline(
        entity.center, entity.radius, entity.startAngle, entity.endAngle, entity.counterclockwise,
      ));
      break;
    }

    case 'polyline': {
      const { vertices, closed } = entity;
      if (vertices.length < 2) break;
      const count = closed ? vertices.length : vertices.length - 1;
      for (let i = 0; i < count; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        pushSeg(buf, a.x, -a.y, b.x, -b.y);
      }
      break;
    }

    // BIM: wall/beam/slab → BimSceneLayer; stair/dimension/xline/ray/others → skip.
    // `text` → `AtlasTextMeshBuilder` (streamed pass). `table` → αποδομείται ΠΡΙΝ φτάσει εδώ
    // (`dxf-table-3d-decompose`, ADR-739 Φ.Θ): τα κομμάτια του ξαναμπαίνουν ως `line`/`text`,
    // ώστε να μην υπάρξει ΠΟΤΕ δεύτερη διαδρομή τεσελίωσης για πίνακα.
    default:
      break;
  }
}
