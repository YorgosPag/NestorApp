/**
 * **Η όψη που στέλνεται στον αναγνώστη** (ADR-929 Δ5, Δ15 #4): ένα ορθογώνιο της **ευθυγραμμισμένης** εικόνας (η περιοχή
 * του σχεδίου, χωρίς πινακίδα), με τις περιοχές που ασπρίζονται, και η **μία** γέφυρα ανάμεσα στον χώρο του παρόχου
 * (`view-‰`, ακέραιοι 0–1000) και στα αρχικά px του υποβάθρου.
 *
 * 🔑 **Δύο βήματα, κανένας δεύτερος τύπος.** `view-‰ → aligned px` είναι γραμμική κλίμακα πάνω στο crop· `aligned px →
 * raster-px` περνά **μόνο** από την ομογραφία της Φ1 (`planRegion`, Δ3). Ο διακομιστής δεν βλέπει ποτέ ομογραφία: δουλεύει
 * σε `view-‰`, και ο πελάτης, που κρατά την ευθυγράμμιση, γυρίζει τα ευρήματα πίσω.
 *
 * 🔑 **Τα τμήματα της Φ2 είναι σε αρχικά px** (`RasterSegment`). Για τον πάροχο περνούν από `originalToAligned` στην όψη.
 * Ένα τμήμα μπαίνει όταν το **μέσο** του πέφτει στο crop και **έξω** από κάθε ασπρισμένη περιοχή: ένα τμήμα που ο πάροχος
 * δεν μπορεί να δει δεν πρέπει να του προσφερθεί ως αναφορά.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-view
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import type { RasterRectPx } from '../../../types/coordinate-space';
import { planRegion } from '../alignment/alignment-region';
import type { AlignedRectPx, PlanAlignment } from '../alignment/plan-alignment-types';
import type { RasterSegment } from '../plan-recognition-types';
import { PLAN_VIEW_GRID, type PlanViewBox } from './plan-reading-wire';

export interface PlanReadingView {
  /**
   * Η περιοχή που στέλνεται, σε **ακέραια** px της ευθυγραμμισμένης εικόνας: η εικόνα της όψης είναι ακριβώς αυτά τα pixel,
   * άρα το `view-‰` και τα bytes που φεύγουν δεν αποκλίνουν ούτε κατά κλάσμα pixel.
   */
  readonly crop: AlignedRectPx;
  /** Περιοχές μέσα στο crop που ασπρίζονται πριν την αποστολή: πινακίδα, υπόμνημα, σφραγίδα (Δ15 #4). */
  readonly redacted: readonly AlignedRectPx[];
}

/** Ένα τμήμα όπως το βλέπει ο πάροχος: ίδιο `id` με το `RasterSegment` (Δ5), άκρα σε `view-‰`. */
export interface PlanViewSegment {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly style: RasterSegment['style'];
}

const widthOf = (r: AlignedRectPx): number => r.maxX - r.minX;
const heightOf = (r: AlignedRectPx): number => r.maxY - r.minY;

function contains(r: AlignedRectPx, p: PlanePoint): boolean {
  return p.x >= r.minX && p.x < r.maxX && p.y >= r.minY && p.y < r.maxY;
}

function intersects(a: AlignedRectPx, b: AlignedRectPx): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/**
 * **Μετρά** αυτό το σημείο της ευθυγραμμισμένης εικόνας στην όψη; Μέσα στο crop **και** έξω από κάθε περιοχή απόκρυψης.
 * Ο ΕΝΑΣ κανόνας για τμήματα (μέσο) και κείμενα του τοπικού OCR (κέντρο): ό,τι βλέπει ο άνθρωπος, αυτό μετρά (§6.10 Α2).
 */
export function isInReadingView(view: PlanReadingView, point: PlanePoint): boolean {
  return contains(view.crop, point) && !view.redacted.some((r) => contains(r, point));
}

/** Crop χωρίς εμβαδόν ή με κλασματικά όρια δεν είναι όψη: σφάλμα του καλούντος, όχι κενή ανάγνωση. */
export function assertReadingView(view: PlanReadingView): void {
  const { minX, minY, maxX, maxY } = view.crop;
  if (![minX, minY, maxX, maxY].every(Number.isInteger)) throw new Error('PlanReadingView: crop must be whole pixels');
  if (!(widthOf(view.crop) > 0 && heightOf(view.crop) > 0)) throw new Error('PlanReadingView: empty crop');
}

