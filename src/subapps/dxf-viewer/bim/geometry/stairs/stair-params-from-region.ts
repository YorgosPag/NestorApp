/**
 * ADR-619 v2 — `StairParams` builder από τη walkline της περιοχής (STEP 3+5).
 *
 * Παίρνει το `StairRegionClassification` (walkline + πλάτος + βάση) και παράγει
 * ΕΓΚΥΡΟ walkline-driven `StairParams` (variant `'sketch'`), επαναχρησιμοποιώντας
 * το SSoT `buildDefaultStairParams` ως seed (rise/tread/width/handrails/…) — ΜΗΔΕΝ
 * αναπαραγωγή geometry/defaults. Το downstream `computeStairGeometry` (variant
 * `'sketch'` → `computeWalklineStair`) υπολογίζει treads/risers/stringers.
 *
 * FIT CHECK (STEP 3, Google-level, ΠΟΤΕ throw):
 *   - H = ύψος ορόφου (floorLink / default 3000mm)· r = default riser.
 *   - N_risers = round(H/r)· r_actual = H/N_risers· N_goings = N_risers − 1.
 *   - required = N_goings × going_default.
 *   - required ≤ L → going_effective = going_default (χωράει).
 *   - required > L → COMPRESS: going_effective = L / N_goings (+warning) ώστε ΟΛΑ
 *     τα πατήματα να χωρέσουν στο διαθέσιμο μήκος (επιλογή Giorgio: πυκνότερο πάτημα).
 *
 * MAP (STEP 5): stepCount = N_goings (⇒ walklinePath.length = N_goings+1 = N_risers,
 * όσο απαιτεί το sketch variant)· rise = r_actual· tread = going_effective·
 * width = **type default** (`seed.width`, SSoT «Κεντρικό Κλιμακοστάσιο» = 1200mm) —
 * ΑΠΟΣΥΝΔΕΔΕΜΕΝΟ από το μετρημένο πλάτος διαδρόμου (Revit-style type parameter: ο
 * διάδρομος περιορίζει, δεν ΟΡΙΖΕΙ το πλάτος· η σκάλα κεντράρεται στη walkline)·
 * basePoint/direction από τη βάση. Η walkline δειγματοληπτείται σε ίσα τόξα-μήκη
 * (arc sampling μέσα στα winder τόξα). Δεν κρατάμε floor-link ώστε το
 * `reconcileLinkedStair` να ΜΗΝ ξαναϋπολογίσει το stepCount (θα έσπαγε το invariant).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import type {
  StairParams,
  StairVariantSketch,
} from '../../types/stair-types';
import {
  buildDefaultStairParams,
  type StairFloorLinkInput,
} from '../../../hooks/drawing/stair-completion';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';
import type { Vec2 } from './stair-geometry-shared';
import type { StairRegionClassification } from './stair-region-classifier';
import { buildSerialFillWalklinePath, flightLength } from './stair-region-fill';

const RAD_TO_DEG = 180 / Math.PI;
/** Default ύψος ορόφου όταν λείπει floor link (mm). */
const DEFAULT_FLOOR_HEIGHT_MM = 3000;

export const WARNING_GOING_COMPRESSED = 'going-compressed';

// ─── Fit check (STEP 3) ───────────────────────────────────────────────────────

/** Αποτέλεσμα ελέγχου «χωράει η σκάλα;» — όλα σε scene units. */
export interface WalklineStairFit {
  readonly nRisers: number;
  readonly nGoings: number;
  readonly riseActual: number;
  readonly goingEffective: number;
  /** Μήκος walkline που καταλαμβάνει η σκάλα (≤ L). */
  readonly occupiedLength: number;
  readonly compressed: boolean;
  readonly warnings: readonly string[];
}

/**
 * Έλεγχος fit + (αν χρειάζεται) συμπίεση πατήματος. Καθαρή, ντετερμινιστική, ΠΟΤΕ
 * throw. `walklineLength`,`floorHeight`,`targetRise`,`goingDefault` σε scene units.
 */
