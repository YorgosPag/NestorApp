/**
 * **Η επεξεργασία της όψης** που στέλνεται στον αναγνώστη (ADR-929 Φ5.3β, Δ15 #4): καθαρές πράξεις πάνω σε
 * {@link PlanReadingView}, στον χώρο της **ευθυγραμμισμένης** εικόνας (aligned px), ο ίδιος χώρος που καταλαβαίνουν το
 * `renderReadingViewRaster` και το `viewSegmentsOf`. Καμία δεύτερη αναπαράσταση της όψης.
 *
 * 🔑 **Πλήρης επεξεργασία, πέρα από το Acrobat**: crop με 8 λαβές· περιοχές απόκρυψης με σύρσιμο, αλλαγή μεγέθους (8
 *   λαβές), προσθήκη και σβήσιμο. Το Acrobat κρατά τα σημάδια επεξεργάσιμα ως το «Apply» αλλά **χωρίς** αλλαγή μεγέθους.
 * 🔑 **Ακέραια pixel, προς την ασφάλεια.** Το crop στρογγυλεύεται (το `assertReadingView` απαιτεί ακέραια όρια)· οι περιοχές
 *   απόκρυψης **μεγαλώνουν** στο επόμενο ακέραιο (κάτω όριο `floor`, πάνω `ceil`): καλύτερα ένα pixel χαρτί παραπάνω από
 *   ένα γράμμα της πινακίδας. Ίδια όψη ⇒ ίδια bytes ⇒ ίδιο hash (κρυφή μνήμη Δ11).
 * 🔑 Όταν μια λαβή περάσει την απέναντι πλευρά, το ορθογώνιο **αναποδογυρίζει** (Figma), δεν «κολλά».
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-view-edit
 */

import type { PlanePoint } from '@/lib/geometry/homography';
import type { AlignedRectPx } from '../alignment/plan-alignment-types';
import { PLAN_READING_MAX_REDACTIONS } from './plan-reading-contract';
import type { PlanReadingView } from './plan-reading-view';

/** Οι 8 λαβές ενός ορθογωνίου: γωνίες και μέσα πλευρών. */
export type RectHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const RECT_HANDLES: readonly RectHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Ελάχιστη πλευρά (aligned px): μια περιοχή μικρότερη δεν κρύβει τίποτα και δεν πιάνεται με το ποντίκι. */
export const READING_VIEW_MIN_SIDE_PX = 4;

/** Το μέγεθος της ευθυγραμμισμένης εικόνας: το εξωτερικό όριο κάθε crop. */
export interface AlignedImageSize {
  readonly width: number;
  readonly height: number;
}

