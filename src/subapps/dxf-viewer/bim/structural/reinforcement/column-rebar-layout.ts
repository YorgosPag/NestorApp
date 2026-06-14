/**
 * Column rebar LAYOUT — geometry SSoT (ADR-456 — Στατικά, Slice 3).
 *
 * Pure functions: ColumnReinforcement (intent: πλήθος/βήμα/Ø/cover) + ορθογωνική
 * διατομή (widthMm × depthMm) → οι **ΘΕΣΕΙΣ** των ράβδων/στεφανιών. Mirror του
 * geometry-is-SSoT κανόνα: οι θέσεις ΠΟΤΕ δεν αποθηκεύονται — re-derived on-demand
 * και από το 2Δ (`column-rebar-2d`) ΚΑΙ από το 3Δ (`column-rebar-3d`), ώστε κάτοψη,
 * τομή και 3Δ να δείχνουν την ΙΔΙΑ διάταξη (μηδέν διπλή τοποθέτηση).
 *
 * Σύστημα συντεταγμένων: **LOCAL mm**, κεντραρισμένο στο κέντρο της διατομής
 * (origin = centroid· +X = local width, +Y = local depth) — ΠΡΙΝ anchor-shift /
 * rotation / scale. Ο caller τα μεταφέρει σε world μέσω του κοινού
 * `columnLocalMmToWorld` (column-geometry), ίδιο transform με το footprint.
 *
 * Πεδίο: ορθογωνική κολώνα (όπως οι ποσότητες Slice 1). Άλλα kinds → DEFER.
 *
 * @see ./column-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnReinforcement } from './column-reinforcement-types';

/**
 * Συντελεστής ακτίνας **άξονα** (centerline) κάμψης συνδετήρα (× dbw). EC2
 * EN 1992-1-1 §8.3 / Table 8.1N: ελάχ. διάμετρος τυμπάνου φm,min = 4·dbw (dbw ≤ 16)
 * → εσωτ. ακτίνα r_in = 2·dbw → ακτίνα άξονα r_cl = r_in + dbw/2 = **2.5·dbw**.
 * Το τόξο γωνίας είναι τεταρτοκύκλιο ακτίνας r_cl, εφαπτόμενο στις δύο πλευρές,
 * ώστε ο συνδετήρας να «αγκαλιάζει» τη γωνιακή διαμήκη ράβδο (όχι αιχμηρή 90°).
 */
export const STIRRUP_BEND_CL_FACTOR = 2.5;

/**
 * Τμήματα ανά γωνιακό τόξο (tessellation). Το ΙΔΙΟ tessellated polyline τρέφει 2Δ
 * (lineTo) ΚΑΙ 3Δ (cylinder segments) → απόλυτη συνέπεια κάτοψης/τομής/3Δ (SSoT).
 * 6 = λείο σε column scale, ελάχιστο geometry (Revit/Tekla επίσης tessellate-άρουν).
 */
export const STIRRUP_BEND_ARC_SEGMENTS = 6;

/**
 * Μήκος ευθύγραμμης προέκτασης γάντζου 135° (× dbw) — η «ουρά» που μπαίνει διαγώνια
 * στον πυρήνα μετά τη στροφή. EC8 §5.4.3.2.2 / EC2 §8.5: μήκος αγκύρωσης γάντζου
 * 135° ≥ **10·dbw**. ΕΝΑ SSoT για ΟΛΑ: σχέδιο 2Δ + 3Δ + ποσότητα χάλυβα (compute)
 * → η ουρά που μετριέται = αυτή που σχεδιάζεται (geometry-is-SSoT).
 */
export const STIRRUP_HOOK_EXTENSION_FACTOR = 10;


