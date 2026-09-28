/**
 * @fileoverview **ΜΕΓΕΘΥΝΣΗ ΤΗΣ ΚΑΤΟΨΗΣ** — ζουμ = στενότερο `viewBox`, ποτέ CSS `scale` (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 5). Καθαρό.
 * @related `lib/geometry/zoom-pan-math.ts` (ο ΕΝΑΣ τύπος «ζουμ γύρω από σημείο») · `tour-viewer-plan.ts` (`PlanFrame`) ·
 *   `components/spatial-tour/viewer/tour-plan-zoom-store.ts` (η κατάσταση ανά όροφο) · `TourPlanMap.tsx`
 * @module lib/spatial-tour/viewer/tour-plan-zoom
 *
 * 🔑 **Γιατί `viewBox` και όχι CSS `scale`**: με `scale` μεγαλώνουν **και** οι τελείες, ο κώνος και οι γραμμές — στο 5× μια
 *   τελεία 0,28 m θα σκέπαζε δωμάτιο. Με `viewBox` κλιμακώνεται **μόνο ο κόσμος**· τα σύμβολα ορίζονται σε **px** και μετατρέπονται
 *   με τα **μετρημένα** μέτρα ανά pixel ({@link planMetresPerPixel}) ⇒ ίδιο μέγεθος σε **κάθε ζουμ ΚΑΙ κάθε επιφάνεια**
 *   (κάρτα 280 px ή ανάπτυξη σε όλη την οθόνη) — όπως τα pins της Google Maps και οι τελείες της Zillow.
 *   ⚠️ Μετρημένο ζωντανά (2026-09-28): με «μέτρα ÷ ζουμ» οι τελείες έμεναν σταθερές στο ζουμ, αλλά στην ανάπτυξη ήταν
 *   **τριπλάσιες** από την κάρτα — η επιφάνεια είναι το ίδιο μέγεθος με το ζουμ, από την άλλη πλευρά.
 * 🔑 **Το κέντρο ζει σε μέτρα κάτοψης** και κόβεται σε **κάθε** ανάγνωση ({@link planViewBox}): ο όροφος μπορεί να αλλάξει
 *   κάδρο (ήρθε εικόνα κάτοψης) — ένα αποθηκευμένο κέντρο δεν οδηγεί ποτέ το παράθυρο έξω από την κάτοψη.
 * 📏 `preserveAspectRatio` = προεπιλογή (`xMidYMid meet`) ⇒ {@link clientToPlan} αντιστρέφει **αυτή** την απεικόνιση.
 */

