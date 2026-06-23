/**
 * ADR-398 §3.17 «Rectangle size adoption» — η κολόνα **υιοθετεί** το μέγεθος + κέντρο + γωνία ενός
 * ορθογωνίου της κάτοψης DXF (pure SSoT, opt-in — ο χρήστης αποφασίζει, ADR-487 §8.4 «ΠΟΤΕ σιωπηλά»).
 *
 * Πολλές υπάρχουσες κολόνες σχεδιάζονται ως ορθογώνια (κλειστή polyline/`rectangle` Ή 4 ξεχωριστές
 * γραμμές που κλείνουν). Όταν το εργαλείο «Κολόνα» κάνει 1ο κλικ ΜΕΣΑ σε τέτοιο ορθογώνιο, η εφαρμογή
 * προτείνει να φτιάξει το στοιχείο στο ίδιο μέγεθος (αντί του default 40×40).
 *
 * **EC2 §9.6.1 / EC8 §5.4.2.4 ταξινόμηση (Giorgio):** το `rectColumnPlacement` (κοινό SSoT με «κολόνα
 * από περιοχή») ορίζει αυτόματα τον τύπο από την αναλογία πλευρών — αναλογία **≤ 4 = κολόνα**,
 * **> 4 = ΤΟΙΧΙΟ** (shear-wall). Έτσι ένα 0,20×2,50 m (12,5:1) γίνεται τοιχίο, ΟΧΙ ορθογωνική κολόνα.
 *
 * **FULL SSoT — μηδέν νέα γεωμετρία:**
 *   · Φάση 1 (rectangle / κλειστή polyline) → `findRectContaining` πάνω στα έτοιμα `rectTargets`.
 *   · Φάση 2 (4 ξεχωριστές γραμμές) → `findRectanglesFromSegments` (corner-graph detector, ΙΔΙΟ SSoT με
 *     «κολόνα/τοίχος σε περιοχή») → πιάνει ορθογώνια ΑΚΟΜΑ και με **κοινές γωνίες** (οι γωνίες της κολόνας
 *     μοιράζονται κορυφές με τοίχους → ο απλός κύκλος-walker θα τις έχανε).
 *   · μέγεθος/γωνία/τύπος ← `rectColumnPlacement` (longSide/shortSide/aspect-kind) + `mmToSceneUnits`.
 *
 * Pure: zero React/DOM/store. Μονάδες εισόδου: scene units· εξόδου: mm + μοίρες.
 *
 * @see ./rect-cartesian-snap.ts — findRectContaining (Φ1 hit) — αδελφό §3.15 Cartesian Magnet
 * @see ../walls/wall-in-region.ts — extractLineSegments/findRectanglesFromSegments/DetectedRectangle (Φ2)
 * @see ./column-from-faces.ts — rectColumnPlacement/isWallColumnKind (EC2 aspect→kind SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.17
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnKind } from '../types/column-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import { rectFrameFromCorners, rectLocalToWorld, type RectFrame } from '../framing/rect-frame';
import { findRectContaining } from './rect-cartesian-snap';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  type DetectedRectangle,
} from '../walls/wall-in-region';
import { rectColumnPlacement, isWallColumnKind } from './column-from-faces';

/** Πρόταση υιοθέτησης: θέση + μέγεθος (mm) + γωνία + τύπος (κολόνα/τοιχίο κατά EC2). */
export interface AdoptProposal {
  readonly center: Point2D;
  /** mm — η μεγάλη πλευρά (longSide). */
  readonly widthMm: number;
  /** mm — η μικρή πλευρά (shortSide). */
  readonly depthMm: number;
  readonly rotationDeg: number;
  readonly kind: ColumnKind;
  /** `true` αν αναλογία > 4 → τοιχίο (shear-wall), αλλιώς κολόνα. */
  readonly isShearWall: boolean;
}

/** Ελάχιστο λογικό μέγεθος δομικού μέλους (mm). */
export const ADOPT_MIN_SIZE_MM = 80;
/** «Αισθητή διαφορά» (mm) από το default ώστε να ΜΗΝ ενοχλεί όταν το ορθογώνιο ≈ default (π.χ. 40×40). */
export const ADOPT_NOTABLE_DIFF_MM = 20;
/** Μέγιστη απόκλιση από την ορθογωνιότητα (|û·v̂|) — μόνο πραγματικά ορθογώνια υιοθετούνται (≈ ±1.1°). */
const ORTHOGONALITY_TOL = 0.02;

/** `true` αν οι άξονες u/v του frame είναι (περίπου) κάθετοι → πραγματικό ορθογώνιο (όχι παραλληλόγραμμο). */
function isOrthogonalFrame(rect: Readonly<RectFrame>): boolean {
  return Math.abs(rect.u.x * rect.v.x + rect.u.y * rect.v.y) <= ORTHOGONALITY_TOL;
}

/**
 * `true` αν το `p` είναι ΜΕΣΑ στο frame **ή πάνω στο όριό του** (±tol). **Κρίσιμο:** το face-snap ρίχνει
 * το κλικ ΑΚΡΙΒΩΣ πάνω στην ακμή του ορθογωνίου → το strict `isPointInPolygon` θα το απέρριπτε ως «εκτός».
 * Boundary-inclusive (local u/v projection, ίδιο μοντέλο με `findRectContaining`/`resolveRectCartesianSnap`).
 */
function frameContainsWithTol(rect: Readonly<RectFrame>, p: Readonly<Point2D>, tol: number): boolean {
  const dx = p.x - rect.center.x;
  const dy = p.y - rect.center.y;
  const lx = Math.abs(dx * rect.u.x + dy * rect.u.y);
  const ly = Math.abs(dx * rect.v.x + dy * rect.v.y);
  return lx <= rect.halfW + tol && ly <= rect.halfV + tol;
}

