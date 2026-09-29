/**
 * @fileoverview **Η ΑΝΙΧΝΕΥΣΗ ΕΝΟΣ ΧΩΡΟΥ ΜΕ ΕΝΑ ΚΛΙΚ** (ADR-884 §4.14 Γ3 · §12 Δ8.1–Δ8.2). Καθαρό — ο ίδιος κώδικας τρέχει
 * στον Web Worker του επεξεργαστή σήμερα και στον διακομιστή / σε κάτοψη DXF αύριο.
 * @module lib/spatial-tour/space-detect/space-detect
 *
 * Ροή: μελάνι (Otsu) → τοίχοι (άνοιγμα + νοητές γραμμές) → χώρος (πυρήνες χωρίς πόρτες + ανταγωνιστική αναγέννηση) →
 * φρουροί (διαρροή · πολύ μικρό) → περίγραμμα (Moore → Douglas–Peucker → ορθογώνια έλξη) → πρόταση διαχωρισμού
 * αν ο ίδιος ενιαίος χώρος περιέχει κι άλλο σημείο λήψης.
 *
 * 🔒 **Πάντα ΠΡΟΤΑΣΗ, ποτέ δημοσίευση** (Δ8.1): εδώ δεν γράφεται τίποτα· ο άνθρωπος εγκρίνει στον επεξεργαστή.
 * 🔁 **Δεύτερη προσπάθεια**: αν με το άνοιγμα (που σβήνει λεπτές γραμμές) ο χώρος διαρρέει, η κάτοψη είναι σχεδιασμένη
 * με λεπτές γραμμές ⇒ ξανά χωρίς άνοιγμα. Η σειρά μετρά: με άνοιγμα πρώτα, τα κείμενα μέσα στο δωμάτιο δεν «τσιμπούν»
 * το περίγραμμα.
 */

import { simplifyClosedRing } from '@/lib/geometry/douglas-peucker';
import { dominantAxis, DEFAULT_ORTHOGONAL_SNAP, snapRingOrthogonal } from '@/lib/geometry/orthogonal-snap';
import { polygonArea } from '@/lib/geometry/planar-polygon';
import { traceOuterContour } from '@/lib/geometry/raster/moore-contour';
import type { PixelPoint } from '@/lib/geometry/scale-calibration';

import { suggestSeparation } from './separation-suggest';
import {
  DEFAULT_SPACE_DETECT,
  type PlanRaster,
  type PreparedPlanRaster,
  type SeparationSuggestion,
  type SpaceDetectInput,
  type SpaceDetectOptions,
  type SpaceDetectQuery,
  type SpaceDetectResult,
} from './space-detect-types';
import { segmentSpace } from './space-region';
import { inkMask, wallMask } from './wall-mask';

/** Μισό pixel: το ίχνος Moore περνά από κέντρα pixel, η παρειά του τοίχου είναι στην ακμή τους. */
const PIXEL_CENTRE_OUTSET = 0.5;
/**
 * Κλίμακες της πόρτας κατά σειρά: πρώτα η πραγματική· αν ο χώρος είναι στενότερος (ντουλάπι, στενός διάδρομος —
 * η διάβρωση δεν αφήνει πυρήνα), μισή και τέταρτο. Σε στενό χώρο μια πόρτα ίδιου πλάτους **δεν** σφραγίζεται — το
 * περίγραμμα μπορεί να «μπει» στο διπλανό· γι' αυτό μένει πάντα πρόταση προς έγκριση (Δ8.1).
 */
const DOOR_SCALES = [1, 0.5, 0.25] as const;
/** Βαθύτερο «μισό πάχος τοίχου» μέσα σε άνοιγμα πόρτας (m) — εξωτερικός τοίχος ~40 cm. */
const DOOR_REVEAL_MAX_M = 0.2;
interface Frame {
  readonly cols: number;
  readonly rows: number;
  readonly mpp: number;
  readonly options: SpaceDetectOptions;
}

const pixelIndex = (p: PixelPoint, cols: number): number => Math.floor(p.y) * cols + Math.floor(p.x);

function insideImage(p: PixelPoint, cols: number, rows: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
}

/** Ακουμπά ο χώρος το κάδρο της εικόνας; (τότε «βγήκε έξω» από το σπίτι) */
function touchesBorder(region: Uint8Array, cols: number, rows: number): boolean {
  for (let c = 0; c < cols; c++) if (region[c] === 1 || region[(rows - 1) * cols + c] === 1) return true;
  for (let r = 0; r < rows; r++) if (region[r * cols] === 1 || region[r * cols + cols - 1] === 1) return true;
  return false;
}

