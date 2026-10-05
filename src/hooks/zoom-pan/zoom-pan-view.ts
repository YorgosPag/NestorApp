/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΟΨΗΣ του `useZoomPan`** — zoom · μετατόπιση · στροφή, και ο ΕΝΑΣ τρόπος να «κάτσει» μια νέα
 *   όψη (περιορισμός pan, ADR-899 §9 θέμα 3). Μοιράζεται ανάμεσα στο hook και στα υπο-hooks τροχού/σύρσης.
 * @module hooks/zoom-pan/zoom-pan-view
 */

import { confinePan, quarterTurnExtent, type Extent, type Vec2 } from '@/lib/geometry/zoom-pan-math';
import { fitScaleForRotation } from '@/lib/images/image-dimensions';

export interface ZoomPanView {
  readonly zoom: number;
  /** Μετατόπιση από το κέντρο του κουτιού, σε css px. */
  readonly pan: Vec2;
  /** Μοίρες, πολλαπλάσιο του 90. */
  readonly rotation: number;
}

/** Ανάγνωση της τρέχουσας όψης **τη στιγμή του γεγονότος** (ποτέ στιγμιότυπο — δόγμα getter). */
export type ViewGetter = () => ZoomPanView;
/** Εφαρμογή νέας όψης· ο περιορισμός pan γίνεται **εδώ**, για κάθε κανάλι (τροχός · σύρση · pinch · κουμπιά). */
export type ViewCommit = (next: ZoomPanView) => void;

export const ZERO_PAN: Vec2 = { x: 0, y: 0 };

/** Η **ουδέτερη** όψη: «χωρά», στο κέντρο, χωρίς στροφή — ό,τι βλέπει κάθε νέο περιεχόμενο και ό,τι δίνει το κουμπί «χωρά». */
export function neutralViewOf(defaultZoom: number): ZoomPanView {
  return { zoom: defaultZoom, pan: ZERO_PAN, rotation: 0 };
}

/** Τα στοιχεία που χρειάζεται ο περιορισμός: το κουτί (ορατή περιοχή) και το περιεχόμενο (χωρίς μετασχηματισμό). */
export interface ViewFrame {
  readonly container: HTMLElement | null;
  readonly content: HTMLElement | null;
  /** Επαναπροσαρμογή μετά τη στροφή (ADR-899 §9 θέμα 5β)· απόν ⇒ η κλίμακα είναι σκέτο το zoom. */
  readonly fit?: ViewFit | null;
}

/** Ό,τι χρειάζεται το «ξαναχωρά»: το content-box του κουτιού και οι πραγματικές διαστάσεις του περιεχομένου (αν δηλώθηκαν). */
export interface ViewFit {
  readonly box: Extent;
  readonly intrinsic: Extent | null;
}

/**
 * Οι διαστάσεις του περιεχομένου: δηλωμένες ⇒ `naturalWidth/Height` ⇒ layout. ⚠️ Με `srcset` το `naturalWidth` είναι
 * διορθωμένο κατά πυκνότητα (= `sizes`, όχι τα pixel του αρχείου) ⇒ δεν ρωτιέται. Με το layout ως εφεδρεία η στραμμένη
 * μόνο **μικραίνει** — ποτέ επινοημένη μεγέθυνση.
 */
function intrinsicOf(content: HTMLElement, declared: Extent | null): Extent {
  if (declared) return declared;
  if (content instanceof HTMLImageElement && !content.srcset && content.naturalWidth > 0 && content.naturalHeight > 0) {
    return { width: content.naturalWidth, height: content.naturalHeight };
  }
  return { width: content.offsetWidth, height: content.offsetHeight };
}

/**
 * **Η κλίμακα που ζωγραφίζεται** = `zoom × fit` — το ΕΝΑ σημείο που το ξέρει. Το διαβάζουν ο περιορισμός pan, ο
 * μετασχηματισμός και η ερώτηση ανάλυσης, άρα δεν μπορούν να διαφωνήσουν. «100%» = «χωρά» σε κάθε γωνία (Google Photos).
 */
export function viewScaleOf(view: ZoomPanView, frame: ViewFrame): number {
  const { content, fit } = frame;
  if (!fit || !content || content.offsetWidth === 0 || content.offsetHeight === 0) return view.zoom;
  return view.zoom * fitScaleForRotation(fit.box, intrinsicOf(content, fit.intrinsic), view.rotation);
}

/** Ό,τι **βλέπει** ο θεατής: το layout του περιεχομένου × κλίμακα, στραμμένο. `null` όταν δεν μετριέται. */
function paintedOf(frame: ViewFrame, view: ZoomPanView): Extent | null {
  const { content } = frame;
  if (!content || content.offsetWidth === 0 || content.offsetHeight === 0) return null;
  const scale = viewScaleOf(view, frame);
  // Ακέραια css px: το `offsetWidth` είναι ήδη στρογγυλεμένο (939 για 938,67), άρα `× fit` δίνει 704,25 σε κουτί 704 —
  // ένα τέταρτο pixel που ο θεατής δεν βλέπει δεν πρέπει να ανοίγει pan ούτε «χεράκι».
  const scaled = { width: Math.round(content.offsetWidth * scale), height: Math.round(content.offsetHeight * scale) };
  return quarterTurnExtent(scaled, view.rotation);
}

/**
 * **Η όψη όπως θα σταθεί**: με περιορισμό, η άκρη του περιεχομένου δεν μπαίνει στο κουτί (Google Photos)· χωρίς στοιχεία
 * μέτρησης, αμετάβλητη (ποτέ επινοημένα όρια).
 */
export function settleView(view: ZoomPanView, frame: ViewFrame, confine: boolean): ZoomPanView {
  if (!confine || !frame.container) return view;
  const painted = paintedOf(frame, view);
  if (!painted) return view;
  const box = { width: frame.container.clientWidth, height: frame.container.clientHeight };
  return { ...view, pan: confinePan(view.pan, painted, box) };
}

/** Υπάρχει χώρος για pan; (για τον κέρσορα «χεράκι» — χωρίς περιορισμό, πάντα.) */
export function canPanIn(view: ZoomPanView, frame: ViewFrame, confine: boolean): boolean {
  if (!confine) return true;
  if (!frame.container) return false;
  const painted = paintedOf(frame, view);
  if (!painted) return false;
  return painted.width > frame.container.clientWidth || painted.height > frame.container.clientHeight;
}
