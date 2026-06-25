/**
 * ADR-533 — Καθαρός αναγνωριστής συμβόλου κουφώματος από **σκέτη DXF γεωμετρία**
 * (γραμμές + τόξα) πάνω σε έναν τοίχο. Είναι το **ανάστροφο** του
 * `buildDoorSymbolSegments` (ADR-531, `io/tek/tek-window-symbol.ts`): αντί να
 * *σχεδιάζει* το σύμβολο, το *αναγνωρίζει*.
 *
 * Πηγή-ανεξάρτητο (zero React / EventBus / store): είσοδος = wall axis + nearby
 * lines/arcs, έξοδος = `DetectedOpening[]`. Έτσι αργότερα η διαδρομή Τέκτονα
 * (δομημένα `TekOpeningRecord`) τροφοδοτεί τον ΙΔΙΟ resolver — μία πηγή αλήθειας.
 *
 * Σήμα (γεωμετρία):
 *  - **Πόρτα:** 1 τόξο ~90° + 1 ευθεία (φύλλο) από το κέντρο (μεντεσές) στο
 *    κάθετο άκρο. Το κέντρο κάθεται στην παρειά → 1 άκρο ακτίνας κατά μήκος
 *    τοίχου (κλειστό), το άλλο κάθετο (ανοιχτό). Τεταρτημόριο → handing/φορά.
 *  - **Παράθυρο:** 2+ παράλληλες-στον-τοίχο γραμμές που γεφυρώνουν το κενό
 *    (υαλοπίνακας), με διαφορετικό perp-offset, μήκος < ολόκληρος ο τοίχος.
 *
 * Όλες οι ανοχές είναι **λόγοι** (× πάχος / × μήκος τοίχου) → unit-independent.
 * Όλες οι μετρήσεις σε **scene units** (ο host μετατρέπει thickness mm → scene).
 *
 * @module bim/walls/dxf-symbol-detector
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArcEntity, LineEntity } from '../../types/entities';
import { clamp01, getLineParameter } from '../../rendering/entities/shared/geometry-utils';
import {
  calculateDistance,
  dotProduct,
  getUnitVector,
  getPerpendicularUnitVector,
  pointOnCircle,
  subtractPoints,
} from '../../rendering/entities/shared/geometry-vector-utils';

// ─── Public types ────────────────────────────────────────────────────────────

export type DetectedKind = 'door' | 'window';

/** Αναγνωρισμένο κούφωμα, εκφρασμένο **σχετικά** με τον άξονα του τοίχου. */
export interface DetectedOpening {
  readonly kind: DetectedKind;
  /** [0,1] κατά μήκος του άξονα τοίχου, στο κέντρο του ανοίγματος. */
  readonly tCenter: number;
  /** Εύρος (χορδή) σε scene units. */
  readonly widthScene: number;
  /** Door only — πλευρά μεντεσέ (calibration-dependent· βλ. ADR-533). */
  readonly handing?: 'left' | 'right';
  /** Door only — φορά ανοίγματος (calibration-dependent· βλ. ADR-533). */
  readonly openDirection?: 'inward' | 'outward';
  /** id του arc (πόρτα) ή της 1ης γραμμής υαλοπίνακα (παράθυρο). */
  readonly sourceEntityId: string;
}

/** Σταθερές ανοχών (λόγοι). Όλες optional → defaults calibrated στο ADR-533. */
export interface SymbolDetectorOptions {
  /** Μέγιστη απόσταση κέντρου-τόξου από τον άξονα, ως λόγος × πάχος. */
  readonly arcCenterBandRatio?: number;
  /** Ανοχή απόκλισης γωνίας τόξου από 90° (μοίρες). */
  readonly arcSpanToleranceDeg?: number;
  /** Ανοχή ταιριάσματος άκρων φύλλου, ως λόγος × ακτίνα. */
  readonly leafMatchRatio?: number;
  /** Ελάχιστο |dot| για «παράλληλη στον τοίχο» γραμμή υαλοπίνακα. */
  readonly windowParallelDot?: number;
  /** Μέγιστη απόσταση γραμμής υαλοπίνακα από τον άξονα, ως λόγος × πάχος. */
  readonly windowFaceBandRatio?: number;
}

