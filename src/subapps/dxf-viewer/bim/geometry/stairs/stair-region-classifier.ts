/**
 * ADR-619 — Ταξινομητής «Σκάλα από περιοχή» (stair-from-region).
 *
 * Καθαρή συνάρτηση: παίρνει ένα ΚΛΕΙΣΤΟ ελεύθερο πολύγωνο (το κλιμακοστάσιο που
 * σχεδίασε ο χρήστης) και αποφασίζει ΤΙ ΤΥΠΟ σκάλας «χωράει» μέσα του, με βάση
 * το ΣΧΗΜΑ του αποτυπώματος:
 *
 *   - ~ορθογώνιο (γεμάτο)            → 'straight'      (ευθεία)
 *   - ~Γ / L (δύο ορθογώνια)         → 'lWithWinders'  (τεταρτοστροφική)
 *   - ~Π / U (switchback)            → 'switchback'    (ημιστροφική)
 *   - ~κύκλος (υψηλή κυκλικότητα)    → 'spiral'        (ελικοειδής)
 *
 * ΠΟΤΕ δεν πετάει exception: εκφυλισμένα/ανεπαρκή πολύγωνα (<3 κορυφές ή μηδενικό
 * εμβαδόν) επιστρέφουν low-confidence 'straight' fallback με `warning`.
 *
 * SSoT γεωμετρίας: επαναχρησιμοποιεί ΟΛΑ τα polygon helpers από
 * `bim/geometry/shared/polygon-utils.ts` (shoelace/area/perimeter/bbox/centroid)
 * — μηδέν διπλότυπο shoelace/centroid (N.0.2). Vec2 από το stair shared SSoT.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Vec2 } from './stair-geometry-shared';
import {
  polygonArea,
  polygonPerimeter,
  polygonBbox,
  polygonAreaCentroid,
} from '../shared/polygon-utils';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Τύπος σκάλας που προκύπτει από το σχήμα της περιοχής. */
export type StairRegionKind = 'straight' | 'lWithWinders' | 'switchback' | 'spiral';

/**
 * Αποτέλεσμα ταξινόμησης της περιοχής. `direction` = ΜΟΝΑΔΙΑΙΟ διάνυσμα κατά τον
 * ΜΑΚΡΥ άξονα (module B το μετατρέπει σε μοίρες). Όλα τα μήκη σε scene units του
 * input πολυγώνου. Για 'spiral': `basePoint` = κέντρο (area centroid), `width` =
 * ακτίνα (short/2).
 */
export interface StairRegionClassification {
  readonly kind: StairRegionKind;
  readonly basePoint: Point2D;
  readonly direction: Vec2;
  readonly width: number;
  /** Μήκος κατά τον μακρύ άξονα (bbox long). */
  readonly run: number;
  /** Το input αποτύπωμα (αμετάβλητο αντίγραφο). */
  readonly footprint: readonly Point2D[];
  readonly circularity: number;
  readonly fillRatio: number;
  readonly cornerCount: number;
  /** Εμπιστοσύνη 0..1. */
  readonly confidence: number;
  /** Κωδικός προειδοποίησης (internal, όχι user-facing) όταν έγινε fallback. */
  readonly warning?: string;
}

// ─── Decision thresholds ──────────────────────────────────────────────────────

const FILL_STRAIGHT_MIN = 0.85;
const FILL_L_MIN = 0.45;
const FILL_L_MAX = 0.85;
const CIRC_SPIRAL_MIN = 0.7;
/** Ημίτονο μέγιστης απόκλισης για «συγγραμμικό» (≈5°) στο simplify. */
const COLLINEAR_SIN_TOL = 0.08;
/** Ανοχή για «σχεδόν 90°» γωνία κορυφής. */
const NEAR_90_TOL_DEG = 22;
const RAD_TO_DEG = 180 / Math.PI;

const WARNING_DEGENERATE = 'degenerate-region';
const WARNING_LOW_CONFIDENCE = 'low-confidence-fallback';

