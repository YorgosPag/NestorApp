/**
 * @fileoverview **ΤΟ ΚΟΙΝΟ ΠΛΑΙΣΙΟ ΤΟΥ ΘΕΑΤΗ** — πού κοιτάζει ο επισκέπτης, σε ποια κατεύθυνση είναι ο επόμενος κόμβος
 * (ADR-884 Φ1 · §4.8). Καθαρό: χωρίς three, χωρίς React.
 * @related `types/spatial-tour.ts` (`TourPoint` x=ανατολή · y=βορράς, μέτρα) ·
 *   `subapps/dxf-viewer/bim-3d/viewport/plan-to-world-math.ts` (ΙΔΙΟΙ άξονες κάτοψης — το BIM της Φ4 κουμπώνει χωρίς μετάφραση) ·
 *   `lib/geometry/angle.ts` (η ΜΙΑ περιτύλιξη γωνίας)
 * @module lib/spatial-tour/viewer/tour-viewer-bearing
 *
 * 🔑 **Τρεις γωνίες, ένα όνομα η καθεμία** (ακτίνια):
 * - **διόπτευση** (`bearing`): πυξίδα, δεξιόστροφα από τον **βορρά** της κάτοψης, `[0, 2π)`.
 * - **κατεύθυνση λήψης** (`headingRad`): η διόπτευση του **κέντρου** του πανοράματος — GPano `PoseHeadingDegrees`,
 *   αποθηκευμένη αυτούσια (η περιτύλιξη ανήκει **εδώ**, ADR-884 §4.5).
 * - **yaw**: στροφή του θεατή **μέσα** στο πανόραμα ως προς το κέντρο του, δεξιόστροφα θετική, `(-π, π]`.
 * Άρα `διόπτευση = heading + yaw` — και τίποτε άλλο δεν επιτρέπεται να το ξαναγράψει.
 */

import { normalizeAngleDiff, normalizeAngleRad } from '@/lib/geometry/angle';
import type { TourPoint } from '@/types/spatial-tour';

/** Κάτω από αυτή την απόσταση (μέτρα) δύο κόμβοι θεωρούνται ίδιο σημείο — η διόπτευσή τους δεν ορίζεται. */
const COINCIDENT_METRES = 1e-6;

/** Η διόπτευση από το `from` προς το `to` — `null` όταν συμπίπτουν (καμία κατεύθυνση να δειχθεί). */
export function bearingBetween(from: TourPoint, to: TourPoint): number | null {
  const east = to.x - from.x;
  const north = to.y - from.y;
  if (Math.hypot(east, north) < COINCIDENT_METRES) return null;
  return normalizeAngleRad(Math.atan2(east, north));
}

/** Πού κοιτάζει ο επισκέπτης στην κάτοψη — ο κώνος του mini-map. */
export function viewBearing(headingRad: number, yawRad: number): number {
  return normalizeAngleRad(headingRad + yawRad);
}

/**
 * Ποιο yaw μέσα στο πανόραμα κοιτάζει προς μια διόπτευση — θέση του κουμπιού συνδέσμου, και η κατεύθυνση άφιξης σε νέο
 * κόμβο (η **παγκόσμια** κατεύθυνση διατηρείται — πρότυπο Kuula walkthrough / PSV Virtual Tour).
 */
export function yawForBearing(headingRad: number, bearingRad: number): number {
  return normalizeAngleDiff(bearingRad - headingRad);
}

/**
 * Οριζόντιο οπτικό πεδίο από το κατακόρυφο (σύμβαση `PerspectiveCamera.fov`) και τον λόγο πλευρών — το άνοιγμα του κώνου.
 * Λόγος πλευρών μη θετικός ⇒ το κατακόρυφο (καλύτερο από NaN σε καμβά που δεν έχει ακόμη μέγεθος).
 */
export function horizontalFov(verticalFovRad: number, aspect: number): number {
  if (!(aspect > 0)) return verticalFovRad;
  return 2 * Math.atan(Math.tan(verticalFovRad / 2) * aspect);
}
