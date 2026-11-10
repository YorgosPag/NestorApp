/**
 * =============================================================================
 * ΚΥΡΤΟ ΠΕΡΙΒΛΗΜΑ ΚΑΙ ΕΛΑΧΙΣΤΟ ΠΕΡΙΣΤΡΑΜΜΕΝΟ ΟΡΘΟΓΩΝΙΟ (SSoT)
 * =============================================================================
 *
 * - **Κυρτό περίβλημα**: μονότονη αλυσίδα του Andrew (1979), O(n log n), αριστερόστροφα, χωρίς συνευθειακά σημεία.
 * - **Ελάχιστο ορθογώνιο**: το ορθογώνιο ελάχιστου εμβαδού έχει μία πλευρά πάνω σε ακμή του περιβλήματος (Freeman &
 *   Shapira 1975)· δοκιμάζεται κάθε ακμή (rotating calipers σε O(h²) — τα περιβλήματα εδώ είναι δεκάδες κορυφές).
 *   Είναι το `cv2.minAreaRect` που χρησιμοποιεί η μετα-επεξεργασία DB του PaddleOCR.
 *
 * 🔑 Η **γωνία δεν είναι συμβόλαιο**: η σύμβαση του OpenCV (γωνία στο `[0, 90)` κ.λπ.) δεν αντιγράφεται. Ο καταναλωτής
 *   διαβάζει τις **κορυφές** (`rotatedRectCorners`) και κρίνει πλάτος/ύψος από τη γεωμετρία τους — όπως ήδη το μετρημένο
 *   `crop_rect` του ADR-929 Φ0.1, που ταξινομεί τις κορυφές πριν κόψει.
 *
 * @module bim/plan-recognition/ocr/min-area-rect
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Ορθογώνιο με κέντρο, πλευρές και γωνία (ακτίνια) της πλευράς `width` ως προς τον άξονα `+x`. */
export interface RotatedRect {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function halfHull(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
    out.push(p);
  }
  out.pop();
  return out;
}

/** Κυρτό περίβλημα (αριστερόστροφα σε σύστημα `y` προς τα πάνω). Λιγότερα από 3 διακριτά σημεία ⇒ τα διακριτά σημεία. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = sorted.filter((p, i) => i === 0 || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y);
  if (unique.length < 3) return unique;
  return [...halfHull(unique), ...halfHull([...unique].reverse())];
}

/** Το ορθογώνιο με τη μία πλευρά στη διεύθυνση `(ux, uy)` (μοναδιαία) που περικλείει το περίβλημα. */
function rectAlong(hull: readonly Pt[], ux: number, uy: number): RotatedRect & { readonly area: number } {
  let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
  for (const p of hull) {
    const u = p.x * ux + p.y * uy;
    const v = -p.x * uy + p.y * ux;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  const width = maxU - minU;
  const height = maxV - minV;
  return { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, width, height, angle: Math.atan2(uy, ux), area: width * height };
}

/**
 * Το περιστραμμένο ορθογώνιο ελάχιστου εμβαδού που περικλείει τα σημεία. Ένα σημείο ⇒ ορθογώνιο μηδενικών διαστάσεων·
 * συνευθειακά ⇒ μηδενικό ύψος. Κενή είσοδος ⇒ `null`.
 */
export function minAreaRect(points: readonly Pt[]): RotatedRect | null {
  const hull = convexHull(points);
  if (hull.length === 0) return null;
  if (hull.length === 1) return { cx: hull[0].x, cy: hull[0].y, width: 0, height: 0, angle: 0 };
  let best: (RotatedRect & { readonly area: number }) | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const r = rectAlong(hull, (b.x - a.x) / len, (b.y - a.y) / len);
    if (best === null || r.area < best.area) best = r;
  }
  if (best === null) return null;
  return { cx: best.cx, cy: best.cy, width: best.width, height: best.height, angle: best.angle };
}

/** Οι τέσσερις κορυφές, με σειρά γύρω από το ορθογώνιο (όχι δεσμευτική ως προς το «πάνω-αριστερά»). */
export function rotatedRectCorners(r: RotatedRect): readonly [Pt, Pt, Pt, Pt] {
  const ux = Math.cos(r.angle) * (r.width / 2);
  const uy = Math.sin(r.angle) * (r.width / 2);
  const vx = -Math.sin(r.angle) * (r.height / 2);
  const vy = Math.cos(r.angle) * (r.height / 2);
  return [
    { x: r.cx - ux - vx, y: r.cy - uy - vy },
    { x: r.cx + ux - vx, y: r.cy + uy - vy },
    { x: r.cx + ux + vx, y: r.cy + uy + vy },
    { x: r.cx - ux + vx, y: r.cy - uy + vy },
  ];
}
