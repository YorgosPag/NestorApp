/**
 * Roof slope-unit conversions (ADR-417 Q5) — pure SSoT, μηδέν dependencies.
 *
 * Εξάγεται σε ξεχωριστό module ώστε να το μοιράζονται ο orchestrator
 * (`roof-geometry.ts`) ΚΑΙ ο solver (`roof-lower-envelope.ts`) χωρίς circular
 * import. Μετατρέπει την κλίση μεταξύ της UI μονάδας ('deg' | 'percent') και του
 * εσωτερικού λόγου `rise/run`.
 *
 * @see bim/types/roof-types.ts — RoofSlopeUnit
 */

import type { RoofSlopeUnit } from '../types/roof-types';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Κλίση (στη μονάδα `unit`) → λόγος rise/run. deg→tan, percent→/100. */
export function roofSlopeToRatio(slope: number, unit: RoofSlopeUnit): number {
  if (unit === 'percent') return slope / 100;
  // 'deg' — clamp κάτω από 90° (κατακόρυφο = άπειρος λόγος).
  const clamped = Math.max(0, Math.min(89.9, slope));
  return Math.tan(clamped * DEG_TO_RAD);
}

/** Λόγος rise/run → κλίση στη μονάδα `unit` (UI toggle μοίρες ↔ ποσοστό). */
export function roofSlopeFromRatio(ratio: number, unit: RoofSlopeUnit): number {
  if (unit === 'percent') return ratio * 100;
  return Math.atan(ratio) * RAD_TO_DEG;
}
