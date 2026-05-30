/**
 * ADR-396 Z4 — `computeRevealJambQuads` tests (BUG 1: κάθετη παρειά, no slant).
 *
 * Κρίσιμη ιδιότητα: οι πλευρικές ακμές κάθε παραστάδας είναι ΠΑΡΑΛΛΗΛΕΣ στον άξονα
 * του τοίχου (μηδέν 45° miter που έβγαζε το παλιό inset-frame), μήκους = πάχος
 * περβαζιού. Ελέγχεται σε πολλές γωνίες τοίχου (το outline ορίζεται όπως το
 * `opening-geometry.ts:buildOutline`).
 */

import { computeRevealJambQuads } from '../reveal-lining-geometry';
import type { Point3D } from '../../types/bim-base';

/** Outline ανοίγματος (CCW: start-outer, end-outer, end-inner, start-inner). */
function buildOutline(
  cx: number, cy: number, angle: number, width: number, thickness: number,
): Point3D[] {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const px = -uy, py = ux;
  const hw = width / 2, ht = thickness / 2;
  return [
    { x: cx - ux * hw - px * ht, y: cy - uy * hw - py * ht, z: 0 },
    { x: cx + ux * hw - px * ht, y: cy + uy * hw - py * ht, z: 0 },
    { x: cx + ux * hw + px * ht, y: cy + uy * hw + py * ht, z: 0 },
    { x: cx - ux * hw + px * ht, y: cy - uy * hw + py * ht, z: 0 },
  ];
}

/** Μοναδιαίος άξονας ανοίγματος (μέσο start-πλευράς → μέσο end-πλευράς). */
function axisOf(outline: Point3D[]): { ax: number; ay: number } {
  const [v0, v1, v2, v3] = outline;
  const sx = (v0.x + v3.x) / 2, sy = (v0.y + v3.y) / 2;
  const ex = (v1.x + v2.x) / 2, ey = (v1.y + v2.y) / 2;
  const dx = ex - sx, dy = ey - sy;
  const len = Math.hypot(dx, dy);
  return { ax: dx / len, ay: dy / len };
}

describe('computeRevealJambQuads (ADR-396 Z4 — παραστάδες, κάθετη παρειά)', () => {
  it.each([0, Math.PI / 4, Math.PI / 2, -Math.PI / 3, 2.1])(
    'jamb πλευρικές ακμές ΠΑΡΑΛΛΗΛΕΣ στον άξονα (no slant) — angle=%p',
    (angle) => {
      const outline = buildOutline(500, 500, angle, 1000, 250);
      const jambs = computeRevealJambQuads(outline, 50);
      expect(jambs).not.toBeNull();
      const { ax, ay } = axisOf(outline);

      // ADR-396 — η μόνωση τρώει τον τοίχο: start jamb ΕΞΩ από free → −axis·d.
      const sj = jambs!.startJamb;
      expect(sj).toHaveLength(4);
      const ex = sj[2].x - sj[1].x, ey = sj[2].y - sj[1].y;
      expect(Math.abs(ex * ay - ey * ax)).toBeLessThan(1e-9); // cross ≈ 0 → parallel
      expect(Math.hypot(ex, ey)).toBeCloseTo(50, 6);          // length = revealThickness
      expect(ex * ax + ey * ay).toBeCloseTo(-50, 6);          // ΕΞΩ από free (−axis)

      // end jamb: ΕΞΩ από free → +axis·d.
      const ej = jambs!.endJamb;
      expect(ej).toHaveLength(4);
      const fx = ej[2].x - ej[1].x, fy = ej[2].y - ej[1].y;
      expect(Math.abs(fx * ay - fy * ax)).toBeLessThan(1e-9);
      expect(Math.hypot(fx, fy)).toBeCloseTo(50, 6);
      expect(fx * ax + fy * ay).toBeCloseTo(50, 6);           // ΕΞΩ από free (+axis)
    },
  );

  it('jamb κρατά όλο το πάχος τοίχου (across-axis ακμή = thickness)', () => {
    const outline = buildOutline(0, 0, 0, 1000, 250);
    const jambs = computeRevealJambQuads(outline, 50)!;
    const sj = jambs.startJamb;
    // across-thickness ακμή v0→v3
    expect(Math.hypot(sj[1].x - sj[0].x, sj[1].y - sj[0].y)).toBeCloseTo(250, 6);
  });

  it('jambD = revealThickness (ΧΩΡΙΣ cap — η μόνωση τρώει τον τοίχο, ΕΞΩ από το άνοιγμα)', () => {
    // ADR-396: οι παραστάδες πάνε ΕΞΩ από το free (στο structural δαχτυλίδι στον τοίχο),
    // οπότε δεν υπάρχει crossing στο στενό άνοιγμα → κανένα cap widthLen/2.
    const outline = buildOutline(0, 0, 0, 80, 250); // στενό άνοιγμα 80
    const jambs = computeRevealJambQuads(outline, 100)!; // reveal 100
    const sj = jambs.startJamb;
    expect(Math.hypot(sj[2].x - sj[1].x, sj[2].y - sj[1].y)).toBeCloseTo(100, 6);
  });

  it('null guards (λίγες κορυφές / μηδέν πάχος / degenerate άξονας)', () => {
    expect(computeRevealJambQuads([{ x: 0, y: 0, z: 0 }], 50)).toBeNull();
    expect(computeRevealJambQuads(buildOutline(0, 0, 0, 1000, 250), 0)).toBeNull();
    const deg: Point3D[] = [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    ];
    expect(computeRevealJambQuads(deg, 50)).toBeNull();
  });
});
