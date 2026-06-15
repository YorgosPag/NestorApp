/**
 * Column CROSS-TIES / internal hoops — geometry SSoT (ADR-456 — Στατικά, Slice 2).
 *
 * EC8 §5.4.3.2.2(11)P: κάθε (ή κάθε 2η) διαμήκης ράβδος πρέπει να συγκρατείται από
 * συνδετήρα ή **συνδετήριο** (cross-tie). Οι 4 γωνιακές πιάνονται από το περιμετρικό
 * στεφάνι· οι **ενδιάμεσες (μεσοπλευρικές)** ράβδοι θέλουν εσωτερικά συνδετήρια.
 *
 * **Υβριδική στρατηγική** (Revit-grade, επιλογή Giorgio):
 *   - 1 ενδιάμεση ανά πλευρά (8 ράβδοι) → ΕΝΑ εσωτερικό **διαμαντοειδές στεφάνι**
 *     (rotated square) που αγκαλιάζει και τις 4 μεσοπλευρικές ταυτόχρονα — το
 *     κλασικό ελληνικό detail.
 *   - περισσότερες ενδιάμεσες → **ευθύγραμμα cross-ties** που συνδέουν αντικριστές
 *     ράβδους (κατακόρυφα bottom↔top, οριζόντια left↔right), με γάντζο 135° στα άκρα.
 *
 * Pure functions σε LOCAL mm (κεντραρισμένα στο centroid) — re-derived on-demand και
 * από 2Δ ΚΑΙ από 3Δ ΚΑΙ από τις ποσότητες (geometry-is-SSoT). Η διάμετρος = αυτή
 * των συνδετήρων (`dbw`). Δευτερεύον module για να μην φουσκώνει το column-rebar-layout
 * (N.7.1) και να αποφεύγεται κύκλος import (εδώ εισάγει, δεν εξάγει σε αυτό).
 *
 * @see ./column-rebar-layout.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { CrossTiePattern } from './column-reinforcement-types';
import {
  buildStirrupHookEndsMm,
  STIRRUP_BEND_ARC_SEGMENTS,
} from './column-rebar-layout';

const EPS = 1e-6;

/**
 * Εσωτερικό συνδετήριο (cross-tie) ή δευτερεύον στεφάνι (διαμάντι). Centerline
 * polyline σε LOCAL mm + (προαιρετικά) άκρα γάντζων 135°, ίδια σύμβαση με το
 * `stirrupHookEndsMm` του κύριου στεφανιού → ΚΟΙΝΟ 2Δ/3Δ μονοπάτι σχεδίασης.
 */
export interface ColumnCrossTie {
  /** Centerline polyline (local mm). Ανοιχτό tie = 2 σημεία· διαμάντι = κλειστό N-γωνο. */
  readonly pathMm: readonly Point2D[];
  /** true = κλειστό στεφάνι/διαμάντι (κλείνει last→first)· false = ανοιχτό ευθύγραμμο tie. */
  readonly closed: boolean;
  /** Άκρα γάντζων 135° (τόξο/ουρά) — όπως `stirrupHookEndsMm`. Άδειο αν δεν χρειάζονται. */
  readonly hookEndsMm: readonly (readonly Point2D[])[];
}

/** Ενδιάμεσες (μη-γωνιακές) ράβδοι ανά πλευρά. */
interface SideBars {
  readonly bottom: Point2D[];
  readonly top: Point2D[];
  readonly left: Point2D[];
  readonly right: Point2D[];
}

