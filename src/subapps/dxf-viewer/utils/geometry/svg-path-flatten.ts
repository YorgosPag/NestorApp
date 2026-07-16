/**
 * ADR-608 Φ-import-svg (export) — **SVG path-data → flat polylines** (SSoT).
 *
 * Οι μεγάλοι παίκτες (Revit / ArchiCAD / AutoCAD) **σπάνε** (explode) την καμπύλη
 * γεωμετρία σε πολυγραμμές κατά την εξαγωγή σε flat backends (DXF/PDF-vector), αφού
 * το DXF `LWPOLYLINE`/`LINE`/`CIRCLE` λεξιλόγιο δεν εκφράζει Bézier. Αυτό το module
 * κάνει ακριβώς αυτό: parse-άρει ένα SVG `d` string και το **δειγματοληπτεί** (adaptive
 * de Casteljau για Bézier· κεντρική-παραμετροποίηση + βήμα-γωνίας για ελλειπτικά τόξα)
 * σε πολυγραμμές, με έλεγχο **chord-tolerance** ώστε η καμπυλότητα να μένει ομαλή.
 *
 * Καθαρή γεωμετρία — καμία εξάρτηση από entities/coords· ο καταναλωτής
 * (`svg-glyph-to-entities.ts`) εφαρμόζει το viewBox→world affine στα σημεία.
 *
 * Καλύπτει το πλήρες path grammar: `M/L/H/V/C/S/Q/T/A/Z` (absolute **και** relative),
 * με smooth-curve reflection (`S`/`T`) και implicit-repeat (πολλαπλά coord sets μετά
 * από ένα command letter). ⚠️ Τα arc flags (`large-arc`/`sweep`) διαβάζονται ως
 * **χωριστά** numeric tokens — όπως τα εκπέμπει κάθε SVG authoring tool· glued flags
 * (`01`) δεν υποστηρίζονται (δεν παράγονται από τα δικά μας authored glyphs).
 */

import type { Point2D } from '../../rendering/types/Types';

/** Ένα subpath: τα δειγματοληπτημένα σημεία + αν κλείνει (`Z`). */
export interface SvgSubpath {
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}

export interface SvgFlattenOptions {
  /** Μέγιστη απόκλιση χορδής (σε path units) για υποδιαίρεση καμπύλης. Μικρότερο = ομαλότερο. */
  readonly tolerance?: number;
  /** Φράγμα αναδρομής de Casteljau (ασφάλεια έναντι degenerate control nets). */
  readonly maxDepth?: number;
}

const DEFAULT_TOLERANCE = 0.25;
const DEFAULT_MAX_DEPTH = 16;

/** Πλήθος numeric παραμέτρων ανά command (πεζά == relative == ίδιο πλήθος). */
const PARAM_COUNT: Readonly<Record<string, number>> = {
  m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0,
};

interface RawCommand {
  readonly cmd: string; // αρχικό γράμμα (διατηρεί case → abs/rel)
  readonly nums: number[];
}

/** Ένα command letter **ή** ένα numeric token (commas/whitespace αγνοούνται). */
const TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g;

/** Tokenize + ομαδοποίηση σε (command letter, ακόλουθα numbers). */
function tokenize(d: string): RawCommand[] {
  const out: RawCommand[] = [];
  let current: { cmd: string; nums: number[] } | null = null;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(d)) !== null) {
    if (m[1] !== undefined) {
      if (current) out.push(current);
      current = { cmd: m[1], nums: [] };
    } else if (m[2] !== undefined && current) {
      current.nums.push(Number(m[2]));
    }
  }
  if (current) out.push(current);
  return out;
}

const add = (a: Point2D, dx: number, dy: number): Point2D => ({ x: a.x + dx, y: a.y + dy });
const mid = (a: Point2D, b: Point2D): Point2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Απόσταση σημείου `p` από την ευθεία (a→b) — flatness test της υποδιαίρεσης. */
function distToChord(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  return cross / Math.sqrt(len2);
}

/** Adaptive cubic Bézier → σημεία (χωρίς το p0· προσθέτει έως και το p3). */
function flattenCubic(
  p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D,
  tol: number, depth: number, maxDepth: number, out: Point2D[],
): void {
  if (depth >= maxDepth || (distToChord(p1, p0, p3) <= tol && distToChord(p2, p0, p3) <= tol)) {
    out.push(p3);
    return;
  }
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
  const p012 = mid(p01, p12), p123 = mid(p12, p23), p0123 = mid(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tol, depth + 1, maxDepth, out);
  flattenCubic(p0123, p123, p23, p3, tol, depth + 1, maxDepth, out);
}

/** Adaptive quadratic Bézier → σημεία (χωρίς το p0· προσθέτει έως και το p2). */
function flattenQuad(
  p0: Point2D, p1: Point2D, p2: Point2D,
  tol: number, depth: number, maxDepth: number, out: Point2D[],
): void {
  if (depth >= maxDepth || distToChord(p1, p0, p2) <= tol) {
    out.push(p2);
    return;
  }
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p012 = mid(p01, p12);
  flattenQuad(p0, p01, p012, tol, depth + 1, maxDepth, out);
  flattenQuad(p012, p12, p2, tol, depth + 1, maxDepth, out);
}