/** Διάταξη οπλισμού σε LOCAL mm (κεντραρισμένη στο centroid της διατομής). */
export interface ColumnRebarLayout {
  /** Κέντρα διαμήκων ράβδων (local mm) — γωνίες + περιμετρική κατανομή. */
  readonly longitudinalBarsMm: readonly Point2D[];
  /** Κλειστό ορθογώνιο περίγραμμα στεφανιού — 4 αιχμηρές γωνίες (centerline, local
   *  mm). Διατηρείται για αγκύρωση γαντζιού 135° + analytic/back-compat. */
  readonly stirrupRingMm: readonly Point2D[];
  /** Κλειστή tessellated polyline στεφανιού με **καμπύλες (στρογγυλεμένες) γωνίες**
   *  ακτίνας `stirrupCornerRadiusMm` (centerline συνδετήρα, local mm). Το ΚΟΙΝΟ
   *  μονοπάτι που στρώνουν 2Δ ΚΑΙ 3Δ — Revit-grade αγκάλιασμα γωνιακής ράβδου. */
  readonly stirrupPathMm: readonly Point2D[];
  /** Ακτίνα άξονα κάμψης γωνίας στεφανιού (mm) = `STIRRUP_BEND_CL_FACTOR·dbw`,
   *  clamped ώστε να μην ξεπερνά το μισό της κοντύτερης πλευράς. */
  readonly stirrupCornerRadiusMm: number;
  /** Τα **ΔΥΟ άκρα** του γάντζου 135° στη γωνία κλεισίματος (closed-hooked), καθένα
   *  ως πολυγραμμή [τόξο κάμψης … + ευθεία ουρά] σε LOCAL mm — αγκαλιάζουν το
   *  γωνιακό κολωνοσίδερο και μπαίνουν διαγώνια στον πυρήνα. Κοινό 2Δ/3Δ. Άδειο
   *  όταν δεν υπάρχει συνδετήρας (το draw gate-άρεται στον τύπο από τον renderer). */
  readonly stirrupHookEndsMm: readonly (readonly Point2D[])[];
  /** Διάμετρος διαμήκους ράβδου (mm) — για Ø-scaled κουκκίδα / κύλινδρο. */
  readonly barDiameterMm: number;
  /** Διάμετρος συνδετήρα (mm) — για πάχος γραμμής στεφανιού. */
  readonly stirrupDiameterMm: number;
}

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
 * Θέσεις διαμήκων ράβδων: 4 γωνίες (πάντα, δομική απαίτηση) + οι υπόλοιπες
 * `count-4` κατανεμημένες ομοιόμορφα στις 4 πλευρές του εσωτερικού ορθογωνίου
 * (ανάλογα με το μήκος πλευράς — Revit-grade ομοιόμορφη περίμετρος).
 *
 * `halfW`/`halfD` = μισές διαστάσεις του ορθογωνίου των ΚΕΝΤΡΩΝ ράβδων (μετά το
 * inset). Επιστρέφει [] όταν count ≤ 0.
 */
function distributeBars(halfW: number, halfD: number, count: number): Point2D[] {
  if (count <= 0) return [];
  // Γωνίες CCW: BL → BR → TR → TL.
  const corners: Point2D[] = [
    { x: -halfW, y: -halfD },
    { x: halfW, y: -halfD },
    { x: halfW, y: halfD },
    { x: -halfW, y: halfD },
  ];
  if (count <= 4) return corners.slice(0, count);

  const extras = count - 4;
  // Πλευρές μεταξύ διαδοχικών γωνιών (ίδια σειρά): bottom, right, top, left.
  const w = 2 * halfW; // μήκος οριζόντιας πλευράς
  const d = 2 * halfD; // μήκος κατακόρυφης πλευράς
  const perSide = apportion(extras, [w, d, w, d]);
  const bars: Point2D[] = [...corners];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    bars.push(...interiorPoints(a, b, perSide[i]));
  }
  return bars;
}

/** Μέτρο διανύσματος· 0 → 1 (αποφυγή διαίρεσης με μηδέν). */
function safeLen(dx: number, dy: number): number {
  return Math.hypot(dx, dy) || 1;
}

/**
 * Κλειστή tessellated polyline με στρογγυλεμένες γωνίες από κυρτό πολύγωνο γωνιών
 * (CCW). Κάθε γωνία → τεταρτοκύκλιο (γενικά τόξο = π − εσωτ. γωνία) ακτίνας `rMm`,
 * **εφαπτόμενο** στις δύο γειτονικές πλευρές (κέντρο = εσωτερικό offset κατά rMm).
 * Τα ευθύγραμμα τμήματα μεταξύ διαδοχικών τόξων προκύπτουν αυτόματα (consumer
 * κάνει lineTo/segment). `rMm` clamped ≤ μισό της κοντύτερης πλευράς. Fallback στις
 * αιχμηρές γωνίες όταν `rMm ≤ 0` ή εκφυλισμένο πολύγωνο.
 */
