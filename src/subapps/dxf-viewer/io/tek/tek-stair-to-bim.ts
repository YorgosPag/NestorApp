/**
 * ADR-526 (Tekton .TEK IMPORT) — mapper `TekStairRecord` → `StairEntity` (pure).
 *
 * Αντιστρέφει τις μετατροπές του export (`tek-geometry.ts`):
 *   - **Μονάδες:** Τέκτων = μέτρα → scene units μέσω του SSoT `mmToSceneUnits` (μέτρα→mm→scene).
 *   - **Y-flip:** Τέκτων Y «προς τα πάνω» → καμβάς Y «προς τα κάτω» ⇒ `canvasY = −tektonY`
 *     (ακριβώς ο αντίστροφος της `buildXMatrix` Y-negation).
 *
 * Reuse: `buildDefaultStairParams` + `buildStairEntity` (SSoT factory) — μηδέν re-impl των
 * StairParams defaults/geometry. Εδώ μένει ΜΟΝΟ η Tekton-specific παραγωγή
 * basePoint/direction/variant από τη γεωμετρία και τα scalar πεδία.
 *
 * Φ1 (stair-first): η παραμετρική σκάλα τοποθετείται σωστά (θέση/κλίμακα/βαθμίδες/ύψος).
 * Η ΑΚΡΙΒΗΣ αναπαραγωγή ελικοειδούς footprint (pixel-perfect) είναι επόμενη φάση —
 * εδώ η winder γωνία/πλήθος προκύπτουν ευρετικά από τη γραμμή πορείας.
 */

