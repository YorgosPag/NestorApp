/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΤΗΣ ΚΑΤΟΨΗΣ** — pixel της εικόνας ⟷ μέτρα κάτοψης, ξανακλιμάκωση, και η **πρόταση
 * προσανατολισμού** μιας λήψης από τα βελάκια της (ADR-884 Φ2στ-β · §4.13). Καθαρό.
 * @related `types/spatial-tour.ts` (`FloorPlanRecord.image/scale`, `TourPoint`) · `viewer/tour-viewer-bearing.ts` (οι γωνίες) ·
 *   `viewer/tour-viewer-plan.ts` (`toPlanSvg` — ίδιοι άξονες) · `tour-plan-edit.ts` (οι εντολές)
 * @module lib/spatial-tour/tour-plan-frame
 *
 * 📏 **«Πάνω στην εικόνα» = βορράς του πλαισίου** (όπως Kuula/3DVista): η αρχή είναι η πάνω-αριστερή γωνία της εικόνας,
 *   `x = px · mpp` (ανατολή), `y = −py · mpp` (βορράς). Άρα `toPlanSvg` δίνει **ακριβώς** `(px·mpp, py·mpp)` — η εικόνα
 *   μπαίνει στο SVG στο `(0, 0)` με πλάτος `w·mpp`, χωρίς κανέναν δεύτερο μετασχηματισμό.
 * 🏆 **Πρόταση προσανατολισμού** (η 3DVista θέλει χειροκίνητη πυξίδα): το βελάκι Α→Β που έβαλε ο άνθρωπος **μέσα στη
 *   φωτογραφία** κάθεται σε yaw = `bearingRad − heading`. Όταν Α και Β έχουν θέση, η αληθινή διόπτευση είναι
 *   `bearingBetween(Α, Β)` ⇒ `heading = διόπτευση − yaw`. Με ≥ 2 βελάκια: κυκλικός μέσος, και η **διασπορά** λέει πόσο
 *   συμφωνούν (μεγάλη διασπορά = κάποιο βελάκι ή κάποια θέση είναι λάθος — η οθόνη το λέει, δεν το κρύβει).
 */

import { normalizeAngleDiff, normalizeAngleRad } from '@/lib/geometry/angle';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { PixelPoint } from '@/lib/geometry/scale-calibration';
import type { FloorPlanImage, FloorPlanRecord, TourLevel, TourNode, TourPoint } from '@/types/spatial-tour';

import { bearingBetween } from './viewer/tour-viewer-bearing';

/** Η **ενεργή** κάτοψη ενός ορόφου (αναλλοίωτο #4: ακριβώς μία). */
export function activeFloorPlan(level: Pick<TourLevel, 'floorPlans'>): FloorPlanRecord | null {
  return level.floorPlans.find((plan) => plan.state === 'active') ?? null;
}

/** Κάτοψη με εικόνα **και** κλίμακα — η μόνη πάνω στην οποία τοποθετούνται σημεία. */
export interface CalibratedPlan {
  readonly image: FloorPlanImage;
  readonly metresPerPixel: number;
}

export function calibratedPlan(plan: FloorPlanRecord | null): CalibratedPlan | null {
  if (plan?.image == null || plan.scale == null) return null;
  return { image: plan.image, metresPerPixel: plan.scale.metresPerPixel };
}

export function imagePixelToPlan(pixel: PixelPoint, metresPerPixel: number): TourPoint {
  return { x: pixel.x * metresPerPixel, y: -pixel.y * metresPerPixel, z: 0 };
}

export function planToImagePixel(point: PlanarPoint, metresPerPixel: number): PixelPoint {
  return { x: point.x / metresPerPixel, y: -point.y / metresPerPixel };
}

/** Πέφτει το σημείο **πάνω** στην εικόνα; (με ανοχή μισού pixel — το κλικ στην άκρη είναι στην κάτοψη). */
export function isOnPlan(point: PlanarPoint, plan: CalibratedPlan): boolean {
  const { x, y } = planToImagePixel(point, plan.metresPerPixel);
  return x >= -0.5 && y >= -0.5 && x <= plan.image.width + 0.5 && y <= plan.image.height + 0.5;
}

/**
 * **Ξανακλιμάκωση** μιας θέσης όταν αλλάζει η κλίμακα: η τελεία μένει στο **ίδιο pixel** της εικόνας (εκεί την έβαλε ο
 * άνθρωπος) — αλλάζουν μόνο τα μέτρα της. **Ένα** SSoT για θέσεις σημείων (`TourPoint`, το `z` μένει) **και** κορυφές χώρων /
 * άκρα νοητών γραμμών (`PlanarPoint`, Γ3β).
 */
export function rescalePoint<P extends PlanarPoint>(point: P, fromMetresPerPixel: number, toMetresPerPixel: number): P {
  const ratio = toMetresPerPixel / fromMetresPerPixel;
  return { ...point, x: point.x * ratio, y: point.y * ratio };
}

export interface HeadingSuggestion {
  readonly headingRad: number;
  /** Πόσα βελάκια συμφώνησαν στην πρόταση. */
  readonly samples: number;
  /** Η μεγαλύτερη απόκλιση ενός βελακιού από την πρόταση (ακτίνια) — 0 με ένα βελάκι. */
  readonly spreadRad: number;
}

/** Οι υποψήφιες κατευθύνσεις λήψης — μία ανά βελάκι προς γείτονα με θέση. */
function headingCandidates(node: TourNode, headingRad: number, nodes: readonly TourNode[]): number[] {
  if (node.position === null) return [];
  const from = node.position;
  return node.links.flatMap((link) => {
    const to = nodes.find((other) => other.id === link.toNodeId)?.position ?? null;
    const truth = to === null ? null : bearingBetween(from, to);
    if (link.bearingRad === null || truth === null) return [];
    const yaw = link.bearingRad - headingRad;
    return [normalizeAngleRad(truth - yaw)];
  });
}

/**
 * **Προτεινόμενη κατεύθυνση λήψης** του `node` (η κατεύθυνση της λήψης του σήμερα: `headingRad`) — `null` όταν κανένα
 * βελάκι δεν δείχνει σε γείτονα με θέση (τίποτα να συμπεράνουμε· ποτέ μαντεψιά).
 */
export function suggestHeading(node: TourNode, headingRad: number, nodes: readonly TourNode[]): HeadingSuggestion | null {
  const candidates = headingCandidates(node, headingRad, nodes);
  if (candidates.length === 0) return null;
  const mean = normalizeAngleRad(Math.atan2(
    candidates.reduce((sum, a) => sum + Math.sin(a), 0),
    candidates.reduce((sum, a) => sum + Math.cos(a), 0),
  ));
  const spreadRad = Math.max(...candidates.map((a) => Math.abs(normalizeAngleDiff(a - mean))));
  return { headingRad: mean, samples: candidates.length, spreadRad };
}
