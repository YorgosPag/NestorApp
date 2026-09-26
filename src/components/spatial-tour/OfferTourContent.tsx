'use client';

/**
 * @fileoverview **Η ΠΕΡΙΗΓΗΣΗ 360° ΤΗΣ ΑΓΓΕΛΙΑΣ ΤΟΥ ΙΔΙΩΤΗ** — πίσω στην αγγελία + το ΙΔΙΟ πάνελ με την πλευρά γραφείου.
 * @related ADR-884 Κ3α · `app/(me)/offers/[offerId]/tour/page.tsx` · `SpatialTourPanel`
 * @module components/spatial-tour/OfferTourContent
 *
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import type { TourSubject } from '@/types/spatial-tour';

import { SpatialTourPanel } from './SpatialTourPanel';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component):
//    χωρίς αυτό το artifact υπάρχει, οι πύλες είναι πράσινες, και η σελίδα βάφει ωμά κλειδιά.
import routeSlice from '@/i18n/generated/routes/offers__offerId__tour.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function OfferTourContent({ ownerPropertyId }: { readonly ownerPropertyId: string }) {
  const { t } = useTranslation(['property-market']);
  const subject = useMemo<TourSubject>(() => ({ kind: 'owner-property', id: ownerPropertyId }), [ownerPropertyId]);
  return (
    <main className="space-y-4">
      <nav>
        <Link href={offerDetailHref(ownerPropertyId)} className="text-sm underline">{t('property-market:offer.tour.back')}</Link>
      </nav>
      <SpatialTourPanel subject={subject} />
    </main>
  );
}