// ─── Small vector helpers (τοπικά, zero-dep) ──────────────────────────────────

function sub(a: Point2D, b: Point2D): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(v: Vec2): Vec2 | null {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-12) return null;
  return { x: v.x / len, y: v.y / len };
}

function lift(v: Point2D): Point3D {
  return { x: v.x, y: v.y, z: 0 };
}

// ─── Normalisation + metrics ──────────────────────────────────────────────────

/** Αφαιρεί διαδοχικά διπλά + το closing duplicate (last === first). */
function dedupe(vertices: readonly Point2D[], eps: number): Point2D[] {
  const out: Point2D[] = [];
  for (const v of vertices) {
    const last = out[out.length - 1];
    if (last && Math.hypot(v.x - last.x, v.y - last.y) < eps) continue;
    out.push({ x: v.x, y: v.y });
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < eps) out.pop();
  }
  return out;
}

/** Απλοποίηση συγγραμμικών κορυφών (unit-edge cross < sinTol). */
function simplifyCollinear(pts: readonly Point2D[]): Point2D[] {
  let ring = [...pts];
  let changed = true;
  while (changed && ring.length > 3) {
    changed = false;
    const out: Point2D[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = normalize(sub(ring[i], ring[(i - 1 + n) % n]));
      const b = normalize(sub(ring[(i + 1) % n], ring[i]));
      if (!a || !b) { changed = true; continue; }
      if (Math.abs(a.x * b.y - a.y * b.x) < COLLINEAR_SIN_TOL) { changed = true; continue; }
      out.push(ring[i]);
    }
    if (out.length < 3) break;
    ring = out;
  }
  return ring;
}

/** Πλήθος κορυφών με γωνία ≈90° (winding-agnostic). */
function countNear90(corners: readonly Point2D[]): number {
  const n = corners.length;
  if (n < 3) return 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = normalize(sub(corners[(i - 1 + n) % n], corners[i]));
    const b = normalize(sub(corners[(i + 1) % n], corners[i]));
    if (!a || !b) continue;
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
    const angDeg = Math.acos(dot) * RAD_TO_DEG;
    if (Math.abs(angDeg - 90) < NEAR_90_TOL_DEG) count += 1;
  }
  return count;
}

interface RegionMetrics {
  readonly area: number;
  readonly fillRatio: number;
  readonly circularity: number;
  readonly cornerCount: number;
  readonly near90Count: number;
  readonly basePoint: Point2D;
  readonly direction: Vec2;
  readonly run: number;
  readonly width: number;
  readonly centroid: Point2D;
  readonly short: number;
}

/** bbox-fit άξονας: basePoint = μέσο της ΚΟΝΤΗΣ ακμής, direction κατά τον ΜΑΚΡΥ. */
function computeMetrics(ring2d: readonly Point2D[]): RegionMetrics {
  const v3 = ring2d.map(lift);
  const bbox = polygonBbox(v3);
  const W = bbox.max.x - bbox.min.x;
  const H = bbox.max.y - bbox.min.y;
  const long = Math.max(W, H);
  const short = Math.min(W, H);
  const area = polygonArea(v3);
  const perimeter = polygonPerimeter(v3);
  const fillRatio = W * H > 0 ? area / (W * H) : 0;
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const corners = simplifyCollinear(ring2d);
  const centroidRaw = polygonAreaCentroid(v3);
  const centroid: Point2D = { x: centroidRaw.x, y: centroidRaw.y };
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  const alongX = W >= H;
  const basePoint: Point2D = alongX
    ? { x: bbox.min.x, y: cy }
    : { x: cx, y: bbox.min.y };
  const direction: Vec2 = alongX ? { x: 1, y: 0 } : { x: 0, y: 1 };
  return {
    area,
    fillRatio,
    circularity,
    cornerCount: corners.length,
    near90Count: countNear90(corners),
    basePoint,
    direction,
    run: long,
    width: short,
    centroid,
    short,
  };
}

