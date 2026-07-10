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
 * Placement (ADR-526): η γραμμή πορείας ΔΕΝ είναι «η μεγαλύτερη polyline» — ο Τέκτων αποθηκεύει
 * πολλές `<point2d>` ομάδες (πλευρικές ακμές + κέντρο + περίγραμμα), γεμισμένες με sentinel
 * `(0,0)`. Παράγουμε το **κέντρο** ως μέσο όρο των δύο εξωτερικών ακμών· ο variant προκύπτει από
 * το authoritative `landings` (0 ⇒ ευθεία) + τη στροφή της ΚΑΘΑΡΗΣ γραμμής πορείας.
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

/**
 * Ο Τέκτων γεμίζει τις `<point2d>` λίστες με sentinel `(0,0)` μέχρι τη χωρητικότητά τους — ΔΕΝ
 * είναι πραγματικές κορυφές. Χωρίς φιλτράρισμα, το (0,0) «τραβάει» τη γραμμή πορείας προς την
 * αρχή αξόνων → ψεύτικη στροφή (ευθεία σκάλα εμφανίζεται ως winder).
 */
function isSentinel(p: TekPoint2D): boolean {
  return p.x === 0 && p.y === 0;
}

/** Αφαιρεί outlier κορυφές (labels/anchors π.χ. (−11.9, 2.07)) μακριά από τον διάμεσο. */
function dropOutliers(pl: readonly TekPoint2D[]): TekPoint2D[] {
  if (pl.length === 0) return [];
  const cx = median(pl.map((p) => p.x));
  const cy = median(pl.map((p) => p.y));
  return pl.filter((p) => Math.hypot(p.x - cx, p.y - cy) <= OUTLIER_DISTANCE_M);
}

/** Καθαρισμός polyline: αφαιρεί sentinels `(0,0)` + outlier κορυφές (labels/anchors). */
function cleanPolyline(pl: readonly TekPoint2D[]): TekPoint2D[] {
  return dropOutliers(pl.filter((p) => !isSentinel(p)));
}

/** Κεντροειδές μιας polyline (scene coords). */
function centroidOf(pl: readonly Point2D[]): Point2D {
  const s = pl.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pl.length, y: s.y / pl.length };
}

/** Κρατά μόνο τις πιο λεπτομερείς polylines (μέγιστο πλήθος σημείων) — οι ακμές ανά βαθμίδα. */
function mostDetailed(polys: readonly Point2D[][]): Point2D[][] {
  const maxLen = polys.reduce((m, p) => Math.max(m, p.length), 0);
  return polys.filter((p) => p.length === maxLen);
}

/** Οι δύο πλευρικές ακμές = ζεύγος με μέγιστη απόσταση κεντροειδών (τα εξωτερικά «κάγκελα»). */
function pickRails(polys: readonly Point2D[][]): readonly [Point2D[], Point2D[]] | null {
  if (polys.length < 2) return null;
  let best: [Point2D[], Point2D[]] | null = null;
  let bestDist = -1;
  for (let i = 0; i < polys.length; i += 1) {
    for (let j = i + 1; j < polys.length; j += 1) {
      const ci = centroidOf(polys[i]);
      const cj = centroidOf(polys[j]);
      const d = Math.hypot(ci.x - cj.x, ci.y - cj.y);
      if (d > bestDist) { bestDist = d; best = [polys[i], polys[j]]; }
    }
  }
  return best;
}

/** Μέσος όρος δύο ακμών (ευθυγραμμισμένων στην ίδια φορά) → γραμμή πορείας (κέντρο). */
function averageRails(a: readonly Point2D[], b: readonly Point2D[]): Point2D[] {
  const flip = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y)
    > Math.hypot(a[0].x - b[b.length - 1].x, a[0].y - b[b.length - 1].y);
  const bb = flip ? [...b].reverse() : b;
  const n = Math.min(a.length, bb.length);
  const out: Point2D[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ x: (a[i].x + bb[i].x) / 2, y: (a[i].y + bb[i].y) / 2 });
  }
  return out;
}

/**
 * Γραμμή πορείας (κέντρο) από τις καθαρισμένες polylines σε scene coords: μέσος όρος των δύο
 * εξωτερικών ακμών (διατηρεί τυχόν καμπυλότητα για winder). Fallback → η μεγαλύτερη polyline.
 */
function deriveCenterline(scenePolys: readonly Point2D[][]): Point2D[] {
  const nonEmpty = scenePolys.filter((p) => p.length > 0);
  if (nonEmpty.length === 0) return [];
  const rails = pickRails(mostDetailed(nonEmpty));
  if (rails) return averageRails(rails[0], rails[1]);
  return nonEmpty.reduce((a, b) => (b.length > a.length ? b : a), nonEmpty[0]);
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

/**
 * Επιλέγει variant (ευθεία ή winder). Πρωταρχικό σήμα το authoritative `landings` του Τέκτονα
 * (0 = χωρίς πλατύσκαλο ⇒ υποψήφια ευθεία)· επιβεβαίωση από τη στροφή της ΚΑΘΑΡΗΣ γραμμής
 * πορείας. Έτσι μια ευθεία σκάλα δεν κατατάσσεται λανθασμένα ως winder λόγω θορύβου γεωμετρίας.
 */
function resolveVariant(
  turnDeg: number, stepCount: number, landings: number,
): StairVariantParams {
  if (landings === 0 && Math.abs(turnDeg) < TURN_THRESHOLD_DEG) return { kind: 'straight' };
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
  const scenePolys = rec.polylines.map(
    (pl) => cleanPolyline(pl).map((p) => tekToScene(p, sceneUnits)),
  );
  const centerline = deriveCenterline(scenePolys);
  const placement = derivePlacement(centerline);
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
  const variant = resolveVariant(placement.turnDeg, stepCount, rec.landings);
  const params: StairParams = {
    ...base,
    variant,
    ...(rec.waistThicknessM > 0 ? { waistThickness: rec.waistThicknessM * 1000 } : {}),
  };
  // preserve-and-replay (ADR-526 Φ3): κρατάμε το αυθεντικό Tekton record πάνω στο entity ώστε
  // το export να το εκπέμψει αυτούσιο (byte-faithful round-trip, ακριβή Tekton σύμβολα).
  return { ...buildStairEntity(params, levelId), sourceTekRecord: rec.rawXml };
}