export function computeWalklineStairFit(
  walklineLength: number,
  floorHeight: number,
  targetRise: number,
  goingDefault: number,
): WalklineStairFit {
  const H = floorHeight > 0 ? floorHeight : DEFAULT_FLOOR_HEIGHT_MM;
  const r = targetRise > 0 ? targetRise : H;
  const nRisers = Math.max(2, Math.round(H / r));
  const riseActual = H / nRisers;
  const nGoings = Math.max(1, nRisers - 1);
  const required = nGoings * goingDefault;
  const L = walklineLength > 0 ? walklineLength : 0;
  const fits = L <= 0 ? true : required <= L;
  const goingEffective = fits || L <= 0 ? goingDefault : L / nGoings;
  const occupiedLength = Math.min(nGoings * goingEffective, L > 0 ? L : nGoings * goingEffective);
  return {
    nRisers,
    nGoings,
    riseActual,
    goingEffective,
    occupiedLength,
    compressed: !fits && L > 0,
    warnings: !fits && L > 0 ? [WARNING_GOING_COMPRESSED] : [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function directionDeg(dir: Vec2): number {
  return Math.atan2(dir.y, dir.x) * RAD_TO_DEG;
}

/** Ύψος ορόφου (scene units) από floor link (μέτρα → mm → scene) ή default. */
function resolveFloorHeight(floorLink: StairFloorLinkInput | null, s: number): number {
  const mm = floorLink && typeof floorLink.height === 'number' && floorLink.height > 0
    ? floorLink.height * 1000
    : DEFAULT_FLOOR_HEIGHT_MM;
  return mm * s;
}

// ─── Public builder (STEP 5) ──────────────────────────────────────────────────

/**
 * Χτίζει walkline-driven (variant `'sketch'`) `StairParams` για την περιοχή.
 * `sceneUnits` περνά στο seed· `floorLink` δίνει ΜΟΝΟ το ύψος ορόφου (δεν κρατιέται
 * ως link στα τελικά params — βλ. module doc).
 */
export function buildStairParamsFromRegion(
  classification: StairRegionClassification,
  sceneUnits: SceneUnits = 'mm',
  floorLink: StairFloorLinkInput | null = null,
): StairParams {
  const s = mmToSceneUnits(sceneUnits);
  const dirDeg = directionDeg(classification.direction);
  // Seed defaults (rise/tread/width/handrails…) — ΧΩΡΙΣ floor link ώστε το seed να
  // ΜΗΝ φέρει multiStoryConfig (reconcile θα ξαναϋπολόγιζε το stepCount).
  const seed = buildDefaultStairParams(classification.basePoint, dirDeg, {}, sceneUnits, null);

  const floorHeight = resolveFloorHeight(floorLink, s);
  // Fit στο ΑΘΡΟΙΣΜΑ ΜΗΚΩΝ ΤΩΝ ΚΛΑΔΩΝ (ευθείες), όχι στο συνολικό μήκος walkline: τα
  // πατήματα κάθονται ΜΟΝΟ στους κλάδους — τα τόξα (στροφές) γίνονται πλατύσκαλα. Έτσι
  // η συμπίεση πατήματος ενεργοποιείται μόνο όταν οι ΚΛΑΔΟΙ δεν χωρούν τα πατήματα.
  const flights = flightLength(classification.walkline);
  const fit = computeWalklineStairFit(flights, floorHeight, seed.rise, seed.tread);
  // Πλάτος = type default (SSoT «Κεντρικό Κλιμακοστάσιο», 1200mm scene-scaled) — ΠΟΤΕ το
  // μετρημένο `classification.width`. Ο διάδρομος περιορίζει (warning `below-min-width`
  // όταν στενότερος), δεν ΟΡΙΖΕΙ το πλάτος (Revit-style type parameter). Η σκάλα
  // κεντράρεται στη walkline. `seed.width` προέρχεται από `DEFAULT_WIDTH_MM` (SSoT).
  const width = seed.width;

  const z = seed.basePoint.z;
  // ΣΕΙΡΙΑΚΟ γέμισμα από τη βάση: πατήματα (goingEffective) στους κλάδους + επίπεδα
  // πλατύσκαλα στις στροφές (μεικτά z). `preserveZ` ⇒ το computeSketch δεν ξαναγράφει z.
  const walklinePath = buildSerialFillWalklinePath(
    classification.walkline, fit.goingEffective, fit.riseActual, fit.nGoings, z,
  );
  const variant: StairVariantSketch = { kind: 'sketch', walklinePath, preserveZ: true };

  return {
    ...seed,
    basePoint: { x: classification.basePoint.x, y: classification.basePoint.y, z },
    direction: dirDeg,
    rise: fit.riseActual,
    tread: fit.goingEffective,
    width,
    // stepCount = ζεύγη walklinePath (πατήματα + πλατύσκαλα)· κρατά το invariant του
    // sketch variant (`walklinePath.length === stepCount + 1`).
    stepCount: Math.max(1, walklinePath.length - 1),
    totalRise: fit.riseActual * fit.nRisers,
    totalRun: fit.goingEffective * fit.nGoings,
    pitch: Math.atan2(fit.riseActual, fit.goingEffective) * RAD_TO_DEG,
    variant,
  };
}
