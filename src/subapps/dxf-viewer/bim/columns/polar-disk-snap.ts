/**
 * ADR-398 §3.13 «Polar Magnet» — πολικό snap κολώνας ΜΕΣΑ στον δίσκο ενός κύκλου (pure SSoT).
 *
 * Όταν το εργαλείο Κολώνα μπαίνει **εντός** κυκλικού δίσκου, ο δίσκος γίνεται φυσικό **πολικό
 * σύστημα συντεταγμένων**: κέντρο + ομόκεντροι δακτύλιοι + ακτινικές ακτίνες σε «στρογγυλά»
 * νούμερα (zoom-adaptive). Η κολώνα κουμπώνει σε **κέντρο** ή **δακτύλιο ∩ ακτίνα**, με live
 * listening dims **R + θ** (μέσω του §3.12 arc-frame: radius dim + arc-gap angle).
 *
 * **FULL SSoT — μηδέν νέα math:**
 *   · ring/angle βήμα → `adaptiveDistanceStep` + `quantizeMagnitude` (`systems/tracking/adaptive-distance-snap`)·
 *   · γωνία↔σημείο → `calculateAngle` + `pointOnCircle` (`rendering/entities/shared/geometry-vector-utils`)·
 *   · faceFrame R/θ → `buildCenteredAxisFaceFrame` με `arc` (ΙΔΙΟ §3.12 arc-length dim path).
 * Η ΜΟΝΑΔΙΚΗ νέα «math» = οι 5 σταθεροί λόγοι κλασμάτων ακτίνας (Shift mode) + το quantize σε nice
 * γωνία — και τα δύο reuse την 1/2/5 λογική του `niceRound`.
 *
 * **Αποφάσεις (Giorgio 2026-06-22):**
 *   · Q1 ring spacing: default nice-absolute zoom-adaptive· **Shift** → κλάσματα ακτίνας R/4…3R/4.
 *   · Q2 angle: zoom-adaptive arc-length → quantize σε {5,10,15,30,45,90}° (σταθερό ~25px screen-spacing).
 *   · Q4 precedence: κέντρο > δακτύλιος∩ακτίνα (intersection)· στο χείλος → `null` → caller πέφτει στο
 *     §3.12 circumference (nearest-wins).
 *   · Q5 edge clearance: `maxRing = radius − (clearanceScene)` (= ημι-διαγώνιος κολώνας + cover, caller).
 *
 * Pure — zero React/DOM/store. Μονάδες: scene units.
 *
 * @see ./column-face-snap.ts — ο κλάδος που το καλεί (cursor εντός δίσκου, nearest-wins vs §3.12)
 * @see ../framing/ghost-face-dim-references.ts — arc-length R/θ listening dims (reuse)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.13
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { adaptiveDistanceStep } from '../../systems/tracking/adaptive-distance-snap';
import { pointOnCircle, calculateAngle } from '../../rendering/entities/shared/geometry-vector-utils';
import { buildCenteredAxisFaceFrame } from './column-face-snap-helpers';
import type { GhostFaceFrame } from '../framing/linear-member-face-snap';

/** Structural cover (mm) από το χείλος — default όταν ο caller δεν δίνει `clearanceScene` (Q5). */
const POLAR_COVER_MM = 50;
/** Ακτίνα capture (px) γύρω από το κέντρο για το center snap (Revit-grade nearest, zoom-σταθερό). */
const CENTER_CAPTURE_PX = 12;
/** Nice γωνιακά βήματα (μοίρες) — όλα διαιρούν το 360 (72/36/24/12/8/4 ακτίνες). */
const NICE_ANGLES_DEG: readonly number[] = [5, 10, 15, 30, 45, 90];
/** Κλάσματα ακτίνας για το Shift mode (Q1) — R/4, R/3, R/2, 2R/3, 3R/4. */
const RADIUS_FRACTIONS: readonly number[] = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

const DEG = 180 / Math.PI;

/** Κύκλος-στόχος ως δίσκος (κέντρο + ακτίνα, scene units). */
export interface PolarDisk {
  readonly center: Point2D;
  readonly radius: number;
}

/** Επιλογές polar snap — zoom (worldPerPixel), Shift fractions, edge clearance (caller-computed). */
export interface PolarDiskSnapOptions {
  /** `1/scale` (world units ανά pixel) — για το zoom-adaptive ring/angle βήμα. */
  readonly worldPerPixel: number;
  /** Q1 — `true` → δακτύλιοι σε κλάσματα ακτίνας αντί nice-absolute (κράτημα Shift). */
  readonly shiftFractions?: boolean;
  /** Q5 — περιθώριο (scene units) από το χείλος (ημι-διαγώνιος κολώνας + cover). Default = cover 50mm. */
  readonly clearanceScene?: number;
}