import { type SceneUnits } from '../../utils/scene-units';
import { metersToScene, tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { median } from '../../utils/statistics';
import { angleBetweenPointsDeg } from '../../utils/rotation-math';
import {
  normalizeAngleDiff, degToRad, radToDeg,
} from '../../rendering/entities/shared/geometry-angle-utils';
import {
  buildDefaultStairParams, buildStairEntity, type StairParamOverrides,
} from '../../hooks/drawing/stair-completion';
import type { StairEntity, StairParams, StairVariantParams } from '../../bim/types/stair-types';
import type { Point2D } from '../../rendering/types/Types';
import type { TekPoint2D, TekStairRecord } from './tek-import-types';

/** Σημεία μακριά > τόσα μέτρα από τον διάμεσο θεωρούνται outliers (labels/anchors). */
const OUTLIER_DISTANCE_M = 20;
/** Κάτω από αυτή τη γωνία στροφής (μοίρες) ⇒ ευθεία σκάλα, αλλιώς winder. */
const TURN_THRESHOLD_DEG = 20;
/** Τυπική γωνία ανά ελικοειδή βαθμίδα (μοίρες) για εκτίμηση winderCount. */
const DEG_PER_WINDER = 30;

/** Τέκτων point (μέτρα, Y-up) → καμβά point (scene units, Y-down) μέσω του tek SSoT. */
function tekToScene(p: TekPoint2D, units: SceneUnits): Point2D {
  return tekMetersToScene(p.x, p.y, units);
}

/** Αφαιρεί outlier κορυφές (labels/anchors π.χ. (−11.9, 2.07)) μακριά από τον διάμεσο. */
function dropOutliers(pl: readonly TekPoint2D[]): TekPoint2D[] {
  if (pl.length === 0) return [];
  const cx = median(pl.map((p) => p.x));
  const cy = median(pl.map((p) => p.y));
  return pl.filter((p) => Math.hypot(p.x - cx, p.y - cy) <= OUTLIER_DISTANCE_M);
}

/** Επιλέγει τη γραμμή πορείας: τη μεγαλύτερη (σε κορυφές) πολυγραμμή μετά τον καθαρισμό. */
function pickWalkline(polylines: readonly (readonly TekPoint2D[])[]): TekPoint2D[] {
  let best: TekPoint2D[] = [];
  for (const pl of polylines) {
    const clean = dropOutliers(pl);
    if (clean.length > best.length) best = clean;
  }
  return best;
}

interface StairPlacement {
  readonly basePoint: Point2D;
  readonly directionDeg: number;
  readonly turnDeg: number;
}

/**
 * Παράγει basePoint + αρχική κατεύθυνση + συνολική στροφή από τη γραμμή πορείας
 * (ήδη σε scene/canvas frame). Η στροφή = heading τελευταίου − πρώτου τμήματος.
 */
function derivePlacement(walklineScene: readonly Point2D[]): StairPlacement {
  const n = walklineScene.length;
  if (n < 2) {
    const p = walklineScene[0] ?? { x: 0, y: 0 };
    return { basePoint: p, directionDeg: 0, turnDeg: 0 };
  }
  const directionDeg = angleBetweenPointsDeg(walklineScene[0], walklineScene[1]);
  const endHeading = angleBetweenPointsDeg(walklineScene[n - 2], walklineScene[n - 1]);
  // Signed στροφή (−180,180] μέσω του SSoT normalizeAngleDiff (rad-domain).
  const turnDeg = radToDeg(normalizeAngleDiff(degToRad(endHeading - directionDeg)));
  return { basePoint: walklineScene[0], directionDeg, turnDeg };
}

/** Επιλέγει variant (ευθεία ή winder) + παραμέτρους στροφής από τη γεωμετρία. */
function resolveVariant(turnDeg: number, stepCount: number): StairVariantParams {
  if (Math.abs(turnDeg) < TURN_THRESHOLD_DEG) return { kind: 'straight' };
  const winderCount = Math.max(
    1,
    Math.min(stepCount - 1, Math.round(Math.abs(turnDeg) / DEG_PER_WINDER)),
  );
  return {
    kind: 'winder',
    turnAngle: turnDeg, // canvas frame: θετικό = CCW
    winderCount,
    winderMethod: 'equal-going',
  };
}

/**
 * Πλήθος βαθμίδων από το κατακόρυφο προφίλ: `round(ΔΥψος / ρίχτι)` (πιο αξιόπιστο από το
 * Tekton `<steps>`, που μετρά πατήματα — διαφέρει κατά 1 από τα ρίχτια). Fallback στο `<steps>`.
 */
function resolveStepCount(rec: TekStairRecord): number {
  const rise = Math.abs(rec.endElevationM - rec.startElevationM);
  if (rec.riserHeightM > 1e-6 && rise > 1e-6) {
    return Math.max(1, Math.round(rise / rec.riserHeightM));
  }
  return Math.max(1, rec.steps);
}

/**
 * Map ενός `TekStairRecord` → `StairEntity`, τοποθετημένου στο σωστό σημείο/κλίμακα.
 *
 * Διατηρεί ΑΚΡΙΒΩΣ το ύψος ορόφου: `rise = ΔΥψος / stepCount` (ώστε `totalRise === ΔΥψος`),
 * με `stepCount` από το ρίχτι του Τέκτονα. Πάτημα/πλάτος αυτούσια από `horiz_b`/`stair_width`.
 */
export function tekStairToEntity(
  rec: TekStairRecord,
  levelId: string,
  sceneUnits: SceneUnits = 'mm',
): StairEntity {
  const walkline = pickWalkline(rec.polylines).map((p) => tekToScene(p, sceneUnits));
  const placement = derivePlacement(walkline);
  const stepCount = resolveStepCount(rec);
  const totalRiseScene = metersToScene(Math.abs(rec.endElevationM - rec.startElevationM), sceneUnits);
  const overrides: StairParamOverrides = {
    rise: totalRiseScene / stepCount,
    tread: metersToScene(rec.treadGoingM, sceneUnits),
    width: metersToScene(rec.stairWidthM, sceneUnits),
    stepCount,
  };
  const base: StairParams = buildDefaultStairParams(
    placement.basePoint, placement.directionDeg, overrides, sceneUnits,
  );
  const variant = resolveVariant(placement.turnDeg, stepCount);
  const params: StairParams = {
    ...base,
    variant,
    ...(rec.waistThicknessM > 0 ? { waistThickness: rec.waistThicknessM * 1000 } : {}),
  };
  return buildStairEntity(params, levelId);
}