/** Το μικρότερο ακέραιο ορθογώνιο που περιέχει το `r`, μέσα στην εικόνα. */
function snapToPixels(r: AlignedRectPx, width: number, height: number): AlignedRectPx {
  return {
    minX: Math.max(0, Math.floor(r.minX)),
    minY: Math.max(0, Math.floor(r.minY)),
    maxX: Math.min(width, Math.ceil(r.maxX)),
    maxY: Math.min(height, Math.ceil(r.maxY)),
  };
}

/** Σημείο της ευθυγραμμισμένης εικόνας → `view-‰` (δεκαδικό· η στρογγύλευση γίνεται μόνο στο σύρμα). */
export function alignedToView(p: PlanePoint, view: PlanReadingView): PlanePoint {
  return {
    x: ((p.x - view.crop.minX) / widthOf(view.crop)) * PLAN_VIEW_GRID,
    y: ((p.y - view.crop.minY) / heightOf(view.crop)) * PLAN_VIEW_GRID,
  };
}

/** `view-‰` → σημείο της ευθυγραμμισμένης εικόνας. */
export function viewToAligned(p: PlanePoint, view: PlanReadingView): PlanePoint {
  return {
    x: view.crop.minX + (p.x / PLAN_VIEW_GRID) * widthOf(view.crop),
    y: view.crop.minY + (p.y / PLAN_VIEW_GRID) * heightOf(view.crop),
  };
}

/** Πλαίσιο της όψης → περιβάλλον ορθογώνιο στα **αρχικά** px (Δ3, μέσω της ομογραφίας της Φ1). */
export function viewBoxToOriginal(box: PlanViewBox, view: PlanReadingView, alignedToOriginal: Homography): RasterRectPx {
  const a = viewToAligned({ x: box.x0, y: box.y0 }, view);
  const b = viewToAligned({ x: box.x1, y: box.y1 }, view);
  const aligned: AlignedRectPx = { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
  return planRegion(aligned, alignedToOriginal).originalBounds;
}

/**
 * Τα τμήματα της Φ2 που **φαίνονται** στην όψη, σε `view-‰`. Τα άκρα δεν κόβονται στο crop: ένας τοίχος που βγαίνει λίγο
 * έξω κρατά τη διεύθυνσή του, και η τιμή εκτός 0–1000 λέει ακριβώς αυτό.
 */
export function viewSegmentsOf(
  segments: readonly RasterSegment[],
  originalToAligned: Homography,
  view: PlanReadingView,
): PlanViewSegment[] {
  assertReadingView(view);
  const out: PlanViewSegment[] = [];
  for (const s of segments) {
    const a = applyHomography(originalToAligned, s.start.x, s.start.y);
    const b = applyHomography(originalToAligned, s.end.x, s.end.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!isInReadingView(view, mid)) continue;
    const va = alignedToView(a, view);
    const vb = alignedToView(b, view);
    out.push({ id: s.id, x0: Math.round(va.x), y0: Math.round(va.y), x1: Math.round(vb.x), y1: Math.round(vb.y), style: s.style });
  }
  return out;
}

/**
 * Η **πρόταση** όψης από την ευθυγράμμιση: η περιοχή του σχεδίου, με ασπρισμένες τις υποψήφιες πινακίδες που πέφτουν
 * μέσα της. Είναι πρόταση και μόνο: ο άνθρωπος τη βλέπει και τη διορθώνει πριν από κάθε αποστολή (Δ15 #4).
 */
export function proposedReadingView(alignment: Pick<PlanAlignment, 'image' | 'sheet'>): PlanReadingView {
  const { width, height } = alignment.image;
  const full: AlignedRectPx = { minX: 0, minY: 0, maxX: width, maxY: height };
  const crop = snapToPixels(alignment.sheet?.drawing.aligned ?? full, width, height);
  const redacted = (alignment.sheet?.annotations ?? [])
    .map((a) => a.region.aligned)
    .filter((r) => intersects(r, crop));
  return { crop, redacted };
}
