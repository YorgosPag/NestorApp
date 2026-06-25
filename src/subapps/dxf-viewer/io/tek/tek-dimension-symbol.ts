/**
 * ADR-531 Φ5b.1+ (Tekton .TEK IMPORT — faithful dimension symbol) — καθαρή γεωμετρία (Tekton μέτρα)
 * για τη διάσταση όπως τη σχεδιάζει ο Τέκτονας:
 *   - **γραμμή διάστασης** = `<seg>` end0→gap0 και gap1→end1 (με κενό για το κείμενο),
 *   - **βοηθητικές (witness)** = από τα σημεία αναφοράς `<inter>` προς τα άκρα της γραμμής,
 *   - **end ticks** (`end_style` 8) = πλάγια παύλα 45° στα άκρα (χρωματίζεται «μπορντώ» στον mapper),
 *   - **κείμενο** = το `<s>` (π.χ. "2.10") στη θέση του seg `<xmatrix>`, ύψος `<size>`.
 *
 * Μηδέν μετατροπή μονάδων/Y-flip εδώ — ο mapper τα περνά από το SSoT `tekMetersToScene`.
 *
 * @module io/tek/tek-dimension-symbol
 */

import type { TekPoint2D, TekDimRecord } from './tek-import-types';
import type { TekSeg } from './tek-window-symbol';

/** Κείμενο τιμής διάστασης (Tekton μέτρα). */
export interface TekDimText {
  readonly pos: TekPoint2D;
  readonly text: string;
  readonly heightM: number;
}

/** Πλήρης γεωμετρία διάστασης, χωρισμένη ανά χρωματική ομάδα. */
export interface TekDimGeom {
  /** Γραμμή διάστασης + βοηθητικές — στο χρώμα της διάστασης. */
  readonly lines: readonly TekSeg[];
  /** Πλάγιες παύλες άκρων — «μπορντώ». */
  readonly ticks: readonly TekSeg[];
  /** Κείμενα τιμής. */
  readonly texts: readonly TekDimText[];
}

const DEFAULT_TEXT_HEIGHT_M = 0.15;
const seg = (a: TekPoint2D, b: TekPoint2D): TekSeg => ({ a, b });
const isOrigin = (p: TekPoint2D): boolean => p.x === 0 && p.y === 0;
const samePt = (a: TekPoint2D, b: TekPoint2D): boolean =>
  Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/** Πλάγια παύλα 45° μήκους `len` κεντραρισμένη στο `p`, κατά μήκος της διεύθυνσης `dir`. */
function obliqueTick(p: TekPoint2D, dx: number, dy: number, len: number): TekSeg {
  const half = len / 2;
  return seg(
    { x: p.x - dx * half, y: p.y - dy * half },
    { x: p.x + dx * half, y: p.y + dy * half },
  );
}

/** Γεωμετρία διάστασης από `TekDimRecord` (όλες οι πατιές). */
export function buildDimensionSymbol(dim: TekDimRecord): TekDimGeom {
  const lines: TekSeg[] = [];
  const ticks: TekSeg[] = [];
  const texts: TekDimText[] = [];
  const heightM = dim.textSizeM > 0 ? dim.textSizeM : DEFAULT_TEXT_HEIGHT_M;

  dim.segs.forEach((s, i) => {
    const hasGap = !(isOrigin(s.gap0) && isOrigin(s.gap1));
    if (hasGap) {
      lines.push(seg(s.end0, s.gap0));
      lines.push(seg(s.gap1, s.end1));
    } else {
      lines.push(seg(s.end0, s.end1));
    }

    // Διεύθυνση γραμμής διάστασης → πλάγιες παύλες 45° (συνδυασμός κατεύθυνσης + καθέτου).
    const dx = s.end1.x - s.end0.x, dy = s.end1.y - s.end0.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) {
      const ux = dx / len, uy = dy / len;       // μοναδιαία διεύθυνση
      const ox = (ux - uy), oy = (uy + ux);     // 45° = u περιστραμμένο
      const olen = Math.hypot(ox, oy) || 1;
      ticks.push(obliqueTick(s.end0, ox / olen, oy / olen, heightM));
      ticks.push(obliqueTick(s.end1, ox / olen, oy / olen, heightM));
    }

    if (s.text) texts.push({ pos: { x: s.textMatrix.x20, y: s.textMatrix.x21 }, text: s.text, heightM });

    // Βοηθητικές γραμμές: από τα σημεία αναφοράς προς τα άκρα της 1ης πατιάς (αν δεν συμπίπτουν).
    if (i === 0 && dim.refPoints.length >= 2) {
      if (!samePt(dim.refPoints[0], s.end0)) lines.push(seg(dim.refPoints[0], s.end0));
      if (!samePt(dim.refPoints[1], s.end1)) lines.push(seg(dim.refPoints[1], s.end1));
    }
  });

  return { lines, ticks, texts };
}
