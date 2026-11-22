'use client';

/**
 * @fileoverview **Η ετικέτα ορόφου του υπολογιστή** — ο κάδος του πίνακα του άρθ. 3 §4 στο λεξιλόγιο του πεδίου. Ένα
 *   σημείο για το πεδίο ορόφου (`ObjectiveValueProperty`) και την πρόταση από έγγραφο (`ObjectiveValueReadingReview`,
 *   ADR-949 Α-2).
 * @module components/objective-value/objective-value-floor-label
 *
 * 🔑 **Μικρό επίτηδες**: ο τεμπέλικος οδηγός εγγράφων το εισάγει· αν ζούσε στο `ObjectiveValueProperty`, το chunk του
 *    οδηγού θα έσερνε το σήμα προέλευσης και μαζί του ξένο namespace (μετρημένο: CHECK 3.34, `market-contracts`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

const NS = 'objective-value';

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
type FloorValue = keyof typeof FLOORS;
export const FLOOR_VALUES = Object.keys(FLOORS) as FloorValue[];

/** Ο όροφος ⇒ ο κάδος του πίνακα. Ο πραγματικός αριθμός μένει στο πρόχειρο (ΣΤ'+Ζ' = 6 και 7, ίδιος κάδος). */
function bucketOf(floor: number): FloorValue {
  return String(Math.max(-1, Math.min(6, floor))) as FloorValue;
}

export function floorValueOf(floor: number | null): FloorValue | null {
  return floor === null ? null : bucketOf(floor);
}

/** Η ετικέτα ενός κάδου (τιμή του επιλογέα ορόφου). */
export function useFloorValueLabel(): (value: FloorValue) => string {
  const { t } = useTranslation([NS]);
  return (value) => t(`${NS}:property.floor.${FLOORS[value]}`);
}

/** Η ετικέτα ενός ορόφου στο λεξιλόγιο του πεδίου (ο κάδος του νόμου). */
export function useBucketLabel(): (floor: number) => string {
  const label = useFloorValueLabel();
  return (floor) => label(bucketOf(floor));
}
