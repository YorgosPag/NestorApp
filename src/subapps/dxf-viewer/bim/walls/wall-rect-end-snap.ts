/**
 * ADR-929 Φ2 · ADR-911 Δ5 — **έλξη άκρων σε παρειές**: το άκρο ενός ανιχνευμένου τοίχου πάει πάνω στην παρειά του
 * γείτονα που βρίσκεται μπροστά ή πίσω του, μέσα σε μικρή εμβέλεια (καθαρό).
 *
 * Γιατί: το auto-join (`wall-region-autojoin.ts`) πηγαίνει ένα άκρο από την παρειά του γείτονα στον άξονά του, με
 * ανοχή 50 mm, φτιαγμένη για τα κενά σχεδίασης ενός διανυσματικού σχεδίου. Σε γραμμές από εικόνα, ένα άκρο σε λοξό
 * κόμβο έχει αβεβαιότητα 2–3 px, δηλαδή δεκάδες mm (μετρημένο στη Φ2: 59 mm πριν από την παρειά, έμενε ανένωτο). Η
 * εμβέλεια εδώ είναι **η ανοχή γραμμής** του καλούντος: στο διανυσματικό σχέδιο 5 mm (πρακτικά τίποτα αλλάζει), στην
 * εικόνα λίγα px. Το άκρο που ήδη κάθεται σε παρειά μένει ως έχει (ιδεμπότητο).
 *
 * @see ./parallel-pair-walls.ts (ο καλών)
 * @see ./wall-region-autojoin.ts (το επόμενο βήμα: από την παρειά στον άξονα)
 */

import type { Point2D } from '../../rendering/types/Types';
import { alongRayReach, rayHitsSegment } from '../geometry/shared/ray-segment';
import { detectedRectAxis, type DetectedRectangle } from './wall-in-region';

/** Ορθογώνιο τοίχου από άξονα και πάχος, με ρητό άξονα (ίδια σειρά κορυφών με τον ανιχνευτή ζευγών). */
export function rectFromAxis(start: Point2D, end: Point2D, thickness: number): DetectedRectangle {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const nx = length > 0 ? (-(end.y - start.y) / length) * (thickness / 2) : 0;
  const ny = length > 0 ? ((end.x - start.x) / length) * (thickness / 2) : 0;
  return {
    polygon: [
      { x: start.x - nx, y: start.y - ny }, { x: end.x - nx, y: end.y - ny },
      { x: end.x + nx, y: end.y + ny }, { x: start.x + nx, y: start.y + ny },
    ],
    longSide: Math.max(length, thickness),
    shortSide: Math.min(length, thickness),
    area: length * thickness,
    axis: [start, end],
  };
}

/**
 * Η πλησιέστερη (σε |απόσταση|) τομή της ευθείας του άξονα με ακμή άλλου ορθογωνίου, μέσα στην εμβέλεια. Η εμβέλεια
 * είναι **κάθετη** απόσταση από την παρειά: υπό γωνία θ μακραίνει κατά 1 / sin θ (`alongRayReach`), γιατί τόσο
 * μακραίνει και η απώλεια του άκρου (μισή πινελιά / sin θ).
 */
function nearestFaceHit(
  origin: Point2D, dir: Point2D, others: readonly DetectedRectangle[], reach: number,
): number | null {
  let best: number | null = null;
  for (const r of others) {
    for (let i = 0; i < 4; i++) {
      const a = r.polygon[i];
      const b = r.polygon[(i + 1) % 4];
      const hit = rayHitsSegment(origin.x, origin.y, dir.x, dir.y, a.x, a.y, b.x, b.y);
      if (!hit || !hit.within || Math.abs(hit.dist) > alongRayReach(dir.x, dir.y, a.x, a.y, b.x, b.y, reach)) continue;
      if (best === null || Math.abs(hit.dist) < Math.abs(best)) best = hit.dist;
    }
  }
  return best;
}

/** Κάθε άκρο κάθε ορθογωνίου έλκεται στην πλησιέστερη παρειά γειτονικού ορθογωνίου, ως `reach` μπρος ή πίσω. */
export function snapRectEndsToFaces(rects: readonly DetectedRectangle[], reach: number): DetectedRectangle[] {
  return rects.map((rect, index) => {
    const ax = detectedRectAxis(rect);
    if (ax.length < 1e-9) return rect;
    const u = { x: (ax.end.x - ax.start.x) / ax.length, y: (ax.end.y - ax.start.y) / ax.length };
    const others = rects.filter((_, j) => j !== index);
    const endHit = nearestFaceHit(ax.end, u, others, reach);
    const startHit = nearestFaceHit(ax.start, { x: -u.x, y: -u.y }, others, reach);
    if (endHit === null && startHit === null) return rect;
    const start = startHit === null ? ax.start : { x: ax.start.x - u.x * startHit, y: ax.start.y - u.y * startHit };
    const end = endHit === null ? ax.end : { x: ax.end.x + u.x * endHit, y: ax.end.y + u.y * endHit };
    return rectFromAxis(start, end, ax.thickness);
  });
}
