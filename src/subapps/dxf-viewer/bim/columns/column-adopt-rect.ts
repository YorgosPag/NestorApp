/**
 * ADR-398 §3.17 «Rectangle size adoption» — η κολόνα **υιοθετεί** το μέγεθος + κέντρο + γωνία ενός
 * ορθογωνίου της κάτοψης DXF (pure SSoT, opt-in — ο χρήστης αποφασίζει, ADR-487 §8.4 «ΠΟΤΕ σιωπηλά»).
 *
 * Πολλές υπάρχουσες κολόνες σχεδιάζονται ως ορθογώνια (κλειστή polyline/`rectangle` Ή 4 ξεχωριστές
 * γραμμές που κλείνουν). Όταν το εργαλείο «Κολόνα» κάνει 1ο κλικ ΜΕΣΑ σε τέτοιο ορθογώνιο, η εφαρμογή
 * προτείνει να φτιάξει κολόνα στο ίδιο μέγεθος (αντί του default 40×40).
 *
 * **FULL SSoT — μηδέν νέα γεωμετρία:**
 *   · Φάση 1 (rectangle / κλειστή polyline) → `findRectContaining` πάνω στα έτοιμα `rectTargets`.
 *   · Φάση 2 (4 ξεχωριστές γραμμές) → `getCachedRegionPerimeters` (cached closed-loop detection, ΙΔΙΟ
 *     SSoT με «κολώνα από περίγραμμα») + `pickSmallestContainingPerimeter` → `rectFrameFromCorners`.
 *   · διαστάσεις/γωνία ← `RectFrame` (halfW/halfV/u) + `mmToSceneUnits` (scene→mm).
 *
 * Pure: zero React/DOM/store. Μονάδες εισόδου: scene units (RectFrame)· εξόδου: mm + μοίρες.
 *
 * @see ./rect-cartesian-snap.ts — findRectContaining (Φ1 hit) — αδελφό §3.15 Cartesian Magnet
 * @see ../walls/perimeter-from-faces.ts — getCachedRegionPerimeters/pickSmallestContainingPerimeter (Φ2)
 * @see ../framing/rect-frame.ts — RectFrame/rectFrameFromCorners (διαστάσεις + λοξή γωνία)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.17
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { rectFrameFromCorners, type RectFrame } from '../framing/rect-frame';
import { findRectContaining } from './rect-cartesian-snap';
import {
  getCachedRegionPerimeters,
  pickSmallestContainingPerimeter,
} from '../walls/perimeter-from-faces';

/** Διαστάσεις κολόνας (mm) + γωνία (μοίρες CCW) που προκύπτουν από ένα ορθογώνιο. */
export interface AdoptRectDims {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly rotationDeg: number;
}

/** Όρια λογικού μεγέθους δομικού μέλους (mm) — αποτρέπουν υιοθέτηση του περιγράμματος κτιρίου. */
export const ADOPT_MIN_SIZE_MM = 80;
export const ADOPT_MAX_SIZE_MM = 4000; // καλύπτει τοιχία/μεγάλες κολόνες· πιο πάνω = περίγραμμα σχεδίου
/** «Αισθητή διαφορά» (mm) από το default ώστε να ΜΗΝ ενοχλεί όταν το ορθογώνιο ≈ default (π.χ. 40×40). */
export const ADOPT_NOTABLE_DIFF_MM = 20;
/** Μέγιστη απόκλιση από την ορθογωνιότητα (|û·v̂|) — μόνο πραγματικά ορθογώνια υιοθετούνται (≈ ±1.1°). */
const ORTHOGONALITY_TOL = 0.02;

/** `true` αν οι άξονες u/v του frame είναι (περίπου) κάθετοι → πραγματικό ορθογώνιο (όχι παραλληλόγραμμο). */
function isOrthogonalFrame(rect: Readonly<RectFrame>): boolean {
  return Math.abs(rect.u.x * rect.v.x + rect.u.y * rect.v.y) <= ORTHOGONALITY_TOL;
}

/** Κανονικοποίηση μοιρών στο [0, 360). */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * `RectFrame` (scene units) → διαστάσεις κολόνας (mm) + γωνία. Width = κατά τον άξονα `u`, depth = κατά
 * `v` → η κολόνα στρέφεται ώστε το πλάτος της να τρέχει στην ακμή πλάτους του ορθογωνίου (Revit «adopt»).
 */
export function rectFrameToColumnDims(
  rect: Readonly<RectFrame>,
  sceneUnits: SceneUnits,
): AdoptRectDims {
  const scenePerMm = mmToSceneUnits(sceneUnits) || 1; // scene units ανά mm
  return {
    widthMm: (rect.halfW * 2) / scenePerMm,
    depthMm: (rect.halfV * 2) / scenePerMm,
    rotationDeg: normalizeDeg(Math.atan2(rect.u.y, rect.u.x) * (180 / Math.PI)),
  };
}

/**
 * `true` αν αξίζει να προταθεί η υιοθέτηση: το μέγεθος είναι λογικό δομικό μέλος (εντός
 * [MIN, MAX]) **και** διαφέρει αισθητά από αυτό που θα έβγαζε η default ροή (effective defaults).
 * Αλλιώς `false` → ο caller προχωρά αθόρυβα στην κανονική ροή (μηδέν ενόχληση σε ≈default).
 */
export function shouldProposeAdopt(
  dims: Readonly<AdoptRectDims>,
  effectiveDefaults: { readonly width: number; readonly depth: number },
): boolean {
  const { widthMm, depthMm } = dims;
  const within = (v: number): boolean => v >= ADOPT_MIN_SIZE_MM && v <= ADOPT_MAX_SIZE_MM;
  if (!within(widthMm) || !within(depthMm)) return false;
  const diff =
    Math.abs(widthMm - effectiveDefaults.width) > ADOPT_NOTABLE_DIFF_MM ||
    Math.abs(depthMm - effectiveDefaults.depth) > ADOPT_NOTABLE_DIFF_MM;
  return diff;
}

/**
 * Βρες το **υιοθετήσιμο** ορθογώνιο κάτω από το `point` (smallest-containing, πραγματικά ορθογώνιο).
 *   1) Φάση 1 — `rectTargets` (rectangle + κλειστή 4-κορυφη polyline) μέσω `findRectContaining`.
 *   2) Φάση 2 — αν αστόχησε, cached region perimeters (4 ξεχωριστές γραμμές) → 4-κορυφο loop → frame.
 * `null` αν δεν υπάρχει ορθογώνιο ή δεν είναι κάθετο (παραλληλόγραμμο/μη-quad → κανονική ροή).
 */
export function findAdoptableRectUnderPoint(
  point: Readonly<Point2D>,
  rectTargets: readonly RectFrame[],
  entities: readonly Entity[],
  tol: number,
): RectFrame | null {
  // Φάση 1 — έτοιμα ορθογώνια (entity rectangle + κλειστή polyline).
  const direct = findRectContaining(point, rectTargets);
  if (direct && isOrthogonalFrame(direct)) return direct;

  // Φάση 2 — 4 ξεχωριστές γραμμές που κλείνουν ορθογώνιο (reuse cached closed-loop SSoT).
  const perimeters = getCachedRegionPerimeters(entities, tol);
  const pick = pickSmallestContainingPerimeter(point, perimeters);
  if (!pick || pick.polygon.length !== 4) return null;
  const frame = rectFrameFromCorners(pick.polygon);
  return frame && isOrthogonalFrame(frame) ? frame : null;
}
