/**
 * @fileoverview **ΠΟΥ ΚΟΙΤΑΖΕΙ Η ΚΑΜΕΡΑ** — θέαση (yaw · κλίση · οπτικό πεδίο), όρια και είσοδος (σύρσιμο, ροδέλα,
 * τσίμπημα, πλήκτρα) (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `tour-viewer-bearing.ts` (τι σημαίνει το yaw στην κάτοψη)
 * @module lib/spatial-tour/viewer/tour-viewer-view
 *
 * 📏 **Αριθμοί από τους μεγάλους, όχι από το χέρι** (έρευνα 2026-09-27):
 * - οπτικό πεδίο = **κατακόρυφο** (σύμβαση `PerspectiveCamera.fov`)· εύρος **30°–90°** όπως το Photo Sphere Viewer·
 *   προεπιλογή **65°** ⇒ ~**98° οριζόντια** σε 16:9, δηλαδή το ~90° του Street View.
 * - κλίση **±85°** — ποτέ ακριβώς ±90°, όπου η στροφή γύρω από τον κατακόρυφο άξονα εκφυλίζεται.
 * - «αρπάζω τον κόσμο»: σύρσιμο δεξιά ⇒ ο κόσμος πάει δεξιά ⇒ κοιτάζω **αριστερά** (Matterport · PSV · Street View)·
 *   η ταχύτητα κλιμακώνεται με το οπτικό πεδίο, ώστε με μεγέθυνση το σημείο κάτω από το δάχτυλο να μένει κάτω από αυτό.
 * - πλήκτρα: βέλη = στροφή, `+`/`-` = μεγέθυνση (PSV `keyboard` · Street View).
 */

import { degToRad, normalizeAngleDiff } from '@/lib/geometry/angle';

export interface TourView {
  /** Στροφή μέσα στο πανόραμα, δεξιόστροφα θετική, `(-π, π]`. */
  readonly yaw: number;
  /** Πάνω θετική, `[-PITCH_LIMIT, PITCH_LIMIT]`. */
  readonly pitch: number;
  /** Κατακόρυφο οπτικό πεδίο, `[FOV_MIN, FOV_MAX]`. */
  readonly fov: number;
}

export const FOV_MIN = degToRad(30);
export const FOV_MAX = degToRad(90);
export const FOV_DEFAULT = degToRad(65);
export const PITCH_LIMIT = degToRad(85);
export const KEY_YAW_STEP = degToRad(15);
export const KEY_PITCH_STEP = degToRad(10);
/** Κάθε πάτημα `+`/`-` αλλάζει το οπτικό πεδίο κατά αυτόν τον λόγο. */
export const KEY_ZOOM_FACTOR = 1.2;
/** Ευαισθησία ροδέλας: `fov × e^(deltaY × WHEEL_ZOOM_RATE)` (γραμμική στο λογάριθμο — ίδια αίσθηση σε κάθε μεγέθυνση). */
export const WHEEL_ZOOM_RATE = 0.0015;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Η θέαση μέσα στα όρια — κάθε είσοδος περνά από εδώ, κανείς δεν γράφει θέαση εκτός ορίων. */
export function clampView(view: TourView): TourView {
  return {
    yaw: normalizeAngleDiff(view.yaw),
    pitch: clamp(view.pitch, -PITCH_LIMIT, PITCH_LIMIT),
    fov: clamp(view.fov, FOV_MIN, FOV_MAX),
  };
}

/** Αρχική θέαση: ορίζοντας, προεπιλεγμένο πεδίο, προς το `yaw` που ζητήθηκε. */
export function initialView(yaw = 0): TourView {
  return clampView({ yaw, pitch: 0, fov: FOV_DEFAULT });
}

/** Σύρσιμο κατά `(dx, dy)` εικονοστοιχεία σε καμβά ύψους `heightPx` — «αρπάζω τον κόσμο». */
export function viewAfterDrag(view: TourView, dx: number, dy: number, heightPx: number): TourView {
  if (!(heightPx > 0)) return view;
  const radPerPx = view.fov / heightPx;
  return clampView({ ...view, yaw: view.yaw - dx * radPerPx, pitch: view.pitch + dy * radPerPx });
}

/** Ροδέλα: θετικό `deltaY` (κύλιση προς τα κάτω) ⇒ ευρύτερο πεδίο. */
export function viewAfterWheel(view: TourView, deltaY: number): TourView {
  return clampView({ ...view, fov: view.fov * Math.exp(deltaY * WHEEL_ZOOM_RATE) });
}

/** Τσίμπημα: το πεδίο της αρχής του τσιμπήματος × (αρχική απόσταση / τρέχουσα). */
export function viewAfterPinch(view: TourView, startFov: number, startDistance: number, distance: number): TourView {
  if (!(startDistance > 0) || !(distance > 0)) return view;
  return clampView({ ...view, fov: startFov * (startDistance / distance) });
}

/** Πλήκτρο ⇒ νέα θέαση, ή `null` όταν το πλήκτρο δεν αφορά τη θέαση (ο καλών τότε **δεν** το καταναλώνει). */
export function viewAfterKey(view: TourView, key: string): TourView | null {
  switch (key) {
    case 'ArrowLeft':
      return clampView({ ...view, yaw: view.yaw - KEY_YAW_STEP });
    case 'ArrowRight':
      return clampView({ ...view, yaw: view.yaw + KEY_YAW_STEP });
    case 'ArrowUp':
      return clampView({ ...view, pitch: view.pitch + KEY_PITCH_STEP });
    case 'ArrowDown':
      return clampView({ ...view, pitch: view.pitch - KEY_PITCH_STEP });
    case '+':
    case '=':
      return clampView({ ...view, fov: view.fov / KEY_ZOOM_FACTOR });
    case '-':
    case '_':
      return clampView({ ...view, fov: view.fov * KEY_ZOOM_FACTOR });
    default:
      return null;
  }
}

/** Μεγέθυνση από κουμπί (ίδιο βήμα με τα πλήκτρα — ένας κανόνας για κάθε είσοδο). */
export function viewAfterZoomStep(view: TourView, direction: 'in' | 'out'): TourView {
  return viewAfterKey(view, direction === 'in' ? '+' : '-') ?? view;
}
