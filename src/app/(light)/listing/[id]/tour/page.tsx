/**
 * `/listing/[id]/tour` — **η σελίδα θέασης** της περιήγησης 360° μιας αγγελίας (ADR-884 Κ3β).
 *
 * Ζει στο `(light)` όπως η αγγελία: ο επισκέπτης είναι συνήθως **ανώνυμος**, και ο εγκεκριμένος αιτών φτάνει εδώ από
 * την ειδοποίηση «εγκρίθηκε». Τι βλέπει ο καθένας το λέει η **πύλη θέασης** του διακομιστή, όχι η σελίδα.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με το `listing/[id]/page.tsx`.
 * 🔶 Χωρίς απόδοση περιεχομένου στον διακομιστή, για τον **ίδιο** δηλωμένο λόγο με τη σελίδα αγγελίας (ADR-777 §8.11).
 */

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { TourViewPageContent } from '@/components/spatial-tour/TourViewPageContent';

interface ListingTourPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function ListingTourPage({ params }: ListingTourPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <TourViewPageContent listingId={id} />
    </Suspense>
  );
}
