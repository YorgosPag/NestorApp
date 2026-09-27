/**
 * @fileoverview **ΤΟ ΒΕΛΑΚΙ ΣΤΟ ΠΑΤΩΜΑ** — πού κάθεται και προς τα πού δείχνει στην οθόνη (ADR-884 Φ2στ · §4.12). Καθαρό.
 * @related `components/spatial-tour/viewer/TourPanoramaStage.tsx` (`usePlaceLinkButtons` — γράφει τη θέση ανά καρέ) ·
 *   `TourLinkButton.tsx` (το σεβρόν διαβάζει τη γωνία από τη μεταβλητή `--tour-arrow-turn`)
 * @module lib/spatial-tour/viewer/tour-floor-arrow
 *
 * 🏆 **Όπως η Zillow 3D Home**: βελάκια-ελλείψεις **ξαπλωμένα στο πάτωμα**, με το σεβρόν να δείχνει την κατεύθυνση.
 * 🔑 **Η κατεύθυνση ΜΕΤΡΙΕΤΑΙ, δεν υποτίθεται**: προβάλλονται δύο σημεία της **ίδιας** διόπτευσης στο πάτωμα — το βελάκι
 *   (`FLOOR_ARROW_PITCH`) και ένα πιο μακριά (`FLOOR_ARROW_AHEAD_PITCH`, πιο κοντά στον ορίζοντα). Το διάνυσμα οθόνης
 *   ανάμεσά τους ΕΙΝΑΙ ο δρόμος όπως τον βλέπει το μάτι: στο κέντρο δείχνει «μπροστά», στις άκρες γέρνει προς το σημείο
 *   φυγής — η προοπτική βγαίνει από την ίδια την προβολή, χωρίς δεύτερο μοντέλο κάμερας.
 */

import { degToRad, radToDeg } from '@/lib/geometry/angle';

/** Το βελάκι κάθεται λίγο κάτω από τον ορίζοντα — «στο πάτωμα», όπως οι κύκλοι της Matterport / Zillow. */
export const FLOOR_ARROW_PITCH = degToRad(-18);
/** Ένα σημείο πιο μακριά στην ίδια διόπτευση (πιο κοντά στον ορίζοντα) — ορίζει την κατεύθυνση στην οθόνη. */
export const FLOOR_ARROW_AHEAD_PITCH = degToRad(-12);

export interface ScreenPoint2 {
  readonly x: number;
  readonly y: number;
}

/**
 * **Προς τα πού δείχνει το σεβρόν**, σε μοίρες δεξιόστροφα από το «πάνω» της οθόνης (0 = ευθεία μπροστά). Χωρίς δεύτερο
 * σημείο (εκτός κάδρου) ή με σημεία που συμπίπτουν ⇒ 0: «μπροστά» είναι η ασφαλής ανάγνωση.
 */
export function floorArrowTurnDeg(at: ScreenPoint2, ahead: ScreenPoint2 | null): number {
  if (ahead === null) return 0;
  const dx = ahead.x - at.x;
  const dy = ahead.y - at.y;
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  // Οθόνη: y προς τα κάτω ⇒ «πάνω» = −y. atan2(dx, −dy): 0 πάνω, 90 δεξιά, −90 αριστερά.
  return radToDeg(Math.atan2(dx, -dy));
}
