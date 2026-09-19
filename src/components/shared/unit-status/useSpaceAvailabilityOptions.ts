'use client';

/**
 * Οι επιλογές του φίλτρου «Διάθεση» χώρων — **μία** λίστα, μεταφρασμένη, για κάθε γραμμή φίλτρων
 * (καρτέλες κτιρίου θέσεων/αποθηκών). Κουβάδες και κατηγόρημα ζουν στο
 * `lib/spaces/space-availability` (ADR-777 §8.60.20)· εδώ μόνο οι ετικέτες.
 *
 * @module components/shared/unit-status/useSpaceAvailabilityOptions
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  SPACE_AVAILABILITY_BUCKETS,
  type SpaceAvailabilityBucket,
} from '@/lib/spaces/space-availability';

/** Το κλειδί ετικέτας ενός κουβά (namespace `filters`) — ένα σημείο για κάθε επιφάνεια. */
export function spaceAvailabilityLabelKey(bucket: SpaceAvailabilityBucket | 'all'): string {
  return `spaceAvailability.${bucket}`;
}

export interface SpaceAvailabilityOption {
  readonly value: SpaceAvailabilityBucket;
  readonly label: string;
}

/** Ό,τι χρειάζεται μια γραμμή φίλτρων: οι επιλογές **και** η ετικέτα του «όλες». */
export interface SpaceAvailabilityFilterLabels {
  readonly options: ReadonlyArray<SpaceAvailabilityOption>;
  readonly allLabel: string;
}

export function useSpaceAvailabilityOptions(): SpaceAvailabilityFilterLabels {
  const { t } = useTranslation('filters');
  return useMemo(
    () => ({
      options: SPACE_AVAILABILITY_BUCKETS.map((value) => ({ value, label: t(spaceAvailabilityLabelKey(value)) })),
      allLabel: t('spaceAvailability.all'),
    }),
    [t],
  );
}
