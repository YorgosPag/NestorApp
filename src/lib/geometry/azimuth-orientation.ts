/**
 * @fileoverview **ΑΖΙΜΟΥΘΙΟ ↔ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ (SSoT)** — γωνία από τον Βορρά ⇄ ένας από τους ΟΚΤΩ προσανατολισμούς του
 * ενός λεξιλογίου (`Orientation`).
 * @related ADR-937 · ADR-920 Β4.9 (κατωφέρεια οικοπέδου — πρώτος καταναλωτής) ·
 *   constants/property-features-enterprise (`Orientation` — η ρίζα, κανένα δεύτερο σύνολο διευθύνσεων)
 * @module lib/geometry/azimuth-orientation
 *
 * Ο πυρήνας ζούσε μέσα στο `lib/terrain/publication/terrain-downslope-orientation.ts`. Προωθήθηκε εδώ επειδή τον
 * χρειάζονται πλέον και ο ηλιασμός της αγγελίας και η πρόταση προσανατολισμού από κάτοψη/χάρτη.
 *
 * 🔑 Σύμβαση: 0° = Βορράς, κατά τη φορά του ρολογιού. Τομείς των 45°, κεντραρισμένοι στις οκτώ διευθύνσεις (ο «βόρειος»
 *    είναι 337,5° → 22,5°). Το όριο ανήκει στον **επόμενο** τομέα κατά τη φορά του ρολογιού (22,5° ⇒ βορειοανατολικός),
 *    ώστε κάθε γωνία να έχει ακριβώς έναν τομέα.
 */

import { Orientation, type OrientationType } from '@/constants/property-features-enterprise';
import { normalizeAngleDeg } from '@/lib/geometry/angle';

/** Οι οκτώ τομείς, από τον βορρά κατά τη φορά του ρολογιού. */
const SECTORS: readonly OrientationType[] = [
  Orientation.N, Orientation.NE, Orientation.E, Orientation.SE,
  Orientation.S, Orientation.SW, Orientation.W, Orientation.NW,
];

const SECTOR_DEG = 360 / SECTORS.length;

/** Αζιμούθιο (μοίρες από τον βορρά, δεξιόστροφα) → ο προσανατολισμός του τομέα του, ή `null` αν δεν είναι πεπερασμένο. */
export function orientationOfAzimuth(azimuthDeg: number | null): OrientationType | null {
  if (azimuthDeg === null || !Number.isFinite(azimuthDeg)) return null;
  const normalized = normalizeAngleDeg(azimuthDeg);
  const sector = Math.floor((normalized + SECTOR_DEG / 2) / SECTOR_DEG) % SECTORS.length;
  return SECTORS[sector];
}

/** Ο προσανατολισμός → το αζιμούθιο του **κέντρου** του τομέα του (Β=0, ΒΑ=45, …, ΒΔ=315). */
export function azimuthOfOrientation(orientation: OrientationType): number {
  return SECTORS.indexOf(orientation) * SECTOR_DEG;
}