/** Αποτέλεσμα polar snap: θέση + ring/angle + faceFrame (R/θ dims) + dist (για nearest-wins). */
export interface PolarDiskSnap {
  readonly position: Point2D;
  /** Ακτίνα δακτυλίου (scene units)· `0` στο κέντρο. */
  readonly ringR: number;
  /** Γωνία θέσης (μοίρες, [0,360))· `0` στο κέντρο. */
  readonly angleDeg: number;
  readonly isCenter: boolean;
  /** Απόσταση cursor→snapped position — για σύγκριση προτεραιότητας με §3.12 circumference. */
  readonly dist: number;
  readonly faceFrame: GhostFaceFrame;
}

/** Το ορατό πολικό πλέγμα (rings + spokes) για τον overlay painter (§3.13 A6). */
export interface PolarDiskGrid {
  readonly center: Point2D;
  /** Ακτίνες ομόκεντρων δακτυλίων (scene units, αύξουσες, ≤ maxRing). */
  readonly rings: readonly number[];
  /** Γωνίες ακτινικών ακτίνων (μοίρες, [0,360)) — πυκνότητα του ενεργού (πλησιέστερου) δακτυλίου. */
  readonly spokesDeg: readonly number[];
  /** Ακτίνα εξώτατου δακτυλίου (μήκος spoke). */
  readonly outerR: number;
}

/**
 * Q5 — edge clearance (scene units) = structural cover + **ημι-διαγώνιος** κολώνας. Κεντρικό SSoT για
 * τους callers (ghost + commit) ώστε ο εξώτατος δακτύλιος να μην ακουμπά/προεξέχει στο χείλος.
 */
export function polarClearanceScene(columnWidthMm: number, columnDepthMm: number, sceneUnits: SceneUnits): number {
  const halfDiagMm = 0.5 * Math.hypot(columnWidthMm, columnDepthMm);
  return (POLAR_COVER_MM + halfDiagMm) * mmToSceneUnits(sceneUnits);
}

const dist2 = (a: Readonly<Point2D>, b: Readonly<Point2D>): number => Math.hypot(a.x - b.x, a.y - b.y);
const normDeg = (d: number): number => ((d % 360) + 360) % 360;

/** Επέλεξε από `candidates` την τιμή με τη μικρότερη απόλυτη απόσταση από `target`. */
function nearestValue(target: number, candidates: readonly number[]): number {
  let best = candidates[0];
  let bestD = Math.abs(target - best);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(target - candidates[i]);
    if (d < bestD) { bestD = d; best = candidates[i]; }
  }
  return best;
}

/** `maxRing = radius − clearance` (Q5). `≤0` ⇒ δίσκος πολύ μικρός για δακτυλίους. */
function polarMaxRing(radius: number, clearanceScene: number): number {
  return radius - clearanceScene;
}

/**
 * Οι ακτίνες των ομόκεντρων δακτυλίων ≤ `maxRing` (Q1). Default nice-absolute (πολλαπλάσια του
 * zoom-adaptive `ringStep`)· Shift → κλάσματα ακτίνας. Κενό ⇒ caller skip (πέφτει στο §3.12).
 */
function polarRingRadii(
  maxRing: number,
  ringStep: number,
  useFractions: boolean,
  radius: number,
): number[] {
  if (!(maxRing > 0)) return [];
  if (useFractions) {
    return RADIUS_FRACTIONS.map((f) => f * radius).filter((r) => r > 0 && r <= maxRing);
  }
  if (!(ringStep > 0)) return [maxRing];
  const out: number[] = [];
  for (let k = 1; k * ringStep <= maxRing + 1e-6; k++) out.push(k * ringStep);
  return out.length > 0 ? out : [maxRing];
}

/**
 * Zoom-adaptive γωνιακό βήμα (μοίρες) στον δακτύλιο `ringR` (Q2): μετατρέπει το adaptive arc-length
 * βήμα σε γωνία και το «στρογγυλεύει» σε nice γωνία {5,10,15,30,45,90}. Σταθερό ~25px screen-spacing.
 */
function niceAngleStepDeg(ringR: number, worldPerPixel: number): number {
  const arcStep = adaptiveDistanceStep(worldPerPixel);
  const circumference = 2 * Math.PI * ringR;
  if (!(arcStep > 0) || !(circumference > 0)) return 90;
  const rawDeg = (arcStep / circumference) * 360;
  return nearestValue(rawDeg, NICE_ANGLES_DEG);
}