/** Μοναδιαίο διάνυσμα a→b (0,0 αν ταυτίζονται). */
function unitVec(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len > EPS ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

/** Σημεία τόξου γύρω από κέντρο `c`, ακτίνας `r`, από γωνία a0→a1. */
function arcPoints(c: Point2D, r: number, a0: number, a1: number, seg: number): Point2D[] {
  const s = Math.max(2, Math.round((Math.abs(a1 - a0) / (Math.PI / 2)) * seg));
  const pts: Point2D[] = [];
  for (let k = 0; k <= s; k++) {
    const a = a0 + (a1 - a0) * (k / s);
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

/**
 * **Μήκος τόξου** τυλίγματος του γάντζου (mm) γύρω από τον άξονα του κολωνοσίδερου.
 * Σταθερό μήκος (όχι σταθερή γωνία) → η γωνία προκύπτει `sweep = μήκος/ακτίνα`,
 * clamped ≤ 180° (ημικύκλιο). Η μείωση κόβεται από το **άκρο της ουράς** (το σημείο
 * επαφής με το σώμα του «S» μένει σταθερό).
 */
const HOOK_ARC_LENGTH_MM = 30;

/**
 * Κλίση της ευθείας ουράς ως προς την εφαπτομένη του ημικυκλίου (rad) — η κάμψη
 * **135°** του γάντζου (EC8 §8.5): η ουρά προεξέχει **διαγώνια ~45° ΜΕΣΑ στον πυρήνα**
 * ως ελεύθερο άκρο (όχι παράλληλη με το σώμα, ούτε να το ακουμπά).
 */
const HOOK_TAIL_TILT = Math.PI / 4; // 45° → γνήσιος γάντζος 135°

/**
 * Μήκος ευθύγραμμης ουράς γάντζου **135°** cross-tie (× dbw). EC2 EN1992-1-1 §8.5
 * Fig 8.5: ο γάντζος 135°/180° απαιτεί προέκταση **≥ 5·dbw** μετά την καμπή (το 10·dbw
 * αφορά κάμψη 90°). Τα cross-ties έχουν γάντζους 135° → 5·dbw: σωστό κατά EC2 ΚΑΙ
 * οπτικά καθαρό (το παλιό 10·dbw έβγαζε υπερβολικά μακριές ουρές). Geometry-is-SSoT:
 * το μήκος που σχεδιάζεται = αυτό που μετριέται στις ποσότητες χάλυβα.
 */
const CROSS_TIE_HOOK_EXTENSION_FACTOR = 5;

/** Μοναδικές τιμές (με ανοχή EPS), ταξινομημένες. */
function uniqueSorted(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > EPS) out.push(v);
  }
  return out;
}

/** Κατάταξη ράβδων σε γωνιακές (αγνοούνται) + ενδιάμεσες ανά πλευρά. */
function classifyBars(bars: readonly Point2D[], halfWb: number, halfDb: number): SideBars {
  const sides: SideBars = { bottom: [], top: [], left: [], right: [] };
  for (const b of bars) {
    const onLeft = Math.abs(b.x + halfWb) < EPS;
    const onRight = Math.abs(b.x - halfWb) < EPS;
    const onBottom = Math.abs(b.y + halfDb) < EPS;
    const onTop = Math.abs(b.y - halfDb) < EPS;
    if ((onLeft || onRight) && (onBottom || onTop)) continue; // γωνία → περιμετρικό στεφάνι
    if (onBottom) sides.bottom.push(b);
    else if (onTop) sides.top.push(b);
    else if (onLeft) sides.left.push(b);
    else if (onRight) sides.right.push(b);
  }
  return sides;
}

/**
 * Ένα cross-tie σε σχήμα **«S»**: ΕΝΑ συνεχές κολωνοσίδερο που αγκαλιάζει τη ράβδο
 * `a` από τη μία παρειά και τη `b` από την **αντίθετη** → το σώμα περνά διαγώνια
 * (μικρή κλίση = εσωτερική εφαπτομένη των δύο ράβδων) και οι δύο γάντζοι βγαίνουν
 * **αντίθετης φοράς** (ένας δεξιόστροφος, ένας αριστερόστροφος), με τις ουρές 135°
 * προς τον πυρήνα. Επιστρέφεται ως ΕΝΑ ανοιχτό polyline (μηδέν ξεχωριστά hookEnds).
 */
function straightTie(a: Point2D, b: Point2D, dbw: number, dbL: number, seg: number): ColumnCrossTie {
  const r = dbL / 2 + dbw / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const d = unitVec(a, b); // άξονας a→b (inward στο a)
  if (r <= 0 || len <= 2 * r) return { pathMm: [a, b], closed: false, hookEndsMm: [] };

  const tailLen = CROSS_TIE_HOOK_EXTENSION_FACTOR * dbw;

  // Γάντζος `a`: σταθερό τόξο τυλίγματος 225° γύρω από τη ράβδο (καθαρός βρόχος που
  // αγκαλιάζει), που ΤΕΛΕΙΩΝΕΙ με την ουρά εφαπτομενικά προς τον πυρήνα (+d). Το
  // σημείο επαφής σώματος = αρχή του τόξου (offset από τον άξονα → κλίση «S»).
  const thetaEnd = Math.atan2(d.y, d.x) - Math.PI / 2; // τέλος ημικυκλίου (εφαπτομένη +d)
  const startAngle = thetaEnd - Math.PI; // σημείο επαφής σώματος «S» (ΣΤΑΘΕΡΟ)
  const sweep = Math.min(Math.PI, HOOK_ARC_LENGTH_MM / r); // ~40mm, μείωση από το άκρο ουράς
  const arcA = arcPoints(a, r, startAngle, startAngle + sweep, seg);
  const teA = arcA[arcA.length - 1];
  // Ουρά: +d στραμμένη κατά −HOOK_TAIL_TILT (μακριά από το σώμα → διαγώνια ελεύθερη
  // στον πυρήνα, γνήσιος γάντζος 135°· το πρόσημο φεύγει αντίθετα από το σημείο που
  // ακουμπά το σώμα του «S»).
  const ct = Math.cos(HOOK_TAIL_TILT);
  const st = Math.sin(HOOK_TAIL_TILT);
  const tailDir = { x: d.x * ct + d.y * st, y: -d.x * st + d.y * ct };
  const tipA = { x: teA.x + tailDir.x * tailLen, y: teA.y + tailDir.y * tailLen };

  // Πρώτο μισό: ουρά a → τόξο a (teA…αρχή). Το ΔΕΥΤΕΡΟ μισό = **περιστροφή 180°** γύρω
  // από το μέσο M → οι δύο γάντζοι συμμετρικοί ως προς το κέντρο (καθαρό συνεχές «S»,
  // με την κλίση να διατηρείται· οι ουρές βγαίνουν αντίθετες παρειές προς τον πυρήνα).
  const firstHalf = [tipA, ...[...arcA].reverse()]; // [tipA, teA, …, αρχή τόξου]
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const secondHalf = firstHalf.map((p) => ({ x: 2 * mx - p.x, y: 2 * my - p.y })).reverse();
  return { pathMm: [...firstHalf, ...secondHalf], closed: false, hookEndsMm: [] };
}

/** Ευθύγραμμα cross-ties: κατακόρυφα (bottom↔top) + οριζόντια (left↔right). */
function straightTies(sides: SideBars, halfWb: number, halfDb: number, dbw: number, dbL: number): ColumnCrossTie[] {
  const ties: ColumnCrossTie[] = [];
  for (const x of uniqueSorted([...sides.bottom, ...sides.top].map((b) => b.x))) {
    ties.push(straightTie({ x, y: -halfDb }, { x, y: halfDb }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS));
  }
  for (const y of uniqueSorted([...sides.left, ...sides.right].map((b) => b.y))) {
    ties.push(straightTie({ x: -halfWb, y }, { x: halfWb, y }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS));
  }
  return ties;
}

/** Ράβδος μιας πλευράς που βρίσκεται πιο κοντά στο μέσο της (min |συντεταγμένη|). */
function midBar(arr: readonly Point2D[], axis: 'x' | 'y'): Point2D {
  return arr.reduce((best, b) => (Math.abs(b[axis]) < Math.abs(best[axis]) ? b : best));
}

/**
 * Κλειστή polyline που **αγκαλιάζει** καθεμία ράβδο του `barsCCW`: ευθύγραμμα
 * τμήματα μετατοπισμένα **προς τα έξω** κατά `wrapR = dbL/2 + dbw/2` (εφαπτόμενα στους
 * κύκλους των ράβδων) + τόξα γύρω από κάθε ράβδο στην εξωτερική παρειά → η ράβδος
 * κάθεται ΜΕΣΑ στο στεφάνι (Revit-grade embrace, ίδια αρχή με το περιμετρικό στεφάνι).
 */
function embracingHoopPath(barsCCW: readonly Point2D[], dbw: number, dbL: number, seg: number): Point2D[] {
  const n = barsCCW.length;
  const wrapR = dbL / 2 + dbw / 2;
  if (n < 3 || wrapR <= 0) return barsCCW.map((p) => ({ x: p.x, y: p.y }));
  const start: Point2D[] = []; // αναχώρηση από κορυφή i (επί ακμής i)
  const end: Point2D[] = []; // άφιξη στην κορυφή i+1 (επί ακμής i)
  for (let i = 0; i < n; i++) {
    const p = barsCCW[i];
    const q = barsCCW[(i + 1) % n];
    const e = unitVec(p, q);
    const out = { x: e.y, y: -e.x }; // εξωτερικό κάθετο (δεξιά της φοράς για CCW)
    start.push({ x: p.x + out.x * wrapR, y: p.y + out.y * wrapR });
    end.push({ x: q.x + out.x * wrapR, y: q.y + out.y * wrapR });
  }
  const path: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const p = barsCCW[i];
    const aIn = Math.atan2(end[(i - 1 + n) % n].y - p.y, end[(i - 1 + n) % n].x - p.x);
    let aOut = Math.atan2(start[i].y - p.y, start[i].x - p.x);
    while (aOut < aIn) aOut += 2 * Math.PI; // μικρό τόξο CCW (bulge προς τα έξω)
    path.push(...arcPoints(p, wrapR, aIn, aOut, seg));
  }
  return path;
}