const DEFAULTS: Required<SymbolDetectorOptions> = {
  arcCenterBandRatio: 1.5,
  arcSpanToleranceDeg: 25,
  leafMatchRatio: 0.25,
  windowParallelDot: 0.97,
  windowFaceBandRatio: 1.5,
};

// ─── Internal context ────────────────────────────────────────────────────────

interface DetectCtx {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly len: number;
  readonly dir: Point2D;
  readonly perp: Point2D;
  readonly thickness: number;
  readonly cfg: Required<SymbolDetectorOptions>;
}

const deg2rad = (d: number): number => (d * Math.PI) / 180;

/** Παράμετρος προβολής σημείου στον άξονα τοίχου (0=start, 1=end). */
const axisParam = (p: Point2D, c: DetectCtx): number => getLineParameter(p, c.start, c.end);

/** Κάθετη (perp) απόσταση σημείου από τον άξονα τοίχου. */
const perpDist = (p: Point2D, c: DetectCtx): number =>
  Math.abs(dotProduct(subtractPoints(p, c.start), c.perp));

/** Direction-agnostic γωνία τόξου σε μοίρες, [0,180]. */
function arcSpanDeg(arc: ArcEntity): number {
  const raw = (((arc.endAngle - arc.startAngle) % 360) + 360) % 360;
  return Math.min(raw, 360 - raw);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function detectSymbolsOnWall(
  wallStart: Readonly<Point2D>,
  wallEnd: Readonly<Point2D>,
  wallThicknessScene: number,
  candidates: readonly (LineEntity | ArcEntity)[],
  opts: SymbolDetectorOptions = {},
): DetectedOpening[] {
  const len = calculateDistance(wallStart, wallEnd);
  if (len < 1e-6 || wallThicknessScene <= 0) return [];
  const ctx: DetectCtx = {
    start: wallStart,
    end: wallEnd,
    len,
    dir: getUnitVector(wallStart, wallEnd),
    perp: getPerpendicularUnitVector(wallStart, wallEnd),
    thickness: wallThicknessScene,
    cfg: { ...DEFAULTS, ...opts },
  };

  const arcs = candidates.filter((c): c is ArcEntity => c.type === 'arc');
  const lines = candidates.filter((c): c is LineEntity => c.type === 'line');

  const out: DetectedOpening[] = [];
  const usedLeafIds = new Set<string>();
  for (const arc of arcs) {
    const hit = detectDoor(arc, lines, ctx);
    if (hit) {
      out.push(hit.opening);
      if (hit.leafId) usedLeafIds.add(hit.leafId);
    }
  }
  const windowLines = lines.filter((l) => !usedLeafIds.has(l.id));
  out.push(...detectWindows(windowLines, ctx));
  return out;
}

// ─── Door detection (arc + leaf) ─────────────────────────────────────────────

function detectDoor(
  arc: ArcEntity,
  lines: readonly LineEntity[],
  c: DetectCtx,
): { opening: DetectedOpening; leafId: string | null } | null {
  if (arc.radius <= 0) return null;
  if (Math.abs(arcSpanDeg(arc) - 90) > c.cfg.arcSpanToleranceDeg) return null;
  if (perpDist(arc.center, c) > c.thickness * c.cfg.arcCenterBandRatio) return null;
  const centerParam = axisParam(arc.center, c);
  if (centerParam < -0.1 || centerParam > 1.1) return null;

  const p1 = pointOnCircle(arc.center, arc.radius, deg2rad(arc.startAngle));
  const p2 = pointOnCircle(arc.center, arc.radius, deg2rad(arc.endAngle));
  // Κλειστό = το άκρο που τρέχει ΚΑΤΑ ΜΗΚΟΣ του τοίχου (|dot|≈1)· ανοιχτό = κάθετο.
  const align1 = Math.abs(dotProduct(getUnitVector(arc.center, p1), c.dir));
  const align2 = Math.abs(dotProduct(getUnitVector(arc.center, p2), c.dir));
  const closed = align1 >= align2 ? p1 : p2;
  const open = align1 >= align2 ? p2 : p1;

  const leafId = findLeaf(arc.center, open, arc.radius, lines, c);
  if (!leafId) return null;

  const closedParam = axisParam(closed, c);
  const widthScene = Math.abs(closedParam - centerParam) * c.len;
  if (widthScene < c.len * 0.02) return null;
  const opening: DetectedOpening = {
    kind: 'door',
    tCenter: clamp01((centerParam + closedParam) / 2),
    widthScene,
    handing: centerParam <= closedParam ? 'left' : 'right',
    openDirection: dotProduct(subtractPoints(open, arc.center), c.perp) >= 0 ? 'inward' : 'outward',
    sourceEntityId: arc.id,
  };
  return { opening, leafId };
}

/** Γραμμή φύλλου: από μεντεσέ (hinge=κέντρο) στο κάθετο άκρο (tip). */
function findLeaf(
  hinge: Point2D,
  tip: Point2D,
  radius: number,
  lines: readonly LineEntity[],
  c: DetectCtx,
): string | null {
  const tol = Math.max(c.thickness * 0.5, radius * c.cfg.leafMatchRatio);
  for (const l of lines) {
    const ab = calculateDistance(l.start, hinge) <= tol && calculateDistance(l.end, tip) <= tol;
    const ba = calculateDistance(l.end, hinge) <= tol && calculateDistance(l.start, tip) <= tol;
    if (ab || ba) return l.id;
  }
  return null;
}

// ─── Window detection (parallel glass lines) ─────────────────────────────────

/** [tmin,tmax] της γραμμής προβεβλημένης στον άξονα τοίχου. */
function lineAxisInterval(l: LineEntity, c: DetectCtx): [number, number] {
  const a = axisParam(l.start, c);
  const b = axisParam(l.end, c);
  return a <= b ? [a, b] : [b, a];
}

/** Signed perp-offset του μέσου της γραμμής (διαχωρισμός υαλοπινάκων). */
function linePerpOffset(l: LineEntity, c: DetectCtx): number {
  const mid: Point2D = { x: (l.start.x + l.end.x) / 2, y: (l.start.y + l.end.y) / 2 };
  return dotProduct(subtractPoints(mid, c.start), c.perp);
}

function detectWindows(lines: readonly LineEntity[], c: DetectCtx): DetectedOpening[] {
  const band = c.thickness * c.cfg.windowFaceBandRatio;
  const glass = lines.filter(
    (l) =>
      Math.abs(dotProduct(getUnitVector(l.start, l.end), c.dir)) >= c.cfg.windowParallelDot &&
      perpDist(l.start, c) <= band &&
      perpDist(l.end, c) <= band,
  );
  const out: DetectedOpening[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < glass.length; i++) {
    for (let j = i + 1; j < glass.length; j++) {
      const win = pairToWindow(glass[i], glass[j], c);
      if (!win) continue;
      const key = win.tCenter.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(win);
    }
  }
  return out;
}

/** Ζεύγος παράλληλων γραμμών → window αν γεφυρώνουν το ΙΔΙΟ κενό σε 2 perp-offsets. */
function pairToWindow(a: LineEntity, b: LineEntity, c: DetectCtx): DetectedOpening | null {
  const ia = lineAxisInterval(a, c);
  const ib = lineAxisInterval(b, c);
  const lo = Math.max(ia[0], ib[0]);
  const hi = Math.min(ia[1], ib[1]);
  const overlap = hi - lo;
  if (overlap <= 0) return null;
  const minLen = Math.min(ia[1] - ia[0], ib[1] - ib[0]);
  if (overlap < minLen * 0.5) return null;
  // Διαφορετικό perp-offset → 2 διακριτές γραμμές υαλοπίνακα (όχι η ίδια ακμή).
  if (Math.abs(linePerpOffset(a, c) - linePerpOffset(b, c)) < c.thickness * 0.08) return null;
  const widthScene = overlap * c.len;
  // Πολύ μικρό = θόρυβος· σχεδόν ολόκληρος ο τοίχος = οι ΠΑΡΕΙΕΣ του, όχι παράθυρο.
  if (widthScene < c.len * 0.03 || overlap > 0.9) return null;
  return {
    kind: 'window',
    tCenter: clamp01((lo + hi) / 2),
    widthScene,
    sourceEntityId: a.id,
  };
}
