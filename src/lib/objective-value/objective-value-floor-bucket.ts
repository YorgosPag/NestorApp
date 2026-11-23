/**
 * @fileoverview **Ο κάδος ορόφου του νόμου** — όροφος → γραμμή του πίνακα του άρθ. 3 §4 και το κλειδί της ετικέτας του.
 *   Καθαρό (χωρίς React): το διαβάζουν το πεδίο ορόφου του υπολογιστή (μέσω `components/objective-value/objective-value-floor-label.ts`)
 *   **και** το PDF πληροφοριακού υπολογισμού στον server (ADR-947 Φ2β) — ένας πίνακας, όχι δύο.
 * @module lib/objective-value/objective-value-floor-bucket
 */

/** Όροφος → γραμμή του πίνακα του άρθ. 3 §4 (`< 0` υπόγειο · `0` ισόγειο · … · ΣΤ' και πάνω ίδια στήλη). */
const FLOORS = {
  '-1': 'basement',
  '0': 'ground',
  '1': 'first',
  '2': 'second',
  '3': 'third',
  '4': 'fourth',
  '5': 'fifth',
  '6': 'sixthPlus',
} as const;

export type FloorValue = keyof typeof FLOORS;
export const FLOOR_VALUES = Object.keys(FLOORS) as FloorValue[];

/** Ο όροφος ⇒ ο κάδος του πίνακα. Ο πραγματικός αριθμός μένει στο πρόχειρο (ΣΤ'+Ζ' = 6 και 7, ίδιος κάδος). */
export function floorBucketOf(floor: number): FloorValue {
  return String(Math.max(-1, Math.min(6, floor))) as FloorValue;
}

export function floorValueOf(floor: number | null): FloorValue | null {
  return floor === null ? null : floorBucketOf(floor);
}

/**
 * Το τελευταίο τμήμα του κλειδιού της ετικέτας (`objective-value:property.floor.<τμήμα>`).
 * ⚠️ **Τμήμα, όχι ολόκληρο κλειδί, επίτηδες**: ο γεννήτορας του i18n slice (ADR-744, CHECK 3.34) διαβάζει τις κλήσεις
 *    `t(…)` στατικά — ο καλών γράφει το πρόθεμα ως template literal ώστε ο γεννήτορας να το βλέπει.
 */
export function floorLabelSegment(value: FloorValue): (typeof FLOORS)[FloorValue] {
  return FLOORS[value];
}