/** `RectFrame` (scene units) → `DetectedRectangle` (polygon + longSide/shortSide/area) — ΕΝΑ κοινό σχήμα
 *  ώστε Φ1 και Φ2 να τροφοδοτούν το ΙΔΙΟ `rectColumnPlacement` (aspect→kind). */
function frameToDetectedRect(f: Readonly<RectFrame>): DetectedRectangle {
  const w = f.halfW * 2;
  const h = f.halfV * 2;
  const polygon: [Point2D, Point2D, Point2D, Point2D] = [
    rectLocalToWorld(f, -f.halfW, -f.halfV),
    rectLocalToWorld(f, f.halfW, -f.halfV),
    rectLocalToWorld(f, f.halfW, f.halfV),
    rectLocalToWorld(f, -f.halfW, f.halfV),
  ];
  return { polygon, longSide: Math.max(w, h), shortSide: Math.min(w, h), area: w * h };
}

/**
 * `DetectedRectangle` (scene units) → πρόταση υιοθέτησης (mm + γωνία + τύπος). Reuse ΑΚΡΙΒΩΣ το
 * `rectColumnPlacement` SSoT (center + width=longSide + depth=shortSide + rotation=γωνία μεγάλης ακμής +
 * kind κατά EC2 §9.6.1 aspect) → ταυτόσημη ταξινόμηση με «κολόνα από περιοχή».
 */
export function resolveAdoptProposal(
  rect: Readonly<DetectedRectangle>,
  sceneUnits: SceneUnits,
): AdoptProposal {
  const placement = rectColumnPlacement(rect, mmToSceneUnits(sceneUnits) || 1);
  const kind = placement.overrides.kind ?? 'rectangular';
  return {
    center: placement.center,
    widthMm: placement.overrides.width ?? 0,
    depthMm: placement.overrides.depth ?? 0,
    rotationDeg: placement.overrides.rotation ?? 0,
    kind,
    isShearWall: isWallColumnKind(kind),
  };
}

/**
 * `true` αν αξίζει να προταθεί η υιοθέτηση: το μέγεθος είναι λογικό δομικό μέλος (μικρή πλευρά εντός
 * [MIN, MAX_THICKNESS] — η μεγάλη πλευρά μένει ελεύθερη ώστε να καλύπτει μακριά τοιχία) **και** διαφέρει
 * αισθητά από αυτό που θα έβγαζε η default ροή. Αλλιώς `false` → αθόρυβη κανονική ροή.
 */
export function shouldProposeAdopt(
  proposal: Pick<AdoptProposal, 'widthMm' | 'depthMm'>,
  effectiveDefaults: { readonly width: number; readonly depth: number },
): boolean {
  const short = Math.min(proposal.widthMm, proposal.depthMm);
  const long = Math.max(proposal.widthMm, proposal.depthMm);
  // Guard: η μικρή πλευρά (πάχος) μέσα σε λογικό μέλος → κόβει το περίγραμμα κτιρίου (τεράστιο πάχος).
  if (short < ADOPT_MIN_SIZE_MM || short > REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM) return false;
  if (long < ADOPT_MIN_SIZE_MM) return false;
  return (
    Math.abs(proposal.widthMm - effectiveDefaults.width) > ADOPT_NOTABLE_DIFF_MM ||
    Math.abs(proposal.depthMm - effectiveDefaults.depth) > ADOPT_NOTABLE_DIFF_MM
  );
}

/**
 * Βρες το **υιοθετήσιμο** ορθογώνιο κάτω από το `point` (smallest-containing, πραγματικά ορθογώνιο) ως
 * `DetectedRectangle`.
 *   1) Φάση 1 — `rectTargets` (rectangle + κλειστή 4-κορυφη polyline) μέσω `findRectContaining`.
 *   2) Φάση 2 — αν αστόχησε, `findRectanglesFromSegments` (4 ξεχωριστές γραμμές, corner-graph).
 * `null` αν δεν υπάρχει ορθογώνιο ή δεν είναι κάθετο (παραλληλόγραμμο/μη-quad → κανονική ροή).
 */
export function findAdoptableRectUnderPoint(
  point: Readonly<Point2D>,
  rectTargets: readonly RectFrame[],
  entities: readonly Entity[],
  tol: number,
): DetectedRectangle | null {
  // Φάση 1 — έτοιμα ορθογώνια (entity rectangle + κλειστή polyline).
  const direct = findRectContaining(point, rectTargets);
  if (direct && isOrthogonalFrame(direct)) return frameToDetectedRect(direct);

  // Φάση 2 — 4 ξεχωριστές γραμμές που κλείνουν ορθογώνιο. `findRectanglesFromSegments` (corner-graph)
  // πιάνει ορθογώνια ΑΚΟΜΑ και όταν οι γωνίες μοιράζονται κορυφές με τοίχους (όπου ο simple-cycle walker
  // αποτυγχάνει). Διαλέγουμε το **ΜΙΚΡΟΤΕΡΟ** που περιέχει το σημείο (η κολόνα, όχι το δωμάτιο), με
  // **boundary-inclusive** containment (το snapped κλικ πέφτει πάνω στην ακμή· βλ. `frameContainsWithTol`).
  let best: DetectedRectangle | null = null;
  let bestArea = Infinity;
  for (const r of findRectanglesFromSegments(extractLineSegments(entities), tol)) {
    const frame = rectFrameFromCorners(r.polygon);
    if (!frame || !isOrthogonalFrame(frame)) continue;
    if (!frameContainsWithTol(frame, point, tol)) continue;
    if (r.area < bestArea) { bestArea = r.area; best = r; }
  }
  return best;
}
