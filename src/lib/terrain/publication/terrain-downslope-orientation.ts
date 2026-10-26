/**
 * @fileoverview **Προς τα πού κατηφορίζει το οικόπεδο** — αζιμούθιο κατωφέρειας → ένας από τους ΟΚΤΩ προσανατολισμούς
 * του ενός λεξιλογίου (`Orientation`, ADR-920 Β4.9).
 * @related lib/terrain/publication/listing-terrain-types (`ListingTerrainStats.downslopeAzimuthDeg`) ·
 *   constants/property-features-enterprise (`Orientation` — η ρίζα του λεξιλογίου, κανένα δεύτερο σύνολο διευθύνσεων) ·
 *   components/listing-detail/terrain/TerrainStatsList (ο αναγνώστης)
 * @module lib/terrain/publication/terrain-downslope-orientation
 *
 * 🔑 Τομείς των 45°, κεντραρισμένοι στις οκτώ διευθύνσεις (ο «βόρειος» είναι 337,5° → 22,5°) — η σύμβαση κάθε πυξίδας.
 *    Το όριο ανήκει στον **επόμενο** τομέα κατά τη φορά του ρολογιού (22,5° ⇒ βορειοανατολικός), ώστε κάθε γωνία να έχει
 *    ακριβώς έναν τομέα.
 * 🔑 Επίπεδο έδαφος (`null`) ⇒ `null`: μια διεύθυνση εκεί θα ήταν θόρυβος που μοιάζει με γεγονός.
 */

import { Orientation, type OrientationType } from '@/constants/property-features-enterprise';
import { normalizeAngleDeg } from '@/lib/geometry/angle';

/** Οι οκτώ τομείς, από τον βορρά κατά τη φορά του ρολογιού — η σειρά που ορίζει το ίδιο το λεξιλόγιο. */
const SECTORS: readonly OrientationType[] = [
  Orientation.N, Orientation.NE, Orientation.E, Orientation.SE,
  Orientation.S, Orientation.SW, Orientation.W, Orientation.NW,
];

const SECTOR_DEG = 360 / SECTORS.length;

/** Αζιμούθιο σε μοίρες από τον βορρά (κατά τη φορά του ρολογιού) → ο προσανατολισμός του τομέα του, ή `null`. */
export function downslopeOrientationOf(azimuthDeg: number | null): OrientationType | null {
  if (azimuthDeg === null || !Number.isFinite(azimuthDeg)) return null;
  const normalized = normalizeAngleDeg(azimuthDeg);
  const sector = Math.floor((normalized + SECTOR_DEG / 2) / SECTOR_DEG) % SECTORS.length;
  return SECTORS[sector];
}