// ─── Kind decision ────────────────────────────────────────────────────────────

function decideKind(m: RegionMetrics): StairRegionKind | null {
  // Spiral ΠΡΩΤΑ: υψηλή κυκλικότητα + ελάχιστες ορθές γωνίες (αποκλείει τετράγωνο,
  // που έχει circularity ~0.785 αλλά 4 ορθές γωνίες).
  if (m.circularity > CIRC_SPIRAL_MIN && m.near90Count <= 2 && m.cornerCount >= 6) {
    return 'spiral';
  }
  if (m.fillRatio > FILL_STRAIGHT_MIN && m.cornerCount <= 5) {
    return 'straight';
  }
  if (m.cornerCount >= 5 && m.cornerCount <= 7 && m.fillRatio >= FILL_L_MIN && m.fillRatio <= FILL_L_MAX) {
    return 'lWithWinders';
  }
  if (m.cornerCount >= 7 && m.cornerCount <= 10) {
    return 'switchback';
  }
  return null;
}

function confidenceFor(kind: StairRegionKind, m: RegionMetrics): number {
  switch (kind) {
    case 'straight': return Math.min(1, 0.55 + 0.45 * m.fillRatio);
    case 'lWithWinders': return 0.72;
    case 'switchback': return 0.66;
    case 'spiral': return Math.min(1, m.circularity);
  }
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Ταξινομεί ένα κλειστό πολύγωνο περιοχής σε τύπο σκάλας. ΠΟΤΕ δεν πετάει —
 * εκφυλισμένη είσοδος → 'straight' fallback με `warning`.
 */
export function classifyStairRegion(
  vertices: readonly Point2D[],
  sceneUnits: SceneUnits = 'mm',
): StairRegionClassification {
  const footprint: Point2D[] = vertices.map((p) => ({ x: p.x, y: p.y }));
  // 1mm σε scene units → κατώφλι εκφυλισμού (unit-aware).
  const eps = mmToSceneUnits(sceneUnits);
  const ring = dedupe(footprint, eps);

  if (ring.length < 3) {
    return degenerateFallback(footprint, ring);
  }

  const m = computeMetrics(ring);
  if (m.area <= eps * eps || m.run <= eps) {
    return degenerateFallback(footprint, ring, m);
  }

  const kind = decideKind(m);
  if (kind === null) {
    return {
      kind: 'straight',
      basePoint: m.basePoint,
      direction: m.direction,
      width: m.width,
      run: m.run,
      footprint,
      circularity: m.circularity,
      fillRatio: m.fillRatio,
      cornerCount: m.cornerCount,
      confidence: 0.3,
      warning: WARNING_LOW_CONFIDENCE,
    };
  }

  // spiral: κέντρο = area centroid, width = ακτίνα (short/2).
  const basePoint = kind === 'spiral' ? m.centroid : m.basePoint;
  const width = kind === 'spiral' ? m.short / 2 : m.width;
  return {
    kind,
    basePoint,
    direction: m.direction,
    width,
    run: m.run,
    footprint,
    circularity: m.circularity,
    fillRatio: m.fillRatio,
    cornerCount: m.cornerCount,
    confidence: confidenceFor(kind, m),
  };
}

/** Low-confidence 'straight' fallback για εκφυλισμένα πολύγωνα (μηδέν crash). */
function degenerateFallback(
  footprint: readonly Point2D[],
  ring: readonly Point2D[],
  m?: RegionMetrics,
): StairRegionClassification {
  return {
    kind: 'straight',
    basePoint: m?.basePoint ?? ring[0] ?? { x: 0, y: 0 },
    direction: m?.direction ?? { x: 1, y: 0 },
    width: m?.width ?? 0,
    run: m?.run ?? 0,
    footprint,
    circularity: m?.circularity ?? 0,
    fillRatio: m?.fillRatio ?? 0,
    cornerCount: m?.cornerCount ?? ring.length,
    confidence: 0.1,
    warning: WARNING_DEGENERATE,
  };
}
