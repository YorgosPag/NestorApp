/**
 * @fileoverview **ΤΟ ΠΑΤΩΜΑ ΤΟΥ ΠΑΝΟΡΑΜΑΤΟΣ** — βελάκια και κουκκίδα κέρσορα **ξαπλωμένα** στο επίπεδο του πατώματος, με
 * την προοπτική της ίδιας της κάμερας (ADR-884 Φ2στ-γ · §4.14 σημεία 1–2). Καθαρό.
 * @related `lib/geometry/css-homography.ts` (τετράγωνο → τετράπλευρο) · `components/spatial-tour/viewer/TourPanoramaStage.tsx`
 *   (`usePlaceLinkButtons` — γράφει ανά καρέ) · `TourFloorCursor.tsx` · `useTourPanoramaInput.ts` (κλικ στο πάτωμα)
 * @module lib/spatial-tour/viewer/tour-floor-geometry
 *
 * 🧭 **Χώρος**: ό,τι εδώ ζει στο πλαίσιο του **τρέχοντος** κύβου (yaw όπως το `TourView.yaw`), με την κάμερα στο κέντρο και
 *   το πάτωμα `TOUR_EYE_HEIGHT_M` πιο κάτω. Ένα σημείο του πατώματος = `{ yaw, distance }` (οριζόντια απόσταση σε μέτρα).
 * 🏆 **Όπως η Zillow 3D Home**: τα βελάκια κάθονται σε **σταθερή ζώνη κοντά στη βάση** της εικόνας· όταν ο στόχος είναι
 *   πίσω ή δίπλα, το βελάκι μένει στη βάση, στην άκρη, και το σεβρόν του γυρίζει **προς τον πραγματικό στόχο** («<»).
 * 🔑 Η απόσταση δεν «μαντεύεται»: ένα σημείο της οθόνης κάτω από τον ορίζοντα **είναι** ένα σημείο του πατώματος
 *   (`distance = ύψος / tan(−κλίση)`) — η ίδια σχέση δίνει και την κουκκίδα και το κλικ.
 */

import { clamp } from '@/lib/geometry/scalar';
import { degToRad, normalizeAngleDiff } from '@/lib/geometry/angle';
import { quadToMatrix3d, type PlanePoint, type Quad } from '@/lib/geometry/css-homography';

import { horizontalFov } from './tour-viewer-bearing';
import type { TourView } from './tour-viewer-view';

/**
 * Ύψος του φακού από το πάτωμα. Τυπικό τρίποδο/μονόποδο λήψης 360° (Matterport, Ricoh, Insta360: 1,5–1,7 m). Μία σταθερά
 * ώστε αύριο να γίνει πεδίο της λήψης χωρίς αλλαγή σε κανέναν καλούντα.
 */
export const TOUR_EYE_HEIGHT_M = 1.6;
/** Πάνω από εδώ (πολύ κοντά στον ορίζοντα) το «πάτωμα» είναι δεκάδες μέτρα μακριά — καμία κουκκίδα, κανένα κλικ. */
export const FLOOR_HORIZON_GUARD = degToRad(-3);
/** Πιο μακριά από αυτό η κουκκίδα κρύβεται: σε σπίτι, πέρα από 10 m βλέπεις τοίχο, όχι πάτωμα. */
export const FLOOR_CURSOR_FAR_M = 10;
/** Τα βελάκια ποτέ πιο κοντά/μακριά από αυτά — κάτω από τα πόδια ή σχεδόν στον ορίζοντα δεν διαβάζονται. */
export const FLOOR_ARROW_NEAR_M = 1.3;
export const FLOOR_ARROW_FAR_M = 9;
/** Πόσο πάνω από την κάτω άκρη κάθεται το βελάκι, ως κλάσμα του κατακόρυφου πεδίου. */
const ARROW_LIFT = 0.14;
/** Περιθώριο από τις πλαϊνές άκρες, ως κλάσμα του οριζόντιου πεδίου. */
const ARROW_EDGE_MARGIN = 0.08;
/** Πλάτος οθόνης του δίσκου: κλάσμα του ύψους, μέσα σε όρια (px) — ίδιο διαβάσιμο μέγεθος σε κάθε παράθυρο και ζουμ. */
const ARROW_WIDTH_FRACTION = 0.1;
export const FLOOR_ARROW_WIDTH_PX = { min: 72, max: 128 } as const;
/** Χώρος ανάμεσα σε δύο βελάκια, σε πλάτη δίσκου. */
const ARROW_SPACING = 1.2;
/**
 * Το συρόμενο «χάπι» του **επεξεργαστή** κάθεται στη δική του διόπτευση, σε σταθερή κλίση (ποτέ καρφωμένο σε άκρη: η θέση
 * του ΕΙΝΑΙ η απάντηση «προς τα πού»).
 */
