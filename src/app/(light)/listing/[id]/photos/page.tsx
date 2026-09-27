/**
 * `/listing/[id]/photos` — **όλες οι φωτογραφίες** της αγγελίας, πλήρες παράθυρο (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 *
 * Ζει στο `(light)` όπως η αγγελία και η σελίδα θέασης της περιήγησης: δημόσια, χωρίς κέλυφος εφαρμογής.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `listing/[id]/page.tsx` και `listing/[id]/tour/page.tsx`.
 * 🔶 Χωρίς απόδοση περιεχομένου στον διακομιστή, για τον **ίδιο** δηλωμένο λόγο με τη σελίδα αγγελίας (ADR-777 §8.11).
 */

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ListingPhotosPageContent } from '@/components/listing-detail/media/ListingPhotosPageContent';

interface ListingPhotosPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function ListingPhotosPage({ params }: ListingPhotosPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ListingPhotosPageContent listingId={id} />
    </Suspense>
  );
}