export function buildRoundedStirrupPath(
  corners: readonly Point2D[],
  rMm: number,
  segPerArc: number,
): Point2D[] {
  const n = corners.length;
  if (n < 3 || rMm <= 0) return corners.map((c) => ({ x: c.x, y: c.y }));

  // Clamp: η ακτίνα δεν μπορεί να ξεπερνά το μισό της κοντύτερης πλευράς (αλλιώς
  // γειτονικά τόξα επικαλύπτονται).
  let minEdge = Infinity;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    minEdge = Math.min(minEdge, Math.hypot(b.x - a.x, b.y - a.y));
  }
  const r = Math.min(rMm, minEdge / 2);
  if (r <= 0) return corners.map((c) => ({ x: c.x, y: c.y }));

  const seg = Math.max(1, Math.floor(segPerArc));
  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];

    // Μοναδιαία διεύθυνση εισερχόμενης (prev→curr) & εξερχόμενης (curr→next) πλευράς.
    const inLen = safeLen(curr.x - prev.x, curr.y - prev.y);
    const inx = (curr.x - prev.x) / inLen;
    const iny = (curr.y - prev.y) / inLen;
    const outLen = safeLen(next.x - curr.x, next.y - curr.y);
    const outx = (next.x - curr.x) / outLen;
    const outy = (next.y - curr.y) / outLen;

    // Σημεία επαφής (tangent) πάνω στις δύο πλευρές, σε απόσταση r από τη γωνία.
    const tInx = curr.x - inx * r;
    const tIny = curr.y - iny * r;
    const tOutx = curr.x + outx * r;
    const tOuty = curr.y + outy * r;

    // Κέντρο τόξου = tangent + εσωτερικό κάθετο (αριστερά της φοράς, CCW) × r.
    const cx = tInx + -iny * r;
    const cy = tIny + inx * r;

    const a0 = Math.atan2(tIny - cy, tInx - cx);
    const a1 = Math.atan2(tOuty - cy, tOutx - cx);
    // Σύντομο τόξο (minor): φέρε το da στο (−π, π].
    let da = a1 - a0;
    da = ((da % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

    for (let k = 0; k <= seg; k++) {
      const a = a0 + (da * k) / seg;
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return out;
}

/** Μοναδιαίο διάνυσμα a→b (0,0 αν ταυτίζονται). */
function unit(ax: number, ay: number, bx: number, by: number): Point2D {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  return len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

/** Κανονικοποίηση γωνίας στο [0, 2π). */
function angleNorm(a: number): number {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * ΕΝΑ άκρο γάντζου 135° που **τυλίγεται γύρω από το γωνιακό κολωνοσίδερο** `bar`:
 * τόξο ακτίνας `wrapR` με κέντρο τη ράβδο, από το σημείο επαφής με την πλευρά
 * (`aSide`, πάνω στη γραμμή στεφανιού) κατά `sweep` (rad, ±) ως τη γωνία εξόδου, και
 * μετά **ευθεία ουρά** μήκους `tailLen` **εφαπτομενικά** προς τον πυρήνα (`tailDir`).
 * Επειδή τα δύο άκρα μοιράζονται κέντρο+ακτίνα, τα τόξα τους **ταυτίζονται** (ίδιος
 * κύκλος γύρω από τη ράβδο).
 */
function hookWrapArc(
  bar: Point2D,
  wrapR: number,
  aSide: number,
  sweep: number,
  tailDir: number,
  tailLen: number,
  seg: number,
): Point2D[] {
  const s = Math.max(4, Math.round((Math.abs(sweep) / (Math.PI / 2)) * Math.max(1, seg)));
  const pts: Point2D[] = [];
  for (let k = 0; k <= s; k++) {
    const a = aSide + (sweep * k) / s;
    pts.push({ x: bar.x + wrapR * Math.cos(a), y: bar.y + wrapR * Math.sin(a) });
  }
  // Ευθεία ουρά εφαπτομενικά (κατά `tailDir` = προς τον πυρήνα) → γωνία 45° με την πλευρά = 135° γάντζος.
  const last = pts[pts.length - 1];
  pts.push({ x: last.x + Math.cos(tailDir) * tailLen, y: last.y + Math.sin(tailDir) * tailLen });
  return pts;
}

/**
 * Τα **δύο άκρα** του γάντζου 135° στη γωνία κλεισίματος (closed-hooked): καθένα
 * **τυλίγεται ~135° γύρω από το γωνιακό κολωνοσίδερο** `bar` πάνω στον **ίδιο κύκλο**
 * (ακτίνα `wrapR` = dbL/2 + dbw/2 = ακριβώς η απόσταση ράβδου↔centerline στεφανιού →
 * το τόξο **ξεκινά πάνω στη γραμμή του στεφανιού**) και **φεύγει εφαπτομενικά προς τον
 * πυρήνα** κατά `STIRRUP_HOOK_EXTENSION_FACTOR·dbw` (EC8). Η εφαπτομενική έξοδος δίνει
 * ουρά **45° με την πλευρά → ακριβώς 135° γάντζος**· τα δύο άκρα φεύγουν από **αντίθετες
 * παρειές** της ράβδου → δύο **παράλληλες** ουρές, φυσικά διαχωρισμένες, με τα τόξα
 * τους να **ταυτίζονται** στον ίδιο κύκλο. LOCAL mm.
 */
export function buildStirrupHookEndsMm(
  ring: readonly Point2D[],
  bar: Point2D,
  center: Point2D,
  dbw: number,
  dbL: number,
  seg: number,
): Point2D[][] {
  if (ring.length < 4 || dbw <= 0) return [];
  const toC = unit(bar.x, bar.y, center.x, center.y); // ακτινικά προς τον πυρήνα
  if (toC.x === 0 && toC.y === 0) return [];
  const aCore = Math.atan2(toC.y, toC.x);
  const wrapR = dbL / 2 + dbw / 2;
  if (wrapR <= 0) return [];
  const tailLen = STIRRUP_HOOK_EXTENSION_FACTOR * dbw;
  const cc = ring[0];
  const edge1 = unit(cc.x, cc.y, ring[1].x, ring[1].y); // κατά τη μία πλευρά
  const edge2 = unit(cc.x, cc.y, ring[ring.length - 1].x, ring[ring.length - 1].y); // κατά την άλλη

  // Η ουρά φεύγει εφαπτομενικά προς τον πυρήνα. Εφαπτομένη = aCore σε δύο σημεία του
  // κύκλου: leave = aCore−90° (φεύγει με CCW τόξο) ή aCore+90° (με CW τόξο).
  const leaveCcw = aCore - Math.PI / 2;
  const leaveCw = aCore + Math.PI / 2;

  const ends: Point2D[][] = [];
  for (const edge of [edge1, edge2]) {
    if (edge.x === 0 && edge.y === 0) continue;
    // Σημείο επαφής της πλευράς με τη ράβδο: η πλευρά είναι στην απέναντι (εξωτερική)
    // μεριά → ακτινική γωνία = −nIn (nIn = εσωτερικό κάθετο προς τον πυρήνα).
    let nIn: Point2D = { x: -edge.y, y: edge.x };
    if (nIn.x * toC.x + nIn.y * toC.y < 0) nIn = { x: -nIn.x, y: -nIn.y };
    const aSide = Math.atan2(-nIn.y, -nIn.x);
    // Δύο υποψήφιες έξοδοι· διάλεξε αυτή με τύλιγμα ~135° (το μεγάλο τόξο που αγκαλιάζει).
    const wCcw = angleNorm(leaveCcw - aSide); // CCW μέγεθος
    const wCw = angleNorm(aSide - leaveCw); // CW μέγεθος
    const sweep = wCcw >= wCw ? wCcw : -wCw;
    ends.push(hookWrapArc(bar, wrapR, aSide, sweep, aCore, tailLen, seg));
  }
  return ends;
}

/**
 * Περίμετρος **άξονα** (centerline) κλειστού στρογγυλεμένου συνδετήρα (mm) — η
 * γεωμετρική αλήθεια που τρέφει ΚΑΙ τη σχεδίαση ΚΑΙ τις ποσότητες (geometry-is-SSoT).
 * Centerline inset = `cover + dbw/2`· στρογγυλεμένες γωνίες ακτίνας
 * `STIRRUP_BEND_CL_FACTOR·dbw`: περίμετρος = 2(W+D) − 8r + 2πr. Επιστρέφει 0 για
 * εκφυλισμένη διατομή.
 */
export function stirrupCenterlinePerimeterMm(
  r: ColumnReinforcement,
  widthMm: number,
  depthMm: number,
): number {
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const inset = Math.max(0, r.coverMm) + dbw / 2;
  const halfWs = Math.max(0, widthMm / 2 - inset);
  const halfDs = Math.max(0, depthMm / 2 - inset);
  const W = 2 * halfWs;
  const D = 2 * halfDs;
  if (W <= 0 || D <= 0) return 0;
  const rad = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, halfWs, halfDs);
  // Στρογγυλεμένο ορθογώνιο: ευθεία 2(W+D)−8r + 4 τεταρτοκύκλια (=2πr).
  return 2 * (W + D) - 8 * rad + 2 * Math.PI * rad;
}

/**
 * Υπολογίζει τη διάταξη οπλισμού ορθογωνικής διατομής σε LOCAL mm. Επιστρέφει
 * `null` αν η διατομή είναι εκφυλισμένη (≤0) ή δεν υπάρχει οπλισμός να σχεδιαστεί.
 */
export function computeColumnRebarLayout(
  r: ColumnReinforcement,
  widthMm: number,
  depthMm: number,
): ColumnRebarLayout | null {
  if (widthMm <= 0 || depthMm <= 0) return null;
  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);

  // Centerline στεφανιού: inset = cover + μισή διάμετρος συνδετήρα.
  const stirrupInset = cover + dbw / 2;
  const halfWs = Math.max(0, widthMm / 2 - stirrupInset);
  const halfDs = Math.max(0, depthMm / 2 - stirrupInset);
  const stirrupRingMm: Point2D[] = [
    { x: -halfWs, y: -halfDs },
    { x: halfWs, y: -halfDs },
    { x: halfWs, y: halfDs },
    { x: -halfWs, y: halfDs },
  ];

  // Κέντρα διαμήκων ράβδων: inset = cover + Ø_συνδ + μισή Ø_διαμήκους.
  const barInset = cover + dbw + dbL / 2;
  const halfWb = Math.max(0, widthMm / 2 - barInset);
  const halfDb = Math.max(0, depthMm / 2 - barInset);
  const longitudinalBarsMm = distributeBars(halfWb, halfDb, Math.max(0, Math.floor(r.longitudinal.count)));

  if (longitudinalBarsMm.length === 0 && (halfWs <= 0 || halfDs <= 0)) return null;

  // Ακτίνα κάμψης γωνίας (EC2) — clamped ≤ μισό κοντύτερης πλευράς (μέσα στον generator).
  const stirrupCornerRadiusMm = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, halfWs, halfDs);
  const stirrupPathMm = buildRoundedStirrupPath(stirrupRingMm, stirrupCornerRadiusMm, STIRRUP_BEND_ARC_SEGMENTS);
  // Δύο άκρα γάντζου 135° στη γωνία κλεισίματος, τυλιγμένα γύρω από το γωνιακό
  // κολωνοσίδερο (longitudinalBarsMm[0] = ίδια γωνία BL με stirrupRingMm[0]· fallback
  // στη γωνία στεφανιού αν δεν υπάρχουν ράβδοι). Κέντρο διατομής = origin (LOCAL mm).
  const hookBar = longitudinalBarsMm.length > 0 ? longitudinalBarsMm[0] : stirrupRingMm[0];
  const stirrupHookEndsMm = buildStirrupHookEndsMm(stirrupRingMm, hookBar, { x: 0, y: 0 }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS);

  return {
    longitudinalBarsMm,
    stirrupRingMm,
    stirrupPathMm,
    stirrupCornerRadiusMm,
    stirrupHookEndsMm,
    barDiameterMm: dbL,
    stirrupDiameterMm: dbw,
  };
}

/**
 * Μήκος κρίσιμης περιοχής άκρου lcr (mm) — EC8 §5.4.3.2.2(4): max(μεγ. διάσταση
 * διατομής, ύψος/6, 450). Κοινή λογική με `column-reinforcement-compute`.
 */
function criticalZoneLengthMm(widthMm: number, depthMm: number, heightMm: number): number {
  return Math.max(Math.max(widthMm, depthMm), heightMm / 6, 450);
}

/**
 * Στάθμες z (mm από τη βάση) των στεφανιών κατά το ύψος: πυκνό βήμα
 * `spacingCriticalMm` στις δύο κρίσιμες ζώνες άκρων (lcr), αραιό `spacingMm` στη
 * μέση. Συνεπές με το `computeStirrupCount` (ίδιες ζώνες) — εδώ παράγει ΘΕΣΕΙΣ.
 * Επιστρέφει [] για εκφυλισμένο ύψος/βήμα.
 */
export function computeStirrupLevelsMm(
  r: ColumnReinforcement,
  widthMm: number,
  depthMm: number,
  heightMm: number,
): number[] {
  const { spacingMm, spacingCriticalMm } = r.stirrups;
  if (heightMm <= 0 || spacingMm <= 0) return [];
  const sCrit = spacingCriticalMm && spacingCriticalMm > 0 ? spacingCriticalMm : spacingMm;
  const lcr = Math.min(criticalZoneLengthMm(widthMm, depthMm, heightMm), heightMm / 2);

  const levels: number[] = [0];
  let z = 0;
  // Ανέβα με βήμα που εξαρτάται από τη ζώνη· τελευταίο στεφάνι πάντα στην κορυφή.
  let guard = 0;
  while (z < heightMm && guard++ < 100000) {
    const inCritical = z < lcr - 1e-6 || z > heightMm - lcr + 1e-6;
    const step = inCritical ? sCrit : spacingMm;
    z += step;
    if (z < heightMm - 1e-6) levels.push(z);
  }
  levels.push(heightMm);
  return levels;
}
