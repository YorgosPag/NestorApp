/**
 * Column longitudinal-bar DISTRIBUTION — pure geometry helpers (ADR-456 / ADR-460).
 *
 * Κατανομή των **ΘΕΣΕΩΝ** των διαμήκων ράβδων κατά μήκος κλειστού πολυγώνου κέντρων
 * (γωνίες + ομοιόμορφη περιμετρική κατανομή, largest-remainder) — ΕΝΑ SSoT για
 * ορθογ./Γ/Τ/Ι/Π/πολύγωνο/σύνθετο. Extracted από το `column-rebar-layout.ts`
 * (file-size split· behavior-preserving)· re-exported από εκεί για back-compat.
 *
 * Σύστημα συντεταγμένων: **LOCAL mm**, κεντραρισμένο στο centroid της διατομής.
 *
 * @see ./column-rebar-layout.ts
 */

import type { Point2D } from '../../../rendering/types/Types';

/**
 * Κατανομή `extras` ακέραιων μονάδων σε `weights.length` κάδους ανάλογα με τα
 * βάρη, με μέθοδο μεγαλύτερου υπολοίπου (largest-remainder) → άθροισμα == extras.
 */
function apportion(extras: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (extras <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (extras * Math.max(0, w)) / total);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = extras - floors.reduce((a, v) => a + v, 0);
  // Μοίρασε τα υπόλοιπα στους κάδους με το μεγαλύτερο κλασματικό μέρος.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) {
    floors[order[k].i] += 1;
  }
  return floors;
}

/** Ισαπέχοντα ενδιάμεσα σημεία μεταξύ a→b (exclusive άκρα), `n` τεμάχια. */
function interiorPoints(a: Point2D, b: Point2D, n: number): Point2D[] {
  if (n <= 0) return [];
  const out: Point2D[] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/**
 * Θέσεις διαμήκων ράβδων κατά μήκος **οποιουδήποτε** κλειστού πολυγώνου κέντρων
 * ράβδων (CCW): μία ράβδος σε ΚΑΘΕ κορυφή (γωνιακή — δομική απαίτηση, κυρτή ή reflex)
 * + οι υπόλοιπες `count-K` κατανεμημένες ομοιόμορφα στις πλευρές ανάλογα με το μήκος
 * πλευράς (largest-remainder — Revit-grade ομοιόμορφη περίμετρος). SSoT για ορθογ.
 * Γ/Τ/Ι/Π/πολύγωνο/σύνθετο. `count ≤ K` → οι πρώτες `count` κορυφές. Επιστρέφει [] όταν
 * count ≤ 0 ή < 2 κορυφές.
 */
export function distributeBarsAlongPolygon(vertices: readonly Point2D[], count: number): Point2D[] {
  const k = vertices.length;
  if (count <= 0 || k < 2) return [];
  if (count <= k) return vertices.slice(0, count).map((v) => ({ x: v.x, y: v.y }));

  const edgeLengths = vertices.map((v, i) => {
    const n = vertices[(i + 1) % k];
    return Math.hypot(n.x - v.x, n.y - v.y);
  });
  const perSide = apportion(count - k, edgeLengths);
  const bars: Point2D[] = vertices.map((v) => ({ x: v.x, y: v.y }));
  for (let i = 0; i < k; i++) {
    bars.push(...interiorPoints(vertices[i], vertices[(i + 1) % k], perSide[i]));
  }
  return bars;
}

/**
 * Ορθογώνια ειδική περίπτωση: 4 γωνίες (CCW BL→BR→TR→TL) + ενδιάμεσες. Delegate στο
 * γενικό {@link distributeBarsAlongPolygon} (μηδέν διπλότυπο). `halfW`/`halfD` = μισές
 * διαστάσεις του ορθογωνίου ΚΕΝΤΡΩΝ ράβδων (μετά το inset).
 */
export function distributeBars(halfW: number, halfD: number, count: number): Point2D[] {
  if (count <= 0) return [];
  const corners: Point2D[] = [
    { x: -halfW, y: -halfD },
    { x: halfW, y: -halfD },
    { x: halfW, y: halfD },
    { x: -halfW, y: halfD },
  ];
  return distributeBarsAlongPolygon(corners, count);
}

/**
 * **Spacing-derived** θέσεις διαμήκων ράβδων ορθογωνίου (κέντρο=origin) — ο αριθμός
 * προκύπτει από το **όριο κανονισμού** `sMaxMm` (Revit/Tekla: ράβδος κάθε ≤ sMax σε
 * κάθε παρειά, EC8 §5.4.3.2.2(11)P), ΟΧΙ σταθερό count· `minTotal` = κατώφλι (intent
 * του χρήστη). `halfWb`/`halfDb` = μισές διαστάσεις του ορθογωνίου ΚΕΝΤΡΩΝ ράβδων (μετά
 * inset). Διανομή CCW: BL→BR (κάτω) → BR→TR (δεξιά) → TR→TL (πάνω) → TL→BL (αριστερά),
 * `n` ισαπέχοντα σημεία ανά παρειά (γωνία μετριέται μία φορά). Πάντα ≥4 ράβδοι.
 */
export function distributeRectBarsBySpacing(
  halfWb: number,
  halfDb: number,
  sMaxMm: number,
  minTotal: number,
): Point2D[] {
  const wFace = 2 * Math.max(0, halfWb);
  const dFace = 2 * Math.max(0, halfDb);
  const s = sMaxMm > 0 ? sMaxMm : Infinity;
  let nW = Math.max(1, Math.ceil(wFace / s)); // διαστήματα στις οριζόντιες παρειές
  let nD = Math.max(1, Math.ceil(dFace / s)); // διαστήματα στις κατακόρυφες παρειές
  const floor = Math.max(4, Math.floor(minTotal));
  let guard = 0;
  // Ανέβασε διαστήματα στην παρειά με το μεγαλύτερο τρέχον βήμα ώσπου total ≥ floor.
  while (2 * nW + 2 * nD < floor && guard++ < 1000) {
    if (wFace / nW >= dFace / nD) nW++;
    else nD++;
  }
  const corners: Point2D[] = [
    { x: -halfWb, y: -halfDb }, { x: halfWb, y: -halfDb }, { x: halfWb, y: halfDb }, { x: -halfWb, y: halfDb },
  ];
  const perEdge = [nW, nD, nW, nD];
  const out: Point2D[] = [];
  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    for (let i = 0; i < perEdge[e]; i++) {
      const t = i / perEdge[e];
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}
