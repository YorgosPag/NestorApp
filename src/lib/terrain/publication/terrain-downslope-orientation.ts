/**
 * @fileoverview **Προς τα πού κατηφορίζει το οικόπεδο** — αζιμούθιο κατωφέρειας → ένας από τους ΟΚΤΩ προσανατολισμούς
 * του ενός λεξιλογίου (`Orientation`, ADR-920 Β4.9).
 * @related lib/terrain/publication/listing-terrain-types (`ListingTerrainStats.downslopeAzimuthDeg`) ·
 *   lib/geometry/azimuth-orientation (ο πυρήνας — ADR-937 Φάση 0) ·
 *   components/listing-detail/terrain/TerrainStatsList (ο αναγνώστης)
 * @module lib/terrain/publication/terrain-downslope-orientation
 *
 * 🔑 Οι τομείς και τα όριά τους ζουν πλέον στο `orientationOfAzimuth` (ένας κάτοχος)· εδώ μένει μόνο το νόημα τομέα.
 * 🔑 Επίπεδο έδαφος (`null`) ⇒ `null`: μια διεύθυνση εκεί θα ήταν θόρυβος που μοιάζει με γεγονός.
 */

import type { OrientationType } from '@/constants/property-features-enterprise';
import { orientationOfAzimuth } from '@/lib/geometry/azimuth-orientation';

/** Αζιμούθιο σε μοίρες από τον βορρά (κατά τη φορά του ρολογιού) → ο προσανατολισμός του τομέα του, ή `null`. */
export function downslopeOrientationOf(azimuthDeg: number | null): OrientationType | null {
  return orientationOfAzimuth(azimuthDeg);
}