export const FLOOR_PILL_PITCH = degToRad(-18);
/** Ένα κλικ στο πάτωμα πηγαίνει μόνο σε στάση μέσα σε αυτόν τον κώνο γύρω από την κατεύθυνση του κλικ. */
export const FLOOR_PICK_CONE = degToRad(45);

export interface FloorSpot {
  /** Στο πλαίσιο του τρέχοντος κύβου, όπως το `TourView.yaw`. */
  readonly yaw: number;
  /** Οριζόντια απόσταση από τον φακό, σε μέτρα. */
  readonly distance: number;
}

export interface FloorViewport {
  readonly view: TourView;
  /** Πλάτος / ύψος του καμβά. */
  readonly aspect: number;
  /** Ύψος του καμβά σε CSS px. */
  readonly heightPx: number;
}

export interface FloorArrowPlacement {
  readonly spot: FloorSpot;
  /** Πόσο στρίβει το σεβρόν μέσα στο επίπεδο του δίσκου (rad, δεξιόστροφα) — `0` = «ίσια μπροστά». */
  readonly turn: number;
  readonly radiusM: number;
}

/** Το σημείο του πατώματος κάτω από μια κατεύθυνση — `null` πάνω από τον ορίζοντα ή πιο μακριά από `farM`. */
export function floorSpotAt(yaw: number, pitch: number, farM: number = FLOOR_CURSOR_FAR_M, eye: number = TOUR_EYE_HEIGHT_M): FloorSpot | null {
  if (!(pitch < FLOOR_HORIZON_GUARD)) return null;
  const distance = eye / Math.tan(-pitch);
  return distance > farM ? null : { yaw, distance };
}

/** Η κατεύθυνση (yaw, κλίση) ενός σημείου του πατώματος — το αντίστροφο του `floorSpotAt`. */
export function floorSpotAngles(spot: FloorSpot, eye: number = TOUR_EYE_HEIGHT_M): { readonly yaw: number; readonly pitch: number } {
  return { yaw: spot.yaw, pitch: -Math.atan2(eye, spot.distance) };
}

/** Επίπεδο του πατώματος: `x` δεξιά, `y` μπροστά (yaw 0). */
function spotToPlane(spot: FloorSpot): PlanePoint {
  return { x: Math.sin(spot.yaw) * spot.distance, y: Math.cos(spot.yaw) * spot.distance };
}

function planeToSpot(p: PlanePoint): FloorSpot {
  return { yaw: Math.atan2(p.x, p.y), distance: Math.hypot(p.x, p.y) };
}

/**
 * Οι τέσσερις γωνίες ενός τετραγώνου πλευράς `2·radiusM` πάνω στο πάτωμα, με κέντρο το `spot` και την «πάνω» πλευρά του
 * στοιχείου **μακριά** από τον θεατή: μακρινή-αριστερή · μακρινή-δεξιά · κοντινή-δεξιά · κοντινή-αριστερή. Έτσι το «πάνω»
 * του σεβρόν δείχνει «μπροστά, προς τα εκεί».
 */
export function floorSquareCorners(spot: FloorSpot, radiusM: number): readonly [FloorSpot, FloorSpot, FloorSpot, FloorSpot] {
  const c = spotToPlane(spot);
  const r = { x: Math.sin(spot.yaw) * radiusM, y: Math.cos(spot.yaw) * radiusM };
  const t = { x: Math.cos(spot.yaw) * radiusM, y: -Math.sin(spot.yaw) * radiusM };
  const at = (sr: number, st: number) => planeToSpot({ x: c.x + sr * r.x + st * t.x, y: c.y + sr * r.y + st * t.y });
  return [at(1, -1), at(1, 1), at(-1, 1), at(-1, -1)];
}

/** Το μέσο της μακρινής πλευράς — εκεί «στέκεται» η όρθια ετικέτα του βελακιού. */
export function floorSquareFarEdge(spot: FloorSpot, radiusM: number): FloorSpot {
  return { yaw: spot.yaw, distance: spot.distance + radiusM };
}

/** Προβολή (yaw, κλίση) → οθόνη, **χωρίς** αποκοπή στο κάδρο· `null` μόνο πίσω από την κάμερα. */
export type FloorProjector = (yaw: number, pitch: number) => PlanePoint | null;

