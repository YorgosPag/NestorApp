/**
 * GAP-STEP PLACEMENT STORE — zero-React singleton (ADR-363 §neighbor-gap-step).
 *
 * **Κατάσταση για το «στρογγύλεμα του διάκενου προς τη μεριά κίνησης» (Giorgio 2026-07-02, επιλογή β).**
 * Όταν ένα ελεύθερο ghost κολόνας/πεδίλου αιωρείται κοντά σε γείτονες και ο χρήστης κρατά **Q**, το
 * βήμα (F9+Q) δεν στρογγυλοποιεί πλέον την απόσταση κέντρου-από-anchor (που άφηνε το εμφανιζόμενο
 * παρειά-προς-παρειά διάκενο με 3 δεκαδικά), αλλά **το ίδιο το διάκενο** προς τον γείτονα **στη μεριά
 * που κινείται ο κέρσορας** (Revit temporary-dimension snap).
 *
 * Κρατά δύο πράγματα, μηδέν React state (ADR-040):
 *   1. **moveDir** — η κατεύθυνση της τελευταίας μη-μηδενικής μετατόπισης του κέρσορα (sticky: σε
 *      ακινησία διατηρεί την προηγούμενη → σταθερή επιλογή ημιάξονα τη στιγμή του κλικ).
 *   2. **shift** — η μετατόπιση θέσης που υπολόγισε το **preview** αυτό το frame· το **commit**
 *      (`mouse-handler-up`) την προσθέτει αυτούσια → preview ≡ commit χωρίς να ξαναχτίζει footprint.
 *
 * Single-writer preview (`placement-ghost-assembly`), reader commit (`mouse-handler-up`). Καθαρίζει
 * on activate/deactivate του εργαλείου (fresh start).
 *
 * @see ../../bim/framing/neighbor-clearance-dims.ts — resolveGapStepShift (pure υπολογισμός)
 * @see ../../bim/placement/placement-ghost-assembly.ts — writer (preview)
 * @see ./mouse-handler-up.ts — reader (commit free branch)
 */

import type { Point2D } from '../../rendering/types/Types';

/** Κάτω από αυτό (scene units) η μετατόπιση θεωρείται ακινησία → κράτα το προηγούμενο moveDir (sticky). */
const MOVE_EPS = 1e-6;

let lastCenter: Point2D | null = null;
let moveDir: Point2D | null = null;
let shift: Point2D = { x: 0, y: 0 };

/** Preview — τροφοδότησε την τρέχουσα (pre-shift) θέση· ενημερώνει το moveDir (sticky σε ακινησία). */
export function trackGapPlacementCursor(center: Readonly<Point2D>): void {
  if (lastCenter) {
    const dx = center.x - lastCenter.x;
    const dy = center.y - lastCenter.y;
    if (Math.hypot(dx, dy) > MOVE_EPS) moveDir = { x: dx, y: dy };
  }
  lastCenter = { x: center.x, y: center.y };
}

/** Read — η κατεύθυνση της τελευταίας κίνησης (null πριν την 1η μετατόπιση). */
export function getGapPlacementMoveDir(): Point2D | null {
  return moveDir;
}

/** Preview — αποθήκευσε το shift που θα εφαρμόσει και το commit (κάθε frame, {0,0} όταν ανενεργό). */
export function setGapPlacementShift(next: Readonly<Point2D>): void {
  shift = { x: next.x, y: next.y };
}

/** Commit — το shift του τελευταίου preview frame (preview ≡ commit). {0,0} όταν όχι-Q / χωρίς γείτονα. */
export function getGapPlacementShift(): Point2D {
  return shift;
}

/** Clear — on activate/deactivate (μηδένισε κατεύθυνση + shift ώστε νέα κολόνα να ξεκινά καθαρή). */
export function clearGapPlacement(): void {
  lastCenter = null;
  moveDir = null;
  shift = { x: 0, y: 0 };
}
