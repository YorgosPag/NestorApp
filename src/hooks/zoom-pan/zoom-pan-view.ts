/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΟΨΗΣ του `useZoomPan`** — zoom · μετατόπιση · στροφή, και ο ΕΝΑΣ τρόπος να «κάτσει» μια νέα
 *   όψη (περιορισμός pan, ADR-899 §9 θέμα 3). Μοιράζεται ανάμεσα στο hook και στα υπο-hooks τροχού/σύρσης.
 * @module hooks/zoom-pan/zoom-pan-view
 */

import { confinePan, quarterTurnExtent, type Extent, type Vec2 } from '@/lib/geometry/zoom-pan-math';

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

/** Τα στοιχεία που χρειάζεται ο περιορισμός: το κουτί (ορατή περιοχή) και το περιεχόμενο (χωρίς μετασχηματισμό). */
export interface ViewFrame {
  readonly container: HTMLElement | null;
  readonly content: HTMLElement | null;
}

/** Ό,τι **βλέπει** ο θεατής: το layout του περιεχομένου × zoom, στραμμένο. `null` όταν δεν μετριέται. */
function paintedOf(content: HTMLElement, view: ZoomPanView): Extent | null {
  if (content.offsetWidth === 0 || content.offsetHeight === 0) return null;
  const scaled = { width: content.offsetWidth * view.zoom, height: content.offsetHeight * view.zoom };
  return quarterTurnExtent(scaled, view.rotation);
}

/**
 * **Η όψη όπως θα σταθεί**: με περιορισμό, η άκρη του περιεχομένου δεν μπαίνει στο κουτί (Google Photos)· χωρίς στοιχεία
 * μέτρησης, αμετάβλητη (ποτέ επινοημένα όρια).
 */
export function settleView(view: ZoomPanView, frame: ViewFrame, confine: boolean): ZoomPanView {
  if (!confine || !frame.container || !frame.content) return view;
  const painted = paintedOf(frame.content, view);
  if (!painted) return view;
  const box = { width: frame.container.clientWidth, height: frame.container.clientHeight };
  return { ...view, pan: confinePan(view.pan, painted, box) };
}

/** Υπάρχει χώρος για pan; (για τον κέρσορα «χεράκι» — χωρίς περιορισμό, πάντα.) */
export function canPanIn(view: ZoomPanView, frame: ViewFrame, confine: boolean): boolean {
  if (!confine) return true;
  if (!frame.container || !frame.content) return false;
  const painted = paintedOf(frame.content, view);
  if (!painted) return false;
  return painted.width > frame.container.clientWidth || painted.height > frame.container.clientHeight;
}