/** Το CSS `matrix3d` που ξαπλώνει ένα τετράγωνο στοιχείο `sizePx` πάνω στο πάτωμα — `null` ⇒ κρύψ' το. */
export function floorSquareMatrix(spot: FloorSpot, radiusM: number, sizePx: number, project: FloorProjector, eye: number = TOUR_EYE_HEIGHT_M): string | null {
  const at = (corner: FloorSpot) => {
    const { yaw, pitch } = floorSpotAngles(corner, eye);
    return project(yaw, pitch);
  };
  const [c0, c1, c2, c3] = floorSquareCorners(spot, radiusM);
  const p0 = at(c0);
  const p1 = at(c1);
  const p2 = at(c2);
  const p3 = at(c3);
  if (p0 === null || p1 === null || p2 === null || p3 === null) return null;
  const quad: Quad = [p0, p1, p2, p3];
  return quadToMatrix3d(quad, sizePx);
}

/** Εστιακή απόσταση σε CSS px για το κατακόρυφο πεδίο. */
function focalPx(viewport: FloorViewport): number {
  return viewport.heightPx / 2 / Math.tan(viewport.view.fov / 2);
}

/**
 * Η ακτίνα (μέτρα) που δίνει στον δίσκο πλάτος οθόνης `widthPx` στη **μέση γραμμή** του. Το πλάτος οθόνης ενός εγκάρσιου
 * μήκους είναι `f · μήκος / βάθος`, με βάθος **κατά τον οπτικό άξονα** (όχι την ευθεία απόσταση): `d·cos(κλίση) + h·sin(κλίση)`.
 */
export function floorRadiusForWidth(spot: FloorSpot, widthPx: number, viewport: FloorViewport, eye: number = TOUR_EYE_HEIGHT_M): number {
  const { pitch, yaw } = viewport.view;
  const along = spot.distance * Math.cos(spot.yaw - yaw);
  const depth = along * Math.cos(pitch) + eye * Math.sin(-pitch);
  return ((widthPx / 2) * Math.max(depth, 1e-3)) / focalPx(viewport);
}

/** Πλάτος οθόνης ενός βελακιού στο τρέχον παράθυρο. */
export function floorArrowWidthPx(viewport: FloorViewport): number {
  return clamp(viewport.heightPx * ARROW_WIDTH_FRACTION, FLOOR_ARROW_WIDTH_PX.min, FLOOR_ARROW_WIDTH_PX.max);
}

/**
 * **Η απόσταση της ζώνης** για βελάκι σε σχετικό yaw `delta`: το κέντρο του δίσκου πέφτει στο **ίδιο ύψος οθόνης** (`ARROW_LIFT`
 * πάνω από τη βάση) σε κάθε στήλη. ⚠️ Όχι σταθερή κλίση: σε ορθογραμμική προβολή τα σημεία ίδιας κλίσης **κατεβαίνουν** προς τις
 * πλαϊνές άκρες (ζωντανά 2026-09-28, παράθυρο 2400×865, οριζόντιο πεδίο ~120°: το βελάκι της άκρης κοβόταν από τη βάση).
 * Κλειστή μορφή: `tan(κλίση) = cos(delta) · tan(p₀ + θ)`, με `tan θ` = ύψος της ζώνης στο επίπεδο της εικόνας. `null` ⇒ το
 * πάτωμα δεν φαίνεται (βλέμμα ψηλά).
 */
function arrowBandDistance(view: TourView, delta: number, eye: number): number | null {
  const theta = Math.atan(-(1 - 2 * ARROW_LIFT) * Math.tan(view.fov / 2));
  const centre = Math.max(view.pitch + theta, -Math.PI / 2 + 1e-3);
  const tanPitch = Math.cos(delta) * Math.tan(centre);
  if (!(tanPitch < 0)) return null;
  const distance = clamp(eye / -tanPitch, FLOOR_ARROW_NEAR_M, FLOOR_ARROW_FAR_M);
  // Ζώνη στο μακρινό όριο (βλέμμα λίγο ψηλά): φαίνεται ακόμη το πάτωμα εκεί;
  return -Math.atan2(eye, distance) < view.pitch - view.fov / 2 ? null : distance;
}

/** Ως πού (yaw από το κέντρο) μπορεί να καθίσει βελάκι χωρίς να βγει από τις πλαϊνές άκρες. */
function arrowYawLimit(viewport: FloorViewport): number {
  const hfov = horizontalFov(viewport.view.fov, viewport.aspect);
  return Math.max(0, hfov / 2 - hfov * ARROW_EDGE_MARGIN);
}

