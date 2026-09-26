'use client';

/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΘΕΑΣΗΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — `/listing/[id]/tour` (ADR-884 Κ3β).
 * @related `app/(light)/listing/[id]/tour/page.tsx` · `TourViewSurface.tsx` · `lib/spatial-tour/tour-subject-of-listing.ts`
 * @module components/spatial-tour/TourViewPageContent
 *
 * 🔑 **Ίδια διεύθυνση για όλους** (επισκέπτης · εγκεκριμένος · υπεύθυνος): η ρίζα βγαίνει από την ταυτότητα της
 * αγγελίας, η πύλη του διακομιστή λέει τι βλέπει ο καθένας. Εδώ φτάνει και το email «εγκρίθηκε».
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { tourSubjectOfListing } from '@/lib/spatial-tour/tour-subject-of-listing';
import { Link } from '@/lib/workspace/navigation';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/listing__id__tour.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { VIEWER_KEYS } from './tour-access-labels';
import { TourViewSurface } from './TourViewSurface';

registerRouteSlice(routeSlice);

export function TourViewPageContent({ listingId }: { readonly listingId: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const subject = useMemo(() => tourSubjectOfListing(listingId), [listingId]);
  return (
    <main className="space-y-4">
      <nav>
        <Link href={listingDetailHref(listingId)} className="text-sm underline">{t(VIEWER_KEYS.backToListing)}</Link>
      </nav>
      {subject === null
        ? <p className="text-sm text-destructive" role="alert">{t(VIEWER_KEYS.notViewable)}</p>
        : <TourViewSurface subject={subject} shareId={null} />}
    </main>
  );
}
