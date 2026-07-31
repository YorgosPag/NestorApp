/**
 * @module drawing-entity-xline
 * @description ADR-359 — ο commit builder της **κατασκευαστικής γραμμής** (`xline`): τα
 * κλικαρισμένα σημεία + το ζωντανό mode του `xline-mode-store` → `XLineEntity`.
 *
 * Αποσπάστηκε από το `drawing-entity-builders.ts` για το όριο μεγέθους αρχείου (N.7.1) —
 * ίδιος λόγος και ίδιο μοτίβο με το `drawing-entity-complete.ts` (που ήδη διαβάζει το ίδιο
 * mode store για το «πόσα κλικ χρειάζεται»). Καμία αλλαγή συμπεριφοράς: κάθε `break` του
 * παλιού `case` κατέληγε στο τελικό `return null` του switch, δηλαδή ακριβώς σε αυτό που
 * επιστρέφει εδώ.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { XLineEntity } from '../../types/entities';
import { getXLineModeState } from '../../systems/tools/xline-mode-store';

/** Μοναδιαίο διάνυσμα· εκφυλισμένο μήκος ⇒ οριζόντιο (η γραμμή πρέπει να έχει διεύθυνση). */
export function normalizeDir(dx: number, dy: number): Point2D {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function xline(id: string, basePoint: Point2D, direction: Point2D, layerId: string): XLineEntity {
  return { id, type: 'xline', basePoint, direction, visible: true, layerId } as XLineEntity;
}

/**
 * Η κατασκευαστική γραμμή για το τρέχον mode, ή `null` όσο λείπουν σημεία (ο καλών
 * συνεχίζει να συσσωρεύει κλικ).
 */
export function buildXLineEntity(
  points: readonly Point2D[],
  id: string,
  layerId: string,
): XLineEntity | null {
  const state = getXLineModeState();
  if (state.mode === 'horizontal' && points.length >= 1) {
    return xline(id, points[0], { x: 1, y: 0 }, layerId);
  }
  if (state.mode === 'vertical' && points.length >= 1) {
    return xline(id, points[0], { x: 0, y: 1 }, layerId);
  }
  if (state.mode === 'angle') {
    if (state.angleValue !== null && points.length >= 1) {
      const angleRad = (state.angleValue * Math.PI) / 180;
      return xline(id, points[0], { x: Math.cos(angleRad), y: Math.sin(angleRad) }, layerId);
    }
    return points.length >= 2 ? xlineThrough(points, id, layerId) : null;
  }
  if (state.mode === 'bisect') return buildBisector(points, id, layerId);
  if (state.mode === 'offset') return null; // Phase 4+ — χρειάζεται επιλογή οντότητας
  return xlineThrough(points, id, layerId); // through (προεπιλογή)
}

/** «Through»: δύο σημεία ορίζουν τη διεύθυνση. */
function xlineThrough(points: readonly Point2D[], id: string, layerId: string): XLineEntity | null {
  if (points.length < 2) return null;
  return xline(id, points[0], normalizeDir(points[1].x - points[0].x, points[1].y - points[0].y), layerId);
}

/** «Bisect»: κορυφή + δύο σκέλη ⇒ η διχοτόμος (άθροισμα των δύο μοναδιαίων διανυσμάτων). */
function buildBisector(points: readonly Point2D[], id: string, layerId: string): XLineEntity | null {
  if (points.length < 3) return null;
  const [p1, p2, p3] = points;
  const d2x = p2.x - p1.x, d2y = p2.y - p1.y;
  const d3x = p3.x - p1.x, d3y = p3.y - p1.y;
  const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
  const len3 = Math.sqrt(d3x * d3x + d3y * d3y);
  if (len2 < 1e-10 || len3 < 1e-10) return null;
  return xline(id, p1, normalizeDir(d2x / len2 + d3x / len3, d2y / len2 + d3y / len3), layerId);
}