/** Η γωνιακή απόσταση που χρειάζονται δύο γειτονικά βελάκια ώστε να μην επικαλύπτονται. */
function arrowSeparation(distance: number, radiusM: number): number {
  return (2 * radiusM * ARROW_SPACING) / distance;
}

/** Μετακινεί ταξινομημένες γωνίες ώστε να απέχουν ≥ `gap`, και ξαναχωρά την ομάδα μέσα στο `[-limit, limit]`. */
export function spreadAngles(deltas: readonly number[], gap: number, limit: number): number[] {
  const out = [...deltas];
  for (let i = 1; i < out.length; i += 1) out[i] = Math.max(out[i] as number, (out[i - 1] as number) + gap);
  const overflow = (out[out.length - 1] ?? 0) - limit;
  if (overflow > 0) for (let i = 0; i < out.length; i += 1) out[i] = Math.max((out[i] as number) - overflow, -limit);
  return out;
}

export interface FloorArrowTarget {
  readonly id: string;
  /** Στο πλαίσιο του τρέχοντος κύβου. */
  readonly yaw: number;
}

/**
 * **Πού κάθεται κάθε βελάκι** στο τρέχον καρέ: στη ζώνη της βάσης, στη διόπτευση του στόχου όταν αυτή φαίνεται, αλλιώς
 * στην πλαϊνή άκρη με το σεβρόν στραμμένο προς τον στόχο. Βελάκια που θα έπεφταν το ένα πάνω στο άλλο απλώνονται. Κενός
 * χάρτης ⇒ το πάτωμα δεν φαίνεται.
 */
export function placeFloorArrows(targets: readonly FloorArrowTarget[], viewport: FloorViewport, eye: number = TOUR_EYE_HEIGHT_M): Map<string, FloorArrowPlacement> {
  const placements = new Map<string, FloorArrowPlacement>();
  const { view } = viewport;
  const centreDistance = arrowBandDistance(view, 0, eye);
  if (centreDistance === null || targets.length === 0) return placements;
  const widthPx = floorArrowWidthPx(viewport);
  const centreRadius = floorRadiusForWidth({ yaw: view.yaw, distance: centreDistance }, widthPx, viewport, eye);
  const limit = arrowYawLimit(viewport);
  const sorted = targets
    .map((target) => ({ target, delta: clamp(normalizeAngleDiff(target.yaw - view.yaw), -limit, limit) }))
    .sort((a, b) => a.delta - b.delta);
  const spread = spreadAngles(sorted.map((s) => s.delta), arrowSeparation(centreDistance, centreRadius), limit);
  sorted.forEach(({ target }, i) => {
    const delta = spread[i] as number;
    const distance = arrowBandDistance(view, delta, eye);
    if (distance === null) return;
    const spot = { yaw: view.yaw + delta, distance };
    const radiusM = floorRadiusForWidth(spot, widthPx, viewport, eye);
    placements.set(target.id, { spot, turn: normalizeAngleDiff(target.yaw - spot.yaw), radiusM });
  });
  return placements;
}

export interface FloorPickCandidate {
  readonly nodeId: string;
  /** Στο πλαίσιο του τρέχοντος κύβου. */
  readonly yaw: number;
  /** Πραγματική απόσταση από τις θέσεις της κάτοψης — `null` όταν δεν είναι γνωστή. */
  readonly distance: number | null;
}

/**
 * **Κλικ στο πάτωμα ⇒ ποια στάση;** Η πλησιέστερη (στο πάτωμα) από τις **συνδεδεμένες** στάσεις μέσα σε κώνο ±45° γύρω από
 * την κατεύθυνση του κλικ. Χωρίς γνωστή απόσταση ο στόχος θεωρείται στο βάθος του κλικ (κρίνει μόνο η γωνία). Καμία ⇒ `null`:
 * ποτέ «τηλεμεταφορά» σε σημείο χωρίς λήψη.
 */
export function pickFloorTarget(spot: FloorSpot, candidates: readonly FloorPickCandidate[]): string | null {
  const click = spotToPlane(spot);
  let best: { readonly nodeId: string; readonly gap: number } | null = null;
  for (const c of candidates) {
    if (Math.abs(normalizeAngleDiff(c.yaw - spot.yaw)) > FLOOR_PICK_CONE) continue;
    const at = spotToPlane({ yaw: c.yaw, distance: c.distance ?? spot.distance });
    const gap = Math.hypot(at.x - click.x, at.y - click.y);
    if (best === null || gap < best.gap) best = { nodeId: c.nodeId, gap };
  }
  return best?.nodeId ?? null;
}