/**
 * Εσωτερικό διαμαντοειδές στεφάνι (rotated square) που **αγκαλιάζει** τη μεσαία
 * ενδιάμεση ράβδο κάθε πλευράς (CCW: bottom→right→top→left) + γάντζος 135°
 * κλεισίματος με ουρές προς τον πυρήνα. Επιστρέφει `null` αν κάποια πλευρά δεν έχει
 * ενδιάμεση ράβδο (αδύνατο καθαρό διαμάντι → ο caller πέφτει σε grid).
 */
function diamondTie(sides: SideBars, dbw: number, dbL: number): ColumnCrossTie | null {
  if (!sides.bottom.length || !sides.right.length || !sides.top.length || !sides.left.length) return null;
  const corners = [
    midBar(sides.bottom, 'x'),
    midBar(sides.right, 'y'),
    midBar(sides.top, 'x'),
    midBar(sides.left, 'y'),
  ];
  const pathMm = embracingHoopPath(corners, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS);
  const hookEndsMm = buildStirrupHookEndsMm(corners, corners[0], { x: 0, y: 0 }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS);
  return { pathMm, closed: true, hookEndsMm };
}

/**
 * Εσωτερικά συνδετήρια (cross-ties) για τη διάταξη `bars` (LOCAL mm). Επιστρέφει []
 * όταν δεν υπάρχουν ενδιάμεσες ράβδοι (≤4 ράβδοι → μόνο γωνίες) ή εκφυλισμένο dbw.
 * `dbw` = διάμετρος συνδετήρα, `dbL` = διάμετρος διαμήκους (για ακτίνα γάντζου).
 * `pattern`: `auto` (διαμάντι iff 1-ανά-πλευρά αλλιώς grid) / `diamond` / `grid`.
 */
