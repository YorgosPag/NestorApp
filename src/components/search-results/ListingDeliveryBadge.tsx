'use client';

/**
 * **Η ΥΠΟΣΧΕΣΗ ΠΑΡΑΔΟΣΗΣ ΣΤΗΝ ΚΑΡΤΑ** — «Παράδοση Γ΄ τρίμηνο 2027», μία για την κάρτα της λίστας και τη βιτρίνα.
 *
 * @related ADR-919 §11 · lib/listings/availability-phrase.ts · components/listing-detail/ListingAvailability.tsx
 *
 * 🔑 **Μόνο το `scheduled` μιλά στην κάρτα.** Το `ready` είναι η συντριπτική πλειοψηφία των αγγελιών: μια ετικέτα
 * «Άμεσα διαθέσιμο» σε κάθε κάρτα θα ήταν θόρυβος που σβήνει το σήμα (το ImmoScout24 κρατά το «Bezugsfrei ab:
 * Sofort» στο exposé, όχι στη λίστα). Το `unknown` σιωπά τίμια — καμία αγορά δεν γράφει «δεν δηλώθηκε» στην κάρτα.
 * Η πλήρης εικόνα (έτοιμο, μεταθέσεις) ζει στη σελίδα.
 *
 * 🔴 **Ζει στο κέλυφος** (η `ListingCard` αποδίδεται στη βιτρίνα της αρχικής, ADR-777 §8.51): ένα κλειδί στο
 * `common` + τα τακτικά του `common-shared`, και τα δύο ήδη εγγυημένα στο κέλυφος. Καμία λεπτομέρεια εδώ.
 *
 * ⛔ **Καμία κρίση εδώ**: η υπόσχεση έρχεται **επιλυμένη** από την προβολή (`PublicListing.availability`).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCurrentLocale } from '@/lib/intl-utils';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import type { ListingAvailability } from '@/types/listing-availability';

interface ListingDeliveryBadgeProps {
  readonly availability: ListingAvailability;
  readonly className?: string;
}

export function ListingDeliveryBadge({ availability, className = '' }: ListingDeliveryBadgeProps) {
  const { t } = useTranslation('common');
  if (availability.kind !== 'scheduled') return null;
  const promise = availabilityPromisePhrase(availability, t, getCurrentLocale());
  return <p className={`text-xs text-muted-foreground ${className}`.trim()}>{t('common:listingAvailability.deliveryOn', { promise })}</p>;
}
