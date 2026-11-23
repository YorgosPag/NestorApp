'use client';

/**
 * @fileoverview **Η ετικέτα ορόφου του υπολογιστή** — ο κάδος του πίνακα του άρθ. 3 §4 στο λεξιλόγιο του πεδίου. Ένα
 *   σημείο για το πεδίο ορόφου (`ObjectiveValueProperty`) και την πρόταση από έγγραφο (`ObjectiveValueReadingReview`,
 *   ADR-949 Α-2).
 * @module components/objective-value/objective-value-floor-label
 * @related lib/objective-value/objective-value-floor-bucket.ts (ο πίνακας των κάδων — κοινός με το PDF, ADR-947 Φ2β)
 *
 * 🔑 **Μικρό επίτηδες**: ο τεμπέλικος οδηγός εγγράφων το εισάγει· αν ζούσε στο `ObjectiveValueProperty`, το chunk του
 *    οδηγού θα έσερνε το σήμα προέλευσης και μαζί του ξένο namespace (μετρημένο: CHECK 3.34, `market-contracts`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { floorBucketOf, floorLabelSegment, type FloorValue } from '@/lib/objective-value/objective-value-floor-bucket';

const NS = 'objective-value';

/** Η ετικέτα ενός κάδου (τιμή του επιλογέα ορόφου). */
export function useFloorValueLabel(): (value: FloorValue) => string {
  const { t } = useTranslation([NS]);
  return (value) => t(`${NS}:property.floor.${floorLabelSegment(value)}`);
}

/** Η ετικέτα ενός ορόφου στο λεξιλόγιο του πεδίου (ο κάδος του νόμου). */
export function useBucketLabel(): (floor: number) => string {
  const label = useFloorValueLabel();
  return (floor) => label(floorBucketOf(floor));
}
