/**
 * ADR-929 Φ5.3β — οι **χειρονομίες** πάνω στην όψη (σύρσιμο, αλλαγή μεγέθους, σχεδίαση νέας περιοχής) ως καθαρή
 * κατάσταση: τι δείχνει το φάντασμα όσο σέρνεις, και ποια **μία** νέα όψη γράφεται στο άφημα. Το φύλλο του καμβά μόνο
 * μεταφράζει δείκτη → aligned px και καλεί αυτά.
 *
 * 🔑 Κατά τη διάρκεια της χειρονομίας **καμία** εγγραφή στο store (ADR-040: όχι ανά καρέ). Στο άφημα **μία** `edit`.
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 */

import type { PlanePoint } from '@/lib/geometry/homography';
import type { AlignedRectPx } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanReadingView } from '../../bim/plan-recognition/reading/plan-reading-view';
import {
  addRedaction,
  intersectRect,
  moveRect,
  READING_VIEW_MIN_SIDE_PX,
  rectFromCorners,
  resizeRect,
  setCrop,
  setRedaction,
  type AlignedImageSize,
  type RectHandle,
} from '../../bim/plan-recognition/reading/plan-reading-view-edit';

/** Τι πιάνει ο άνθρωπος: το crop ή μία περιοχή απόκρυψης (με τη θέση της). */
export type ViewTarget = { readonly kind: 'crop' } | { readonly kind: 'redaction'; readonly index: number };

export type ViewGesture =
  | { readonly mode: 'move'; readonly target: ViewTarget; readonly start: PlanePoint; readonly origin: AlignedRectPx; readonly current: AlignedRectPx }
  | { readonly mode: 'resize'; readonly target: ViewTarget; readonly handle: RectHandle; readonly origin: AlignedRectPx; readonly current: AlignedRectPx }
  | { readonly mode: 'draw'; readonly start: PlanePoint; readonly current: AlignedRectPx };

export const imageBounds = (size: AlignedImageSize): AlignedRectPx => ({ minX: 0, minY: 0, maxX: size.width, maxY: size.height });

export function targetRect(view: PlanReadingView, target: ViewTarget): AlignedRectPx | null {
  return target.kind === 'crop' ? view.crop : view.redacted[target.index] ?? null;
}

/** Το crop κινείται μέσα στην εικόνα· μια περιοχή μέσα στο crop. */
function boundsOf(view: PlanReadingView, target: ViewTarget, size: AlignedImageSize): AlignedRectPx {
  return target.kind === 'crop' ? imageBounds(size) : view.crop;
}

/** Νέα θέση της χειρονομίας για το σημείο `p` του δείκτη (aligned px). */
export function advanceGesture(gesture: ViewGesture, p: PlanePoint, view: PlanReadingView, size: AlignedImageSize): ViewGesture {
  switch (gesture.mode) {
    case 'move': {
      const bounds = boundsOf(view, gesture.target, size);
      return { ...gesture, current: moveRect(gesture.origin, p.x - gesture.start.x, p.y - gesture.start.y, bounds) };
    }
    case 'resize':
      return { ...gesture, current: resizeRect(gesture.origin, gesture.handle, p, boundsOf(view, gesture.target, size)) };
    case 'draw':
      return { ...gesture, current: intersectRect(rectFromCorners(gesture.start, p), view.crop) ?? gesture.current };
  }
}

/** Η όψη όπως φαίνεται **τώρα** (φάντασμα): η τρέχουσα θέση της χειρονομίας πάνω στην όψη του store. */
export function previewView(view: PlanReadingView, gesture: ViewGesture | null): PlanReadingView {
  if (!gesture) return view;
  if (gesture.mode === 'draw') return { crop: view.crop, redacted: [...view.redacted, gesture.current] };
  if (gesture.target.kind === 'crop') return { crop: gesture.current, redacted: view.redacted };
  const index = gesture.target.index;
  return { crop: view.crop, redacted: view.redacted.map((r, i) => (i === index ? gesture.current : r)) };
}

const tooSmall = (r: AlignedRectPx): boolean =>
  r.maxX - r.minX < READING_VIEW_MIN_SIDE_PX || r.maxY - r.minY < READING_VIEW_MIN_SIDE_PX;

/**
 * Η **μία** νέα όψη του αφήματος, ή `null` όταν τίποτα δεν άλλαξε (κλικ χωρίς σύρσιμο · σχεδίαση πολύ μικρή · γεμάτο όριο
 * περιοχών).
 */
export function commitGesture(view: PlanReadingView, gesture: ViewGesture, size: AlignedImageSize): PlanReadingView | null {
  if (gesture.mode === 'draw') return tooSmall(gesture.current) ? null : addRedaction(view, gesture.current);
  const unchanged = (['minX', 'minY', 'maxX', 'maxY'] as const).every((k) => gesture.current[k] === gesture.origin[k]);
  if (unchanged) return null;
  return gesture.target.kind === 'crop'
    ? setCrop(view, gesture.current, size)
    : setRedaction(view, gesture.target.index, gesture.current);
}
