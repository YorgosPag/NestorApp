/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ ΣΗΜΕΙΩΝ ΛΗΨΗΣ** — καθαρές, χωρίς React (ADR-897 Φ3).
 * @related lib/listings/photo-capture-spot (το μοντέλο) · lib/geometry/view-cone (η γεωμετρία) ·
 *   components/listings/capture-spots/* (η οθόνη)
 * @module lib/listings/photo-capture-spot-edit
 *
 * 🔑 **Μοντέλο Revit, όχι «περιστροφή με ρόδα»**: θέση = σημείο ματιού, κατεύθυνση = **στόχος** που σέρνεις, πεδίο = οι
 *   **άκρες** του κώνου που σέρνεις. Κάθε πράξη παίρνει σημείο **της εικόνας** και γυρίζει **νέο** σημείο λήψης.
 * 📐 **Οι γωνίες υπολογίζονται σε pixel, ποτέ σε κανονικοποιημένες μονάδες**: σε κάτοψη 2:1 το `(0,1; 0,1)` δεν είναι 45°.
 * ⚠️ Κάθε έξοδος περνά τα όρια της πόρτας (`photoCaptureSpotSchema`) — ο επεξεργαστής δεν μπορεί να παράγει σημείο
 *   που ο διακομιστής θα απέρριπτε.
 */

import { normalizeAngleDiff, normalizeAngleRad } from '@/lib/geometry/angle';
import { headingTowards } from '@/lib/geometry/view-cone';

import {
  DEFAULT_PHOTO_FOV_RAD,
  MAX_PHOTO_FOV_RAD,
  MIN_PHOTO_FOV_RAD,
  type PhotoCaptureSpot,
} from './photo-capture-spot';

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** Σημείο κανονικοποιημένο [0,1] πάνω στην εικόνα. */
export interface UnitPoint {
  readonly x: number;
  readonly y: number;
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));
const clampFov = (value: number): number => Math.min(MAX_PHOTO_FOV_RAD, Math.max(MIN_PHOTO_FOV_RAD, value));
/** Τρία δεκαδικά στη θέση (~0,1% της κάτοψης) — ίδια ακρίβεια με τον επιλογέα εστίασης· σταθερό, συγκρίσιμο σύρμα. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const toPixel = (point: UnitPoint, image: ImageSize) => ({ x: point.x * image.width, y: point.y * image.height });

/**
 * **Τοποθέτηση** — η φωτογραφία πάει στο `at` της κάτοψης `floorplanFileId`. Κατεύθυνση και πεδίο **κρατιούνται** αν
 * υπήρχαν (μετακίνηση δεν είναι επαναπροσανατολισμός)· νέα φωτογραφία ⇒ προς τα πάνω, με το `fovRad` που δίνεται
 * (από το EXIF, όταν είναι γνωστό — αλλιώς ο κύριος φακός κινητού).
 */
export function placeSpot(
  previous: PhotoCaptureSpot | null,
  floorplanFileId: string,
  at: UnitPoint,
  fovRad: number = DEFAULT_PHOTO_FOV_RAD,
): PhotoCaptureSpot {
  return {
    floorplanFileId,
    x: round3(clampUnit(at.x)),
    y: round3(clampUnit(at.y)),
    headingRad: previous?.headingRad ?? 0,
    fovRad: previous?.fovRad ?? clampFov(fovRad),
  };
}

/** **Στόχευση** — η κάμερα κοιτάζει προς το `target` (η λαβή-στόχος του Revit). Στόχος πάνω στο σημείο ⇒ καμία αλλαγή. */
export function aimSpot(spot: PhotoCaptureSpot, target: UnitPoint, image: ImageSize): PhotoCaptureSpot {
  const origin = toPixel(spot, image);
  const towards = toPixel(target, image);
  if (Math.hypot(towards.x - origin.x, towards.y - origin.y) < 1e-6) return spot;
  return { ...spot, headingRad: headingTowards(origin, towards) };
}

/**
 * **Πλάτος πεδίου** — μια άκρη του κώνου σύρεται στο `edge`: το πεδίο γίνεται **διπλάσιο** της γωνίας από την
 * κατεύθυνση, συμμετρικά (ο κώνος μένει κεντραρισμένος στην κατεύθυνση — αυτό σημαίνει «κέντρο της φωτογραφίας»).
 */
export function widenSpot(spot: PhotoCaptureSpot, edge: UnitPoint, image: ImageSize): PhotoCaptureSpot {
  const origin = toPixel(spot, image);
  const towards = toPixel(edge, image);
  if (Math.hypot(towards.x - origin.x, towards.y - origin.y) < 1e-6) return spot;
  const half = Math.abs(normalizeAngleDiff(headingTowards(origin, towards) - spot.headingRad));
  return { ...spot, fovRad: clampFov(half * 2) };
}

/** Μετακίνηση πληκτρολογίου — κλάσματα της εικόνας, σφηνωμένα στα όρια. */
export function nudgeSpot(spot: PhotoCaptureSpot, dx: number, dy: number): PhotoCaptureSpot {
  return { ...spot, x: round3(clampUnit(spot.x + dx)), y: round3(clampUnit(spot.y + dy)) };
}

/** Περιστροφή πληκτρολογίου — δεξιόστροφα για θετικό `deltaRad`, στο [0, 2π). */
export function rotateSpot(spot: PhotoCaptureSpot, deltaRad: number): PhotoCaptureSpot {
  return { ...spot, headingRad: normalizeAngleRad(spot.headingRad + deltaRad) };
}

/** Αλλαγή πεδίου πληκτρολογίου — σφηνωμένη στα όρια της πόρτας. */
export function resizeSpotFov(spot: PhotoCaptureSpot, deltaRad: number): PhotoCaptureSpot {
  return { ...spot, fovRad: clampFov(spot.fovRad + deltaRad) };
}

/** Πού κάθεται κάθε φωτογραφία ως προς την **ενεργή** κάτοψη — οι τέσσερις ομάδες της ταινίας του επεξεργαστή. */
export interface CaptureSpotGroups {
  /** Καμία θέση — η δουλειά που μένει. */
  readonly unplaced: readonly string[];
  /** Θέση **σε αυτή** την κάτοψη. */
  readonly here: readonly string[];
  /** Θέση σε **άλλη** δηλωμένη κάτοψη (άλλος όροφος). */
  readonly elsewhere: readonly string[];
  /** Θέση σε κάτοψη που **δεν** είναι πια δηλωμένη — δεν φαίνεται στο κοινό, ο άνθρωπος πρέπει να το μάθει. */
  readonly orphaned: readonly string[];
}

/** Η ομαδοποίηση κρατά τη **σειρά των φωτογραφιών** μέσα σε κάθε ομάδα (η σειρά της αγγελίας). */
export function groupCaptureSpots(
  photoIds: readonly string[],
  spots: ReadonlyMap<string, PhotoCaptureSpot>,
  floorplanIds: readonly string[],
  activeFloorplanId: string | null,
): CaptureSpotGroups {
  const declared = new Set(floorplanIds);
  const groups = { unplaced: [] as string[], here: [] as string[], elsewhere: [] as string[], orphaned: [] as string[] };
  for (const id of photoIds) {
    const spot = spots.get(id);
    if (spot === undefined) groups.unplaced.push(id);
    else if (!declared.has(spot.floorplanFileId)) groups.orphaned.push(id);
    else if (spot.floorplanFileId === activeFloorplanId) groups.here.push(id);
    else groups.elsewhere.push(id);
  }
  return groups;
}