function countFilled(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/** Περίγραμμα pixel: Moore → DP → ορθογώνια έλξη (με δίχτυ: αλλιώς το απλοποιημένο). */
function outlineOf(region: Uint8Array, frame: Frame): { outline: PixelPoint[]; orthogonal: boolean } {
  const contour = traceOuterContour(region, frame.cols, frame.rows).map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  const simplified = simplifyClosedRing(contour, frame.options.simplifyToleranceM / frame.mpp);
  const ring = simplified.length >= 3 ? simplified : contour;
  const snapped = snapRingOrthogonal(ring, {
    ...DEFAULT_ORTHOGONAL_SNAP,
    outset: PIXEL_CENTRE_OUTSET,
    // Το «μισό άνοιγμα» στην πόρτα ισοπεδώνεται στην παρειά (Revit/Zillow: ο χώρος τελειώνει στον τοίχο).
    flatten: { maxDepth: DOOR_REVEAL_MAX_M / frame.mpp, maxWidth: (2 * frame.options.doorWidthM) / frame.mpp },
  });
  return snapped ? { outline: snapped, orthogonal: true } : { outline: ring, orthogonal: false };
}

/** Δ8.2 — αν κι άλλο σημείο λήψης πέφτει στον ίδιο χώρο, πρόταση γραμμής προς το **πλησιέστερο**. */
function separationFor(
  region: Uint8Array, seedIndex: number, outline: readonly PixelPoint[], input: SpaceDetectQuery, frame: Frame,
): SeparationSuggestion | null {
  const { cols, rows } = frame;
  const seed = { x: seedIndex % cols, y: Math.floor(seedIndex / cols) };
  const sharing = input.otherStops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => insideImage(stop, cols, rows) && region[pixelIndex(stop, cols)] === 1)
    .sort((p, q) => Math.hypot(p.stop.x - seed.x, p.stop.y - seed.y) - Math.hypot(q.stop.x - seed.x, q.stop.y - seed.y));
  const nearest = sharing[0];
  if (!nearest) return null;
  const found = suggestSeparation(region, cols, rows, seedIndex, pixelIndex(nearest.stop, cols), dominantAxis(outline));
  return found ? { ...found, otherStopIndex: nearest.index } : null;
}

/**
 * Μία προσπάθεια με δεδομένη ακτίνα ανοίγματος της μάσκας τοίχων και κλίμακα πόρτας. `'no-core'` = ο χώρος είναι
 * στενότερος από αυτή την πόρτα — ο καλών ξαναδοκιμάζει με μικρότερη.
 */
function attempt(
  input: SpaceDetectQuery, ink: Uint8Array, frame: Frame, openRadiusPx: number, doorScale: number,
): SpaceDetectResult | 'no-core' {
  const { cols, rows, mpp, options } = frame;
  const walls = wallMask(ink, cols, rows, openRadiusPx, input.separations);
  const doorRadiusPx = (doorScale * options.doorWidthM) / 2 / mpp;
  const space = segmentSpace(walls, cols, rows, pixelIndex(input.seed, cols), doorRadiusPx, options.seedSearchM / mpp);
  if (space === 'no-core') return space;
  if (space === 'on-wall') return { ok: false, refusal: 'seed-on-wall' };
  // Διαρροή = ο χώρος ακουμπά το κάδρο. ΟΧΙ «ποσοστό της εικόνας»: σε σφιχτά κομμένη κάτοψη γκαρσονιέρας το ένα
  // δωμάτιο είναι ~80% της εικόνας (μετρημένο στις άγκυρες — το όριο 60% απέρριπτε σωστούς χώρους).
  if (touchesBorder(space.region, cols, rows)) return { ok: false, refusal: 'leak' };
  if (countFilled(space.region) * mpp * mpp < options.minAreaM2) return { ok: false, refusal: 'too-small' };
  const { outline, orthogonal } = outlineOf(space.region, frame);
  const separation = separationFor(space.region, space.seedIndex, outline, input, frame);
  return { ok: true, outline, orthogonal, areaPx: polygonArea(outline), separation };
}

/** **Προετοίμασε** μια κάτοψη για ανίχνευση — το μελάνι, μία φορά ανά εικόνα. */
export function prepareSpaceRaster(raster: PlanRaster): PreparedPlanRaster {
  return { ink: inkMask(raster), width: raster.width, height: raster.height };
}

/** Ανιχνεύει τον χώρο γύρω από το `seed` σε **προετοιμασμένη** κάτοψη. Ποτέ δεν πετά· κάθε αποτυχία έχει όνομα. */
export function detectSpaceIn(prepared: PreparedPlanRaster, input: SpaceDetectQuery): SpaceDetectResult {
  const { width: cols, height: rows, ink } = prepared;
  const mpp = input.metresPerPixel;
  if (!(mpp > 0) || !Number.isFinite(mpp)) return { ok: false, refusal: 'uncalibrated' };
  if (!insideImage(input.seed, cols, rows)) return { ok: false, refusal: 'seed-outside' };
  const frame: Frame = { cols, rows, mpp, options: { ...DEFAULT_SPACE_DETECT, ...input.options } };
  for (const doorScale of DOOR_SCALES) {
    const first = attempt(input, ink, frame, frame.options.minWallThicknessM / 2 / mpp, doorScale);
    const result = first !== 'no-core' && !first.ok && first.refusal === 'leak'
      ? attempt(input, ink, frame, 0, doorScale)
      : first;
    if (result !== 'no-core') return result;
  }
  return { ok: false, refusal: 'seed-on-wall' };
}

/** Ανιχνεύει τον χώρο γύρω από το `seed` (μία εικόνα, μία ερώτηση). */
export function detectSpace(input: SpaceDetectInput): SpaceDetectResult {
  return detectSpaceIn(prepareSpaceRaster(input.raster), input);
}
