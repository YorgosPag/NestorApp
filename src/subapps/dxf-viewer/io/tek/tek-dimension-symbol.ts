/**
 * ADR-531 Φ5b.1++ (Tekton .TEK IMPORT — faithful dimension symbol) — καθαρή γεωμετρία (Tekton μέτρα)
 * για τη διάσταση όπως τη σχεδιάζει ο Τέκτονας:
 *   - **γραμμή διάστασης** = `<seg>` end0→gap0 και gap1→end1 (με κενό για το κείμενο),
 *   - **βοηθητικές (witness)** = από τα σημεία αναφοράς `<inter>` προς τα άκρα της γραμμής,
 *   - **end markers** (`end_style` 8) = **βελάκι** (open arrowhead προς τα έξω) + **κάθετη extension
 *     παύλα** στο κάθε άκρο (όπως ο Τέκτων· browser-verified target `221306`),
 *   - **κείμενο** = το `<s>` (π.χ. "2.10") στη θέση του seg `<xmatrix>`, ύψος `<size>`.
 *
 * Calibration Φ5b.1++ (2026-06-25): οι παλιές 45° πλάγιες παύλες → βελάκια+extension ticks (ο Τέκτων
 * ζωγραφίζει βέλη, ΟΧΙ oblique). Το κείμενο φεύγει σε ξεχωριστή χρωματική ομάδα (κίτρινο `dtext_color`).
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
  /** Γραμμή διάστασης + βοηθητικές witness — στο χρώμα της διάστασης. */
  readonly lines: readonly TekSeg[];
  /** End markers (βελάκια + κάθετες extension παύλες) — δική τους χρωματική ομάδα. */
  readonly ticks: readonly TekSeg[];
  /** Κείμενα τιμής. */
  readonly texts: readonly TekDimText[];
}

const DEFAULT_TEXT_HEIGHT_M = 0.15;
/** Μήκος βέλους ως κλάσμα του ύψους κειμένου (calibratable· browser-verify). */
const ARROW_LEN_FACTOR = 1.4;
/** Μισό άνοιγμα γωνίας βέλους (rad ≈ 18°). */
const ARROW_HALF_ANGLE_RAD = 0.32;
/** Μήκος κάθετης extension παύλας ως κλάσμα του ύψους κειμένου. */
const EXT_TICK_LEN_FACTOR = 2;

const seg = (a: TekPoint2D, b: TekPoint2D): TekSeg => ({ a, b });
const isOrigin = (p: TekPoint2D): boolean => p.x === 0 && p.y === 0;
const samePt = (a: TekPoint2D, b: TekPoint2D): boolean =>
  Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/**
 * Ανοιχτό βελάκι (2 πτερύγια) με κορυφή στο `tip`, που δείχνει προς τα **έξω** κατά τη μοναδιαία
 * διεύθυνση `(ox,oy)`. Τα πτερύγια γυρίζουν προς τα πίσω (−out) κατά ±`ARROW_HALF_ANGLE_RAD`.
 */
function arrowHead(tip: TekPoint2D, ox: number, oy: number, len: number): TekSeg[] {
  const c = Math.cos(ARROW_HALF_ANGLE_RAD), s = Math.sin(ARROW_HALF_ANGLE_RAD);
  const bx = -ox, by = -oy; // φορά πτερυγίων = αντίθετη του βέλους
  const b1 = { x: tip.x + (bx * c - by * s) * len, y: tip.y + (bx * s + by * c) * len };
  const b2 = { x: tip.x + (bx * c + by * s) * len, y: tip.y + (-bx * s + by * c) * len };
  return [seg(tip, b1), seg(tip, b2)];
}

/** Κάθετη extension παύλα μήκους `len` κεντραρισμένη στο `p` (κάθετη στη διεύθυνση `(ux,uy)`). */
function perpTick(p: TekPoint2D, ux: number, uy: number, len: number): TekSeg {
  const px = -uy, py = ux; // κάθετο μοναδιαίο
  const half = len / 2;
  return seg(
    { x: p.x - px * half, y: p.y - py * half },
    { x: p.x + px * half, y: p.y + py * half },
  );
}

/** Γεωμετρία διάστασης από `TekDimRecord` (όλες οι πατιές). */
export function buildDimensionSymbol(dim: TekDimRecord): TekDimGeom {
  const lines: TekSeg[] = [];
  const ticks: TekSeg[] = [];
  const texts: TekDimText[] = [];
  const heightM = dim.textSizeM > 0 ? dim.textSizeM : DEFAULT_TEXT_HEIGHT_M;
  const arrowLen = heightM * ARROW_LEN_FACTOR;
  const extLen = heightM * EXT_TICK_LEN_FACTOR;

  dim.segs.forEach((s, i) => {
    const hasGap = !(isOrigin(s.gap0) && isOrigin(s.gap1));
    if (hasGap) {
      lines.push(seg(s.end0, s.gap0));
      lines.push(seg(s.gap1, s.end1));
    } else {
      lines.push(seg(s.end0, s.end1));
    }

    // Διεύθυνση γραμμής → βελάκια (προς τα έξω) + κάθετες extension παύλες στα δύο άκρα.
    const dx = s.end1.x - s.end0.x, dy = s.end1.y - s.end0.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) {
      const ux = dx / len, uy = dy / len; // μοναδιαία διεύθυνση end0→end1
      // end0: βέλος προς −u (έξω)· end1: βέλος προς +u (έξω).
      ticks.push(...arrowHead(s.end0, -ux, -uy, arrowLen));
      ticks.push(...arrowHead(s.end1, ux, uy, arrowLen));
      ticks.push(perpTick(s.end0, ux, uy, extLen));
      ticks.push(perpTick(s.end1, ux, uy, extLen));
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
