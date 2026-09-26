'use client';

/**
 * **Ο προσωπικός σύνδεσμος περιήγησης** — η σελίδα `/shared/[token]` για το είδος `spatial_tour` (ADR-884 Φ0.12 · Κ3β).
 *
 * 🔑 Η επίλυση του συνδέσμου (`/api/shares/resolve`) **ήδη** μέτρησε το άνοιγμα και έγραψε το κουπόνι επίσκεψης του
 * συνδέσμου. Εδώ ανοίγει η **ίδια** επιφάνεια θέασης με τη σελίδα αγγελίας, με βάση `link` — η πύλη του διακομιστή
 * ξαναελέγχει ότι ο σύνδεσμος είναι **ακόμη** ενεργός και δείχνει **αυτή** την περιήγηση.
 *
 * 🔴 **Κανένα ωμό κλειδί στο πρώτο καρέ (ADR-884 §9.1 Α4)**: η `/shared/[token]` φορτώνεται τεμπέλικα και **μόνο στον
 * browser** (`LazyRoutes.SharedFile`, `ssr: false`), άρα το route slice της ADR-744 **δεν τη φτάνει** (μετρημένο: 0 ns).
 * Το `spatial-tour` το περιμένει το **ίδιο το chunk** (`createLazyRoute({ namespaces })`) — ⚠️ ΟΧΙ φραγμός
 * `isNamespaceReady` εδώ: κενό καρέ σε κάθε επαναφόρτωση (CHECK 3.25).
 *
 * @related components/spatial-tour/TourViewSurface.tsx · services/sharing/resolvers/spatial-tour.resolver.ts ·
 *          utils/lazyRouteFactory.tsx
 */

import React from 'react';

import { TourViewSurface } from '@/components/spatial-tour/TourViewSurface';
import { SPATIAL_TOUR_NS } from '@/components/spatial-tour/spatial-tour-namespace';
import { VIEWER_KEYS } from '@/components/spatial-tour/tour-access-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SpatialTourShareResolvedData } from '@/services/sharing/resolvers/spatial-tour.resolver';

export function SharedTourPageContent({ data }: { readonly data: SpatialTourShareResolvedData }): React.ReactElement {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <main className="mx-auto w-full space-y-4 p-4">
      {data.subject === null
        ? <p className="text-sm text-destructive" role="alert">{t(VIEWER_KEYS.unavailable)}</p>
        : <TourViewSurface subject={data.subject} shareId={data.shareId} />}
    </main>
  );
}
