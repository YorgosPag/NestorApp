'use client';

/**
 * @fileoverview **ΟΙ ΤΡΕΙΣ ΠΛΗΡΕΙΣ ΟΨΕΙΣ ΤΩΝ ΜΕΣΩΝ ΤΗΣ ΑΓΓΕΛΙΑΣ** — πρότυπο Zillow «Φωτογραφίες · Κάτοψη · 3D» (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `lib/listings/listing-routes.ts` (`listingPhotosHref` · `listingFloorplanHref`) · `lib/spatial-tour/tour-routes.ts` (`tourViewHref`)
 * @module components/listing-detail/media/ListingMediaTabs
 *
 * 🔑 **Τρεις ΣΥΝΔΕΣΜΟΙ, όχι `ToggleGroup`.** Κάθε καρτέλα είναι **δική της διεύθυνση**
 * (πλήρης-παραθύρου σελίδα, ADR-797) — δηλαδή είναι **πλοήγηση**, όχι εναλλαγή τοπικής
 * κατάστασης. Στιλιζαρισμένο ως segmented control (`SegmentedControlItem` + `COLOR_BRIDGE.
 * selectionControl.pressed`), αλλά η σημασιολογία είναι `<nav>` + `aria-current="page"`.
 *
 * ⚠️ **Η τρέχουσα καρτέλα φαίνεται ΠΑΝΤΑ**, ακόμη κι όταν το `available` της λέει όχι: ο
 * επισκέπτης που ήδη βρίσκεται εκεί δεν πρέπει να δει το δικό του κουμπί να εξαφανίζεται.
 */

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingFloorplanHref, listingPhotosHref } from '@/lib/listings/listing-routes';
import { tourViewHref } from '@/lib/spatial-tour/tour-routes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';

export type ListingMediaTabId = 'photos' | 'floorplan' | 'tour';

export interface ListingMediaTabsAvailability {
  readonly photos: boolean;
  readonly floorplan: boolean;
  readonly tour: boolean;
}

export interface ListingMediaTabsProps {
  readonly listingId: string;
  readonly current: ListingMediaTabId;
  readonly available: ListingMediaTabsAvailability;
}

/** Το κοινό κέλυφος-κουμπί — το `href` μένει **inline** σε κάθε σημείο κλήσης, ποτέ prop (βλ. `navigation.tsx` Ι2/Γ5: το `Link` είναι γενικό στο `T`, και μια έμμεση παράμετρος θα το φάρδαινε σε `string`). */
function MediaTabButton({ current, children }: { readonly current: boolean; readonly children: ReactElement }): ReactElement {
  return (
    <Button asChild variant="outline" size="sm" className={cn(current && COLOR_BRIDGE.selectionControl.pressed)}>
      {children}
    </Button>
  );
}

export function ListingMediaTabs({ listingId, current, available }: ListingMediaTabsProps): ReactElement {
  const { t } = useTranslation(['listing-detail']);

  return (
    <nav aria-label={t('listing-detail:media.tabs.label')} className="flex flex-wrap items-center gap-1">
      {(current === 'photos' || available.photos) && (
        <MediaTabButton current={current === 'photos'}>
          <Link href={listingPhotosHref(listingId)} aria-current={current === 'photos' ? 'page' : undefined}>
            {t('listing-detail:media.tabs.photos')}
          </Link>
        </MediaTabButton>
      )}
      {(current === 'floorplan' || available.floorplan) && (
        <MediaTabButton current={current === 'floorplan'}>
          <Link href={listingFloorplanHref(listingId)} aria-current={current === 'floorplan' ? 'page' : undefined}>
            {t('listing-detail:media.tabs.floorplan')}
          </Link>
        </MediaTabButton>
      )}
      {(current === 'tour' || available.tour) && (
        <MediaTabButton current={current === 'tour'}>
          <Link href={tourViewHref(listingId)} aria-current={current === 'tour' ? 'page' : undefined}>
            {t('listing-detail:media.tabs.tour')}
          </Link>
        </MediaTabButton>
      )}
    </nav>
  );
}