/** Κεντραρισμένο `GhostFaceFrame` με `arc` → §3.12 arc-length R/θ dims (κέντρο=arc center, R=ringR). */
function buildPolarFaceFrame(center: Readonly<Point2D>, position: Readonly<Point2D>, ringR: number): GhostFaceFrame {
  const rx = (position.x - center.x) / ringR;
  const ry = (position.y - center.y) / ringR;
  const radial: Point2D = { x: rx, y: ry };
  const tangent: Point2D = { x: -ry, y: rx };
  return buildCenteredAxisFaceFrame(
    { x: position.x, y: position.y }, tangent, radial, 0, 0, 0,
    { center: { x: center.x, y: center.y }, radius: ringR, startAngle: 0, endAngle: 360 },
  );
}

/** Center snap result (κανένα dim — degenerate frame χωρίς arc → straight branch επιστρέφει κενό). */
function centerSnap(center: Readonly<Point2D>, distToCenter: number): PolarDiskSnap {
  return {
    position: { x: center.x, y: center.y },
    ringR: 0,
    angleDeg: 0,
    isCenter: true,
    dist: distToCenter,
    faceFrame: buildCenteredAxisFaceFrame({ x: center.x, y: center.y }, { x: 1, y: 0 }, { x: 0, y: 1 }, 0, 0, 0),
  };
}

/**
 * Πολικό snap κολώνας μέσα στον δίσκο: κέντρο (εντός `CENTER_CAPTURE_PX`) ή δακτύλιος ∩ ακτίνα.
 * `null` όταν ο δίσκος είναι πολύ μικρός ή ο cursor είναι **πέρα από το `maxRing`** (κοντά στο χείλος)
 * → ο caller πέφτει στο §3.12 circumference (nearest-wins). Pure. Μονάδες: scene units.
 */
export function resolvePolarDiskSnap(
  cursor: Readonly<Point2D>,
  disk: Readonly<PolarDisk>,
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): PolarDiskSnap | null {
  const f = mmToSceneUnits(sceneUnits);
  const { center, radius } = disk;
  const clearance = opts.clearanceScene ?? POLAR_COVER_MM * f;
  const maxRing = polarMaxRing(radius, clearance);
  if (!(maxRing > 0)) return null;

  const distToCenter = dist2(cursor, center);
  const wpp = opts.worldPerPixel;
  const centerCapture = wpp > 0 ? wpp * CENTER_CAPTURE_PX : 0;
  if (distToCenter <= centerCapture) return centerSnap(center, distToCenter);
  if (distToCenter > maxRing) return null; // κοντά στο χείλος → §3.12 circumference

  const rings = polarRingRadii(maxRing, adaptiveDistanceStep(wpp), !!opts.shiftFractions, radius);
  if (rings.length === 0) return null;
  const ringR = nearestValue(distToCenter, rings);

  const stepDeg = niceAngleStepDeg(ringR, wpp);
  const rawDeg = calculateAngle(center, cursor) * DEG;
  const angleDeg = normDeg(Math.round(rawDeg / stepDeg) * stepDeg);
  const position = pointOnCircle(center, ringR, angleDeg / DEG);
  return {
    position,
    ringR,
    angleDeg,
    isCenter: false,
    dist: dist2(cursor, position),
    faceFrame: buildPolarFaceFrame(center, position, ringR),
  };
}

/**
 * Το ορατό πολικό πλέγμα για τον overlay painter (§3.13 A6): όλοι οι δακτύλιοι ≤ maxRing + οι ακτίνες
 * στην πυκνότητα του **ενεργού** (πλησιέστερου στον cursor) δακτυλίου. `null` όταν ο δίσκος είναι
 * πολύ μικρός. ΙΔΙΟ ring/angle SSoT με το `resolvePolarDiskSnap` (καμία απόκλιση πλέγματος↔snap).
 */
export function buildPolarDiskGrid(
  cursor: Readonly<Point2D>,
  disk: Readonly<PolarDisk>,
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): PolarDiskGrid | null {
  const f = mmToSceneUnits(sceneUnits);
  const { center, radius } = disk;
  const clearance = opts.clearanceScene ?? POLAR_COVER_MM * f;
  const maxRing = polarMaxRing(radius, clearance);
  const rings = polarRingRadii(maxRing, adaptiveDistanceStep(opts.worldPerPixel), !!opts.shiftFractions, radius);
  if (rings.length === 0) return null;

  const distToCenter = dist2(cursor, center);
  const activeRingR = nearestValue(Math.min(distToCenter, maxRing), rings);
  const stepDeg = niceAngleStepDeg(activeRingR, opts.worldPerPixel);
  const spokesDeg: number[] = [];
  for (let a = 0; a < 360 - 1e-6; a += stepDeg) spokesDeg.push(normDeg(a));
  return { center: { x: center.x, y: center.y }, rings, spokesDeg, outerR: rings[rings.length - 1] };
}