import { clamp } from '@/lib/geometry/scalar';
import { clampZoom, scaleAbout, stepZoom, type Vec2, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

import type { PlanFrame } from './tour-viewer-plan';

/** 1× = όλη η κάτοψη· 5× = ένα δωμάτιο γεμίζει την κάρτα (Zillow: «− ●—— +»). */
export const PLAN_ZOOM_LIMITS: ZoomLimits = { min: 1, max: 5 };
/** Βήμα των κουμπιών − / + — πολλαπλασιαστικό: 1 → 5 σε 4 πατήματα. */
const PLAN_ZOOM_STEP_FACTOR = 1.5;
/** Ευαισθησία τροχού (ίδια τάξη με το `useZoomPan`, ADR-187). */
export const PLAN_WHEEL_SENSITIVITY = 0.002;

export interface PlanView {
  readonly zoom: number;
  /** Το κέντρο του παραθύρου σε μέτρα κάτοψης (συντεταγμένες SVG)· `null` = το κέντρο του κάδρου. */
  readonly centre: Vec2 | null;
}

export const PLAN_VIEW_FIT: PlanView = { zoom: 1, centre: null };

/** Το ορατό κουτί της κάρτας (`getBoundingClientRect`). */
interface PlanClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function frameCentre(frame: PlanFrame): Vec2 {
  return { x: frame.minX + frame.width / 2, y: frame.minY + frame.height / 2 };
}

/** Το κέντρο μέσα στα όρια: το παράθυρο δεν βγαίνει ποτέ έξω από την κάτοψη. */
function clampPlanCentre(frame: PlanFrame, zoom: number, centre: Vec2): Vec2 {
  const halfW = frame.width / (2 * zoom);
  const halfH = frame.height / (2 * zoom);
  return {
    x: clamp(centre.x, frame.minX + halfW, frame.minX + frame.width - halfW),
    y: clamp(centre.y, frame.minY + halfH, frame.minY + frame.height - halfH),
  };
}

/** Το `viewBox` για μια θέαση — πάντα μέσα στο κάδρο. */
export function planViewBox(frame: PlanFrame, view: PlanView): PlanFrame {
  const zoom = clampZoom(view.zoom, PLAN_ZOOM_LIMITS);
  const centre = clampPlanCentre(frame, zoom, view.centre ?? frameCentre(frame));
  const width = frame.width / zoom;
  const height = frame.height / zoom;
  return { minX: centre.x - width / 2, minY: centre.y - height / 2, width, height };
}

/** Πλάτος επιφάνειας (css px) όταν δεν έχει μετρηθεί ακόμη (SSR · jsdom) — το ιστορικό πλάτος της στήλης. */
export const PLAN_FALLBACK_SURFACE_PX = 400;

/**
 * **Μέτρα κάτοψης ανά css pixel** της επιφάνειας — με αυτό γίνονται μέτρα τα σύμβολα που ορίζονται σε px (τελείες · κώνος ·
 * γραμμές). Χωρίς μέτρηση: σαν να είχε η επιφάνεια το ιστορικό πλάτος της στήλης.
 */
export function planMetresPerPixel(box: PlanFrame, surface: { readonly width: number; readonly height: number }): number {
  if (surface.width > 0 && surface.height > 0) return planUnitsPerPixel(box, { left: 0, top: 0, ...surface });
  return box.width / PLAN_FALLBACK_SURFACE_PX;
}

/** Ζουμ γύρω από ένα σημείο της κάτοψης (δείκτης · κέντρο pinch): το σημείο μένει κάτω από το δάχτυλο. */
export function zoomPlanAt(frame: PlanFrame, view: PlanView, nextZoom: number, anchor: Vec2): PlanView {
  const box = planViewBox(frame, view);
  const prevZoom = frame.width / box.width;
  const zoom = clampZoom(nextZoom, PLAN_ZOOM_LIMITS);
  const centre = scaleAbout(frameCentre(box), anchor, prevZoom / zoom);
  return zoom === PLAN_ZOOM_LIMITS.min ? PLAN_VIEW_FIT : { zoom, centre: clampPlanCentre(frame, zoom, centre) };
}

/** Ζουμ γύρω από το κέντρο του παραθύρου (ρυθμιστικό · κουμπιά). */
export function zoomPlanTo(frame: PlanFrame, view: PlanView, nextZoom: number): PlanView {
  return zoomPlanAt(frame, view, nextZoom, frameCentre(planViewBox(frame, view)));
}

/** Ένα βήμα − / +. */
export function stepPlanZoom(frame: PlanFrame, view: PlanView, direction: 1 | -1): PlanView {
  return zoomPlanTo(frame, view, stepZoom(view.zoom, PLAN_ZOOM_LIMITS, direction, { factor: PLAN_ZOOM_STEP_FACTOR }));
}

/** Μετατόπιση κατά `delta` μέτρα κάτοψης (σύρσιμο: ο κόσμος ακολουθεί το δάχτυλο ⇒ το κέντρο κινείται αντίθετα). */
export function panPlanBy(frame: PlanFrame, view: PlanView, delta: Vec2): PlanView {
  const box = planViewBox(frame, view);
  const centre = { x: box.minX + box.width / 2 - delta.x, y: box.minY + box.height / 2 - delta.y };
  return { zoom: view.zoom, centre: clampPlanCentre(frame, clampZoom(view.zoom, PLAN_ZOOM_LIMITS), centre) };
}

/** Μέτρα κάτοψης ανά css px της κάρτας (`xMidYMid meet`). */
export function planUnitsPerPixel(box: PlanFrame, rect: PlanClientRect): number {
  const scale = Math.min(rect.width / box.width, rect.height / box.height);
  return scale > 0 ? 1 / scale : 0;
}

/** Σημείο οθόνης → σημείο κάτοψης, με το ίδιο `meet` που εφαρμόζει ο browser (κεντραρισμένο, με περιθώρια). */
export function clientToPlan(box: PlanFrame, rect: PlanClientRect, clientX: number, clientY: number): Vec2 {
  const unit = planUnitsPerPixel(box, rect);
  if (unit === 0) return frameCentre(box);
  const offsetX = (rect.width - box.width / unit) / 2;
  const offsetY = (rect.height - box.height / unit) / 2;
  return { x: box.minX + (clientX - rect.left - offsetX) * unit, y: box.minY + (clientY - rect.top - offsetY) * unit };
}