/** Ελλειπτικό τόξο (SVG `A`) → σημεία, μέσω endpoint→center παραμετροποίησης (F.6.5 spec). */
function flattenArc(
  p0: Point2D, rxIn: number, ryIn: number, xRotDeg: number,
  largeArc: boolean, sweep: boolean, end: Point2D,
  tol: number, out: Point2D[],
): void {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) { out.push(end); return; } // εκφυλισμένο → ευθεία
  const phi = (xRotDeg * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0.x - end.x) / 2, dy = (p0.y - end.y) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + end.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + end.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy, len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  const rMax = Math.max(rx, ry);
  const step = 2 * Math.acos(Math.max(0, 1 - tol / rMax)) || Math.PI / 8;
  const segs = Math.max(2, Math.ceil(Math.abs(dTheta) / step));
  for (let i = 1; i <= segs; i++) {
    const t = theta1 + (dTheta * i) / segs;
    const ex = cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx;
    const ey = sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy;
    out.push({ x: ex, y: ey });
  }
}

/** Reflection του προηγούμενου control point γύρω από το current (για `S`/`T`). */
const reflect = (cur: Point2D, prevCtrl: Point2D | null): Point2D =>
  prevCtrl ? { x: 2 * cur.x - prevCtrl.x, y: 2 * cur.y - prevCtrl.y } : cur;

interface FlattenState {
  cur: Point2D;
  start: Point2D;
  points: Point2D[];
  prevCubicCtrl: Point2D | null;
  prevQuadCtrl: Point2D | null;
}

/**
 * Επεξεργάζεται ΕΝΑ coord-set ενός command (implicit-repeat: η `tokenize` έχει ήδη
 * ομαδοποιήσει, εδώ διαβάζουμε `n` αριθμούς τη φορά). Επιστρέφει `true` αν το set
 * ξεκίνησε νέο subpath (`M`/`m`) ώστε ο caller να κλείσει το προηγούμενο.
 */
function applyStep(cmd: string, n: number[], st: FlattenState, tol: number, maxDepth: number): void {
  const rel = cmd === cmd.toLowerCase();
  const abs = (x: number, y: number): Point2D => (rel ? add(st.cur, x, y) : { x, y });
  const lc = cmd.toLowerCase();
  let cubicCtrl: Point2D | null = null;
  let quadCtrl: Point2D | null = null;
  switch (lc) {
    case 'l': st.cur = abs(n[0], n[1]); st.points.push(st.cur); break;
    case 'h': st.cur = rel ? add(st.cur, n[0], 0) : { x: n[0], y: st.cur.y }; st.points.push(st.cur); break;
    case 'v': st.cur = rel ? add(st.cur, 0, n[0]) : { x: st.cur.x, y: n[0] }; st.points.push(st.cur); break;
    case 'c': {
      const c1 = abs(n[0], n[1]), c2 = abs(n[2], n[3]), end = abs(n[4], n[5]);
      flattenCubic(st.cur, c1, c2, end, tol, 0, maxDepth, st.points);
      cubicCtrl = c2; st.cur = end; break;
    }
    case 's': {
      const c1 = reflect(st.cur, st.prevCubicCtrl), c2 = abs(n[0], n[1]), end = abs(n[2], n[3]);
      flattenCubic(st.cur, c1, c2, end, tol, 0, maxDepth, st.points);
      cubicCtrl = c2; st.cur = end; break;
    }
    case 'q': {
      const c1 = abs(n[0], n[1]), end = abs(n[2], n[3]);
      flattenQuad(st.cur, c1, end, tol, 0, maxDepth, st.points);
      quadCtrl = c1; st.cur = end; break;
    }
    case 't': {
      const c1 = reflect(st.cur, st.prevQuadCtrl), end = abs(n[0], n[1]);
      flattenQuad(st.cur, c1, end, tol, 0, maxDepth, st.points);
      quadCtrl = c1; st.cur = end; break;
    }
    case 'a': {
      const end = abs(n[5], n[6]);
      flattenArc(st.cur, n[0], n[1], n[2], n[3] !== 0, n[4] !== 0, end, tol, st.points);
      st.cur = end; break;
    }
  }
  st.prevCubicCtrl = cubicCtrl;
  st.prevQuadCtrl = quadCtrl;
}

/**
 * Parse-άρει + δειγματοληπτεί ένα SVG `d` string σε subpaths. Άδειο/άκυρο input → `[]`.
 */
export function flattenSvgPathData(d: string, opts: SvgFlattenOptions = {}): SvgSubpath[] {
  const tol = opts.tolerance ?? DEFAULT_TOLERANCE;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const commands = tokenize(d);
  const subpaths: SvgSubpath[] = [];
  const st: FlattenState = {
    cur: { x: 0, y: 0 }, start: { x: 0, y: 0 }, points: [], prevCubicCtrl: null, prevQuadCtrl: null,
  };
  const flush = (closed: boolean): void => {
    if (st.points.length >= 2) subpaths.push({ points: st.points, closed });
    st.points = [];
  };
  for (const { cmd, nums } of commands) {
    const lc = cmd.toLowerCase();
    if (lc === 'z') { flush(true); st.cur = st.start; continue; }
    const step = PARAM_COUNT[lc];
    if (step === undefined || step === 0) continue;
    for (let i = 0; i + step <= nums.length; i += step) {
      const set = nums.slice(i, i + step);
      if (lc === 'm') {
        // Πρώτο set = moveTo (νέο subpath)· τα επόμενα = implicit lineTo.
        if (i === 0) {
          flush(false);
          const rel = cmd === 'm';
          st.cur = rel ? add(st.cur, set[0], set[1]) : { x: set[0], y: set[1] };
          st.start = st.cur;
          st.points.push(st.cur);
          st.prevCubicCtrl = st.prevQuadCtrl = null;
        } else {
          applyStep(cmd === 'm' ? 'l' : 'L', set, st, tol, maxDepth);
        }
      } else {
        applyStep(cmd, set, st, tol, maxDepth);
      }
    }
  }
  flush(false);
  return subpaths;
}