const imageRect = (size: AlignedImageSize): AlignedRectPx => ({ minX: 0, minY: 0, maxX: size.width, maxY: size.height });

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Ορθογώνιο από δύο οποιαδήποτε σημεία (η σειρά δεν έχει σημασία). */
export function rectFromCorners(a: PlanePoint, b: PlanePoint): AlignedRectPx {
  return { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
}

/** Τομή· `null` όταν δεν μένει εμβαδόν. */
export function intersectRect(a: AlignedRectPx, b: AlignedRectPx): AlignedRectPx | null {
  const r = { minX: Math.max(a.minX, b.minX), minY: Math.max(a.minY, b.minY), maxX: Math.min(a.maxX, b.maxX), maxY: Math.min(a.maxY, b.maxY) };
  return r.maxX > r.minX && r.maxY > r.minY ? r : null;
}

/** Μετακίνηση κατά (dx, dy), ολόκληρο μέσα στο `bounds` (σπρώχνεται πίσω, δεν κόβεται). */
export function moveRect(r: AlignedRectPx, dx: number, dy: number, bounds: AlignedRectPx): AlignedRectPx {
  const w = r.maxX - r.minX;
  const h = r.maxY - r.minY;
  const minX = clamp(r.minX + dx, bounds.minX, Math.max(bounds.minX, bounds.maxX - w));
  const minY = clamp(r.minY + dy, bounds.minY, Math.max(bounds.minY, bounds.maxY - h));
  return { minX, minY, maxX: Math.min(bounds.maxX, minX + w), maxY: Math.min(bounds.maxY, minY + h) };
}

/**
 * Η λαβή πηγαίνει στο σημείο `p`· η απέναντι πλευρά/γωνία μένει. Μέσα στο `bounds`, με ελάχιστη πλευρά. Αν η λαβή περάσει
 * την απέναντι πλευρά, το ορθογώνιο αναποδογυρίζει.
 */
export function resizeRect(r: AlignedRectPx, handle: RectHandle, p: PlanePoint, bounds: AlignedRectPx): AlignedRectPx {
  const x = clamp(p.x, bounds.minX, bounds.maxX);
  const y = clamp(p.y, bounds.minY, bounds.maxY);
  const moved = {
    x0: handle.includes('w') ? x : r.minX,
    x1: handle.includes('e') ? x : r.maxX,
    y0: handle.includes('n') ? y : r.minY,
    y1: handle.includes('s') ? y : r.maxY,
  };
  return withMinSide(rectFromCorners({ x: moved.x0, y: moved.y0 }, { x: moved.x1, y: moved.y1 }), bounds);
}

/** Μεγαλώνει ό,τι είναι στενότερο από το ελάχιστο, προς τα μέσα του `bounds`. */
function withMinSide(r: AlignedRectPx, bounds: AlignedRectPx): AlignedRectPx {
  const grow = (lo: number, hi: number, bLo: number, bHi: number): [number, number] => {
    if (hi - lo >= READING_VIEW_MIN_SIDE_PX) return [lo, hi];
    const nextHi = Math.min(bHi, lo + READING_VIEW_MIN_SIDE_PX);
    return [Math.max(bLo, nextHi - READING_VIEW_MIN_SIDE_PX), nextHi];
  };
  const [minX, maxX] = grow(r.minX, r.maxX, bounds.minX, bounds.maxX);
  const [minY, maxY] = grow(r.minY, r.maxY, bounds.minY, bounds.maxY);
  return { minX, minY, maxX, maxY };
}

/** Crop σε ακέραια pixel μέσα στην εικόνα (στρογγύλευση στο πλησιέστερο, ώστε το σύρσιμο να «ακολουθεί» το ποντίκι). */
function snapCrop(r: AlignedRectPx, size: AlignedImageSize): AlignedRectPx {
  const snapped = {
    minX: clamp(Math.round(r.minX), 0, size.width),
    minY: clamp(Math.round(r.minY), 0, size.height),
    maxX: clamp(Math.round(r.maxX), 0, size.width),
    maxY: clamp(Math.round(r.maxY), 0, size.height),
  };
  return withMinSide(snapped, imageRect(size));
}

/** Περιοχή απόκρυψης σε ακέραια pixel, **προς τα έξω** (προς την ασφάλεια), κομμένη στο crop. */
function snapRedaction(r: AlignedRectPx, crop: AlignedRectPx): AlignedRectPx | null {
  const outward = { minX: Math.floor(r.minX), minY: Math.floor(r.minY), maxX: Math.ceil(r.maxX), maxY: Math.ceil(r.maxY) };
  return intersectRect(outward, crop);
}

/**
 * Νέο crop. Οι περιοχές απόκρυψης κόβονται στο νέο crop· όσες μείνουν ολόκληρες έξω **σβήνονται** (δεν υπάρχει τίποτα να
 * κρύψουν: ό,τι είναι έξω από το crop δεν φεύγει ούτως ή άλλως).
 */
export function setCrop(view: PlanReadingView, crop: AlignedRectPx, size: AlignedImageSize): PlanReadingView {
  const next = snapCrop(crop, size);
  const redacted = view.redacted.flatMap((r) => {
    const kept = snapRedaction(r, next);
    return kept ? [kept] : [];
  });
  return { crop: next, redacted };
}

/** Αντικατάσταση μιας περιοχής (σύρσιμο / αλλαγή μεγέθους)· έξω από το crop ⇒ σβήνεται. */
export function setRedaction(view: PlanReadingView, index: number, rect: AlignedRectPx): PlanReadingView {
  if (index < 0 || index >= view.redacted.length) return view;
  const kept = snapRedaction(rect, view.crop);
  const redacted = view.redacted.flatMap((r, i) => (i !== index ? [r] : kept ? [kept] : []));
  return { crop: view.crop, redacted };
}

/** Νέα περιοχή· `null` όταν δεν χωρά (όριο του συμβολαίου) ή πέφτει ολόκληρη έξω από το crop. */
export function addRedaction(view: PlanReadingView, rect: AlignedRectPx): PlanReadingView | null {
  if (view.redacted.length >= PLAN_READING_MAX_REDACTIONS) return null;
  const kept = snapRedaction(withMinSide(rect, view.crop), view.crop);
  return kept ? { crop: view.crop, redacted: [...view.redacted, kept] } : null;
}

export function removeRedaction(view: PlanReadingView, index: number): PlanReadingView {
  if (index < 0 || index >= view.redacted.length) return view;
  return { crop: view.crop, redacted: view.redacted.filter((_, i) => i !== index) };
}

/** Σταθερό κλειδί της όψης: «είναι αυτή η ίδια όψη με εκείνη που ετοιμάστηκε για αποστολή;». */
export function readingViewKey(view: PlanReadingView): string {
  const rect = (r: AlignedRectPx): string => `${r.minX},${r.minY},${r.maxX},${r.maxY}`;
  return [rect(view.crop), ...view.redacted.map(rect)].join('|');
}
