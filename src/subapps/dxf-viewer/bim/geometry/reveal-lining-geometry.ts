/**
 * ADR-396 — Reveal lining (περβάζια κουφωμάτων, ζώνη Z4) geometry SSoT.
 *
 * Οι **παραστάδες** (jamb strips) ντύνουν εσωτερικά τις δύο πλευρές-πλάτους του
 * ανοίγματος, ΚΑΘΕΤΑ στον άξονα του τοίχου, σε όλο το πάχος τοίχου. Στην **τομή
 * κάτοψης** (η τομή περνά μέσα από το άνοιγμα) φαίνονται **μόνο οι παραστάδες**·
 * το πρέκι/η ποδιά είναι πάνω/κάτω στο Z (όχι στο επίπεδο τομής).
 *
 * **Κοινό SSoT — 2D⟷3D parity:**
 *   - 2D: `EnvelopeOverlay.drawOpeningReveals` → 2 solid-polygon hatch bands.
 *   - 3D: `EnvelopeToThree.revealLiningToMesh` → 2 κατακόρυφα prisms (+ πρέκι/ποδιά).
 *
 * Unit-agnostic: το `outline` + το `revealThickness` πρέπει να είναι στις ΙΔΙΕΣ
 * μονάδες (scene units στο 2D, meters στο 3D). Καμία εσωτερική κλιμάκωση.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3 (P-RENDER, Z4)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 (opening reveal παρειά)
 * @see ./opening-geometry (buildOutline — η κάθετη CCW διάταξη κορυφών)
 */

import type { Point3D } from '../types/bim-base';

/** Ελάχιστο μήκος άξονα ανοίγματος για να μη «σκάει» degenerate quad. */
const AXIS_EPS = 1e-9;

/** Οι δύο παραστάδες ενός ανοίγματος (plan quads, ίδιες μονάδες με το outline). */
export interface RevealJambQuads {
  /** Παραστάδα στην πλευρά start του ανοίγματος (κορυφές v0/v3). */
  readonly startJamb: Point3D[];
  /** Παραστάδα στην πλευρά end του ανοίγματος (κορυφές v1/v2). */
  readonly endJamb: Point3D[];
}

/**
 * Δύο jamb plan quads από το `outline` του ανοίγματος.
 *
 * `outline` = 4 κορυφές CCW `[start-outer, end-outer, end-inner, start-inner]`
 * (όπως τις παράγει `opening-geometry.ts:buildOutline`). Κάθε παραστάδα:
 *   - κάθετη στον άξονα του ανοίγματος (start→end),
 *   - σε όλο το πάχος τοίχου (από outer- σε inner-edge του outline),
 *   - πλάτους `revealThickness` κατά τον άξονα (cap στο `widthLen / 2` ώστε σε
 *     στενά ανοίγματα να μη διασταυρώνονται).
 *
 * @returns null αν `outline` < 4 κορυφές, `revealThickness <= 0`, ή degenerate άξονας.
 */
export function computeRevealJambQuads(
  outline: readonly Point3D[],
  revealThickness: number,
): RevealJambQuads | null {
  if (outline.length < 4 || revealThickness <= 0) return null;

  const [v0, v1, v2, v3] = outline; // start-outer, end-outer, end-inner, start-inner
  // Άξονας ανοίγματος (μέσο start-πλευράς → μέσο end-πλευράς).
  const midStartX = (v0.x + v3.x) / 2, midStartY = (v0.y + v3.y) / 2;
  const midEndX = (v1.x + v2.x) / 2, midEndY = (v1.y + v2.y) / 2;
  let ax = midEndX - midStartX, ay = midEndY - midStartY;
  const widthLen = Math.hypot(ax, ay);
  if (widthLen < AXIS_EPS) return null;
  ax /= widthLen; ay /= widthLen;

  // ADR-396 — η μόνωση τρώει τον ΤΟΙΧΟ, ΟΧΙ το άνοιγμα: οι παραστάδες εκτείνονται
  // ΕΞΩ από το ελεύθερο `outline` (στο δαχτυλίδι free→structural), όχι μέσα στο
  // κούφωμα. start side → −axis (μακριά από end)· end side → +axis. Πλάτος = πάχος
  // μόνωσης (το structural cutout στον τοίχο φιλοξενεί τη λωρίδα· κανένα crossing).
  const jambD = revealThickness;
  const along = (p: Point3D, d: number): Point3D => ({ x: p.x + ax * d, y: p.y + ay * d, z: 0 });

  return {
    startJamb: [v0, v3, along(v3, -jambD), along(v0, -jambD)],
    endJamb: [v1, v2, along(v2, jambD), along(v1, jambD)],
  };
}
