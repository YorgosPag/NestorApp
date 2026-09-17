'use client';

/**
 * **Η διαμονή στη σελίδα της αγγελίας** — όροι (σύγχρονα) + ημερολόγιο (με όριο φόρτωσης).
 *
 * 🔑 **Εμφανίζεται μόνο για βραχυχρόνια** (`offerKinds` ∋ `leaseShort` **και** `stay` δηλωμένο).
 * Το ημερολόγιο **δεν** ταξιδεύει μέσα στο `PublicListing` (§4.5): η σελίδα το ζητά ανά μήνα.
 *
 * ⚠️ **ΟΡΙΟ `next/dynamic` γύρω από το ημερολόγιο** (ADR-744 Κ2): είναι κάτω από την πρώτη
 * οθόνη, και τα ~6 KB κλειδιών του θα βάραιναν το σύγχρονο slice **κάθε** αγγελίας — και
 * όσων δεν είναι καταλύματα. Ο χώρος κρατιέται με σταθερό ελάχιστο ύψος (καμία μετατόπιση).
 *
 * @related ADR-835 §4.5 · §21 · components/listing-detail/ListingStayBooking.tsx
 */

import dynamic from 'next/dynamic';
import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PublicListing, PublicListingStay } from '@/types/public-listing';

const ListingStayBooking = dynamic(() => import('./ListingStayBooking'), {
  ssr: false,
  loading: () => <span aria-hidden className="block min-h-[22rem]" />,
});

function StayTerms({ stay }: { readonly stay: PublicListingStay }): React.ReactElement | null {
  const { t } = useTranslation(['short-stay']);
  if (stay.minNights === null && stay.maxGuests === null) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 text-sm text-foreground">
      {stay.minNights !== null && <li>{t('short-stay:terms.minNights', { count: stay.minNights })}</li>}
      {stay.maxGuests !== null && <li>{t('short-stay:terms.maxGuests', { count: stay.maxGuests })}</li>}
    </ul>
  );
}

export function ListingStay({ listing }: { readonly listing: PublicListing }): React.ReactElement | null {
  const { t } = useTranslation(['short-stay']);
  if (listing.stay === null || !listing.offerKinds.includes('leaseShort')) return null;
  return (
    <section aria-labelledby="listing-stay-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 id="listing-stay-heading" className="text-sm font-medium text-muted-foreground">{t('short-stay:calendar.heading')}</h2>
      <StayTerms stay={listing.stay} />
      <span className="block min-h-[22rem]"><ListingStayBooking listing={listing} /></span>
    </section>
  );
}
