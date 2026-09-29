/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΤΟΥ MINI-MAP** — από μέτρα κάτοψης σε συντεταγμένες SVG, βόρεια-πάνω (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `tour-viewer-bearing.ts` (ίδιοι άξονες) · `components/spatial-tour/viewer/TourPlanMap.tsx`
 * @module lib/spatial-tour/viewer/tour-viewer-plan
 *
 * 📏 **Βόρεια-πάνω, όπως η Zillow** (και το PSV Map με `static: true`): η κάτοψη μένει ακίνητη και **στρέφεται ο κώνος**.
 *   Ο αγοραστής διαβάζει την κάτοψη όπως στο χαρτί· ένας χάρτης που γυρίζει κάτω από το δάχτυλο χάνει τον προσανατολισμό.
 * 🔑 SVG: `x = ανατολή`, `y = −βορράς` (το SVG μεγαλώνει προς τα κάτω). Μια περιστροφή SVG `rotate(θ)` είναι δεξιόστροφη
 *   στην οθόνη ⇒ ο κώνος που δείχνει «πάνω» στρέφεται **ακριβώς** κατά τη διόπτευση σε μοίρες — χωρίς πρόσημο να ξεχαστεί.
 */

import type { TourPoint } from '@/types/spatial-tour';

import type { TourViewerGraph, ViewerLevelEntry, ViewerStop } from './tour-viewer-graph';

/** Ακτίνα του κώνου θέασης (μέτρα κάτοψης). */
export const PLAN_CONE_RADIUS_M = 1.4;
/**
 * Περιθώριο γύρω από τους κόμβους (μέτρα) — **παράγεται** από την ακτίνα του κώνου: μετρημένο ζωντανά 2026-09-27, με
 * χειρόγραφο 1,5 m και κώνο 1,6 m ο κώνος κοβόταν στην άκρη όταν ο επισκέπτης στεκόταν σε γωνιακό κόμβο.
 */
export const PLAN_PADDING_M = PLAN_CONE_RADIUS_M + 0.2;
/** Ελάχιστη πλευρά κάδρου (μέτρα) — ένας μόνος κόμβος δεν γίνεται κουκκίδα σε όλη την οθόνη. */
export const PLAN_MIN_SPAN_M = 6;

export interface PlanFrame {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export function toPlanSvg(point: TourPoint): { readonly x: number; readonly y: number } {
  return { x: point.x, y: -point.y };
}

/** Το αντίστροφο του {@link toPlanSvg}: σημείο του SVG (π.χ. από `clientToPlan`) ⇒ μέτρα κάτοψης (y βορράς). */
export function fromPlanSvg(point: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  return { x: point.x, y: -point.y };
}

function spanOf(min: number, max: number): { readonly min: number; readonly span: number } {
  const span = Math.max(PLAN_MIN_SPAN_M, max - min + 2 * PLAN_PADDING_M);
  return { min: (min + max) / 2 - span / 2, span };
}

/** Το κάδρο (`viewBox`) που χωρά όλους τους κόμβους ενός ορόφου — `null` χωρίς κανέναν κόμβο με θέση. */
export function planFrame(points: readonly TourPoint[]): PlanFrame | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => toPlanSvg(p).x);
  const ys = points.map((p) => toPlanSvg(p).y);
  const x = spanOf(Math.min(...xs), Math.max(...xs));
  const y = spanOf(Math.min(...ys), Math.max(...ys));
  return { minX: x.min, minY: y.min, width: x.span, height: y.span };
}

/**
 * **Το κάδρο μιας εικόνας κάτοψης** (ADR-884 Φ2στ-β · §4.13): όλη η εικόνα, σε μέτρα όταν είναι βαθμονομημένη — αλλιώς σε
 * pixel (τότε δεν υπάρχουν τελείες, μόνο η εικόνα). Αρχή = πάνω-αριστερή γωνία, άρα `toPlanSvg` δεν θέλει μετατόπιση.
 */
export function imagePlanFrame(image: { readonly width: number; readonly height: number }, metresPerPixel: number | null): PlanFrame {
  const unit = metresPerPixel ?? 1;
  return { minX: 0, minY: 0, width: image.width * unit, height: image.height * unit };
}

/** Ο κώνος θέασης ως διαδρομή SVG με κορυφή στο `(0, 0)`, ανοιχτός προς τα **πάνω** (βορράς), πριν την περιστροφή. */
export function conePath(halfAngleRad: number, radius: number): string {
  const dx = Math.sin(halfAngleRad) * radius;
  const dy = -Math.cos(halfAngleRad) * radius;
  return `M 0 0 L ${-dx} ${dy} A ${radius} ${radius} 0 0 1 ${dx} ${dy} Z`;
}

/** Μια στάση του ορόφου **με θέση** στην κάτοψη. */
export interface PlacedStop {
  readonly entry: ViewerStop;
  readonly point: TourPoint;
}

/** Οι στάσεις του ορόφου που έχουν θέση — με τη σειρά του ορόφου. */
export function placedStops(graph: TourViewerGraph, level: ViewerLevelEntry): PlacedStop[] {
  return level.nodeIds.flatMap((id) => {
    const entry = graph.stops.get(id);
    const point = entry?.node.position ?? null;
    return entry !== undefined && point !== null ? [{ entry, point }] : [];
  });
}

/**
 * **Το κάδρο ενός ορόφου** — η εικόνα της κάτοψης όταν δείχνεται, αλλιώς όσο χρειάζεται για τις τελείες. Ένα σημείο
 * απόφασης για τον χάρτη **και** για τη μεγέθυνσή του (ADR-884 Φ2στ-γ Γ2): το ζουμ υπολογίζεται πάνω στο ίδιο κάδρο που
 * ζωγραφίζεται.
 */
export function levelPlanFrame(level: ViewerLevelEntry, stops: readonly PlacedStop[], showsImage: boolean): PlanFrame | null {
  if (level.plan !== null && showsImage) return imagePlanFrame(level.plan.image, level.plan.metresPerPixel);
  return planFrame(stops.map((s) => s.point));
}