export function buildColumnCrossTies(
  bars: readonly Point2D[],
  dbw: number,
  dbL: number,
  pattern: CrossTiePattern = 'auto',
): ColumnCrossTie[] {
  if (bars.length <= 4 || dbw <= 0) return [];
  const halfWb = Math.max(...bars.map((b) => Math.abs(b.x)));
  const halfDb = Math.max(...bars.map((b) => Math.abs(b.y)));
  if (halfWb <= 0 || halfDb <= 0) return [];
  const sides = classifyBars(bars, halfWb, halfDb);
  const interior = sides.bottom.length + sides.top.length + sides.left.length + sides.right.length;
  if (interior === 0) return [];
  const onePerSide =
    sides.bottom.length === 1 && sides.top.length === 1 && sides.left.length === 1 && sides.right.length === 1;
  const wantDiamond = pattern === 'diamond' || (pattern === 'auto' && onePerSide);
  if (wantDiamond) {
    const diamond = diamondTie(sides, dbw, dbL);
    if (diamond) return [diamond]; // αλλιώς fall-through σε grid (πλευρά χωρίς ενδιάμεση)
  }
  return straightTies(sides, halfWb, halfDb, dbw, dbL);
}

/**
 * ADR-460 (follow-up 6) — Ζεύγη αγκύρωσης cross-ties ΕΝΟΣ **ορθογώνιου σκέλους**
 * (multihoop): οι ενδιάμεσες (μη-γωνιακές) ράβδοι κάθε πλευράς δένονται με την
 * **αντικριστή** τους, διασχίζοντας το **πάχος** του σκέλους (bottom↔top / left↔right —
 * ίδια λογική με το rectangular `straightTies`, αλλά εκφρασμένη ως anchors ώστε ο
 * dispatcher να τα κάνει S-ties μέσω του ΥΠΑΡΧΟΝΤΟΣ `buildTiesFromAnchors` μονοπατιού).
 * `bars` σε rect-local mm (κεντραρισμένα στο κέντρο του σκέλους). `[]` για ≤4 ράβδους.
 */
