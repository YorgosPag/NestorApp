/**
 * ADR-619 — `StairParams` builder από ταξινόμηση περιοχής (stair-from-region).
 *
 * Παίρνει το `StairRegionClassification` (stair-region-classifier.ts) και παράγει
 * ΕΓΚΥΡΟ `StairParams`, επαναχρησιμοποιώντας το SSoT `buildDefaultStairParams`
 * (stair-completion.ts) — ΜΗΔΕΝ αναπαραγωγή geometry/defaults εδώ. Το downstream
 * `buildStairEntity` υπολογίζει τη γεωμετρία μέσω `computeStairGeometry`.
 *
 * Ανά kind:
 *   - 'straight'     → buildDefaultStairParams (variant 'straight'), stepCount από run/tread.
 *   - 'lWithWinders' → variant 'l-shape' cornerStyle 'winders' (τεταρτοστροφική).
 *   - 'switchback'   → variant 'u-shape' (ημιστροφική, 180° mid-landing).
 *   - 'spiral'       → variant 'spiral' (κεντρικός κίονας, outerRadius = params.width).
 *
 * ΠΟΤΕ δεν παράγει άκυρο `StairParams` και ΠΟΤΕ δεν κρασάρει: όταν ένα kind δεν
 * μπορεί να παραχθεί με σιγουριά (π.χ. πολύ λίγα σκαλοπάτια για winders/switchback)
 * κάνει fallback σε 'straight' προσαρμοσμένο στο bbox.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import type {
  StairParams,
  StairVariantLShapeWinders,
  StairVariantSpiral,
  StairVariantUShape,
  Point3D,
} from '../../types/stair-types';
import {
  buildDefaultStairParams,
  type StairFloorLinkInput,
} from '../../../hooks/drawing/stair-completion';
import type { SceneUnits } from '../../../utils/scene-units';
import type { Vec2 } from './stair-geometry-shared';
import type { StairRegionClassification } from './stair-region-classifier';

const RAD_TO_DEG = 180 / Math.PI;
const MIN_STEP_COUNT = 3;
/** NOK quarter-turn: 3 winder treads στη γωνία. */
const DEFAULT_WINDER_COUNT = 3;
/** Ελάχιστα σκαλοπάτια για να «χωρέσει» winder τεταρτοστροφική (n1≥1 + 3 + n2≥1). */
const MIN_STEPS_L_WINDERS = DEFAULT_WINDER_COUNT + 2;
/** Ελάχιστα σκαλοπάτια για switchback (n1≥1 + n2≥1, ουσιαστικά ≥4 για δύο κλάδους). */
const MIN_STEPS_SWITCHBACK = 4;
/** Πλήρης στροφή για ελικοειδή. */
const SPIRAL_SWEEP_DEG = 360;

function directionDeg(dir: Vec2): number {
  return Math.atan2(dir.y, dir.x) * RAD_TO_DEG;
}

/** stepCount από το μήκος διαδρομής / βάθος πατήματος (SSoT tread), clamp min. */
function resolveStepCount(run: number, tread: number): number {
  if (!(tread > 0) || !(run > 0)) return MIN_STEP_COUNT;
  return Math.max(MIN_STEP_COUNT, Math.round(run / tread));
}

/**
 * Χτίζει `StairParams` για την περιοχή. `sceneUnits`/`floorLink` περνούν αυτούσια
 * στο `buildDefaultStairParams`.
 */
export function buildStairParamsFromRegion(
  classification: StairRegionClassification,
  sceneUnits: SceneUnits = 'mm',
  floorLink: StairFloorLinkInput | null = null,
): StairParams {
  const dirDeg = directionDeg(classification.direction);
  const width = classification.width > 0 ? classification.width : undefined;

  // Seed default → διαβάζουμε το SSoT default tread (χωρίς hardcoded 280mm).
  const seed = buildDefaultStairParams(
    classification.basePoint,
    dirDeg,
    width !== undefined ? { width } : {},
    sceneUnits,
    floorLink,
  );
  const stepCount = resolveStepCount(classification.run, seed.tread);

  const straight = buildDefaultStairParams(
    classification.basePoint,
    dirDeg,
    { ...(width !== undefined ? { width } : {}), stepCount },
    sceneUnits,
    floorLink,
  );

  switch (classification.kind) {
    case 'straight':
      return straight;
    case 'lWithWinders':
      return buildLWinders(straight);
    case 'switchback':
      return buildSwitchback(straight);
    case 'spiral':
      return buildSpiral(classification, straight);
    default: {
      const _exhaustive: never = classification.kind;
      return straight;
    }
  }
}

// ─── Per-kind variant overrides ───────────────────────────────────────────────

/**
 * L-shape με winders (τεταρτοστροφική). flightSplit `[n1, n2]` ώστε
 * `n1 + winderCount + n2 = stepCount`. Πολύ λίγα σκαλοπάτια → fallback straight.
 */
function buildLWinders(straight: Readonly<StairParams>): StairParams {
  if (straight.stepCount < MIN_STEPS_L_WINDERS) return straight;
  const remaining = straight.stepCount - DEFAULT_WINDER_COUNT;
  const n1 = Math.floor(remaining / 2);
  const n2 = remaining - n1;
  const variant: StairVariantLShapeWinders = {
    kind: 'l-shape',
    cornerStyle: 'winders',
    turnDirection: 'left',
    winderCount: DEFAULT_WINDER_COUNT,
    winderMethod: 'equal-going',
    flightSplit: [n1, n2],
  };
  return { ...straight, variant };
}

/**
 * U-shape (switchback, 180° mid-landing). flightSplit `[n1, n2]` με
 * `n1 + n2 = stepCount`. Πολύ λίγα σκαλοπάτια → fallback straight.
 */
function buildSwitchback(straight: Readonly<StairParams>): StairParams {
  if (straight.stepCount < MIN_STEPS_SWITCHBACK) return straight;
  const n1 = Math.ceil(straight.stepCount / 2);
  const n2 = straight.stepCount - n1;
  const variant: StairVariantUShape = {
    kind: 'u-shape',
    turnDirection: 'left',
    landingDepth: 'auto',
    flightSplit: [n1, n2],
  };
  return { ...straight, variant };
}

/**
 * Spiral (κεντρικός κίονας). `centerPoint` = classification.basePoint (area
 * centroid), outerRadius = `params.width` (ήδη = ακτίνα short/2 από τον
 * classifier). Πλήρης στροφή 360°.
 */
function buildSpiral(
  classification: StairRegionClassification,
  straight: Readonly<StairParams>,
): StairParams {
  const centerPoint: Point3D = {
    x: classification.basePoint.x,
    y: classification.basePoint.y,
    z: straight.basePoint.z,
  };
  const variant: StairVariantSpiral = {
    kind: 'spiral',
    centerPoint,
    innerRadius: 0,
    sweepAngle: SPIRAL_SWEEP_DEG,
    turnDirection: 'ccw',
  };
  return { ...straight, variant };
}
