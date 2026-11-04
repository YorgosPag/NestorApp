/**
 * @fileoverview **ΤΕΤΡΑΓΩΝΟ → ΤΕΤΡΑΠΛΕΥΡΟ ΩΣ CSS `matrix3d`** — η προβολική απεικόνιση (ομογραφία) που «απλώνει» ένα στοιχείο
 * DOM πάνω σε τέσσερα σημεία της οθόνης (ADR-884 Φ2στ-γ · §4.14). Καθαρό.
 * @related `lib/geometry/homography.ts` (**η** ομογραφία — ο τύπος και η αριθμητική της ζουν εκεί, ADR-929 Φ1) ·
 *   `lib/spatial-tour/viewer/tour-floor-geometry.ts` (το βελάκι και η κουκκίδα στο πάτωμα του πανοράματος)
 * @module lib/geometry/css-homography
 *
 * 🏆 **Γιατί DOM με ομογραφία και όχι υφή μέσα στο WebGL**: μια υφή σε λοξή γωνία **θολώνει** (mipmap), ενώ ένα στοιχείο
 *   DOM με `matrix3d` το ζωγραφίζει ο browser **διανυσματικά**, στην τελική του θέση — ευκρινές σεβρόν σε κάθε κλίση. Και ο
 *   browser κάνει hit-test στο **παραμορφωμένο** σχήμα, οπότε το κουμπί μένει πραγματικό `<button>` (Tab · Enter · aria).
 */

import { unitSquareToQuad, type Quad } from './homography';

const fixed = (n: number) => (Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(10)));

/**
 * **CSS `matrix3d`** που απλώνει ένα στοιχείο `sizePx × sizePx` (με `transform-origin: 0 0`, στη γωνία του γονέα) πάνω στο
 * `quad`. `null` ⇒ εκφυλισμένο τετράπλευρο: ο καλών το κρύβει. Σειρά στηλών, όπως τη ζητά το CSS.
 */
export function quadToMatrix3d(quad: Quad, sizePx: number): string | null {
  const m = unitSquareToQuad(quad);
  if (m === null || !(sizePx > 0)) return null;
  const s = 1 / sizePx;
  const values = [m.a * s, m.d * s, 0, m.g * s, m.b * s, m.e * s, 0, m.h * s, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${values.map(fixed).join(',')})`;
}