export function buildRectCrossTieAnchors(
  bars: readonly Point2D[],
  halfWb: number,
  halfDb: number,
): { a: Point2D; b: Point2D }[] {
  if (bars.length <= 4 || halfWb <= 0 || halfDb <= 0) return [];
  const sides = classifyBars(bars, halfWb, halfDb);
  const anchors: { a: Point2D; b: Point2D }[] = [];
  for (const x of uniqueSorted([...sides.bottom, ...sides.top].map((b) => b.x))) {
    anchors.push({ a: { x, y: -halfDb }, b: { x, y: halfDb } });
  }
  for (const y of uniqueSorted([...sides.left, ...sides.right].map((b) => b.y))) {
    anchors.push({ a: { x: -halfWb, y }, b: { x: halfWb, y } });
  }
  return anchors;
}

/**
 * ADR-460 — Cross-ties από ρητά ζεύγη αγκύρωσης (π.χ. αντικριστές ράβδοι κορμού
 * τοιχώματος front↔back): ΕΝΑ S-tie ανά ζεύγος, ίδια γεωμετρία «S» με τα ευθύγραμμα
 * ties (γάντζοι 135° στα δύο άκρα). Reuse `straightTie` — μηδέν διπλότυπο. `dbw ≤ 0`
 * → []. LOCAL mm.
 */
export function buildTiesFromAnchors(
  anchors: readonly { readonly a: Point2D; readonly b: Point2D }[],
  dbw: number,
  dbL: number,
): ColumnCrossTie[] {
  if (dbw <= 0) return [];
  return anchors.map((p) => straightTie(p.a, p.b, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS));
}

/**
 * Μήκος **άξονα** (centerline) ενός cross-tie (mm) — το geometry-is-SSoT μέγεθος που
 * τρέφει τις ποσότητες χάλυβα: άθροισμα όλων των τμημάτων του polyline (συμπεριλ.
 * τόξων τυλίγματος + ουρών, που είναι ΜΕΣΑ στο path) + τυχόν ξεχωριστών hookEnds
 * (κλειστό διαμάντι). Δεν προστίθεται σταθερό μήκος γάντζου — η γεωμετρία είναι SSoT.
 */
export function crossTieCenterlineLengthMm(tie: ColumnCrossTie): number {
  const pts = tie.pathMm;
  const n = pts.length;
  let len = 0;
  if (n >= 2) {
    const last = tie.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      len += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  for (const hook of tie.hookEndsMm) {
    for (let i = 1; i < hook.length; i++) {
      len += Math.hypot(hook[i].x - hook[i - 1].x, hook[i].y - hook[i - 1].y);
    }
  }
  return len;
}
