'use client';

/**
 * **Το χαρτοφυλάκιο του κατόχου: Λίστα | Χάρτης** (ADR-777 §8.71 · §8.75).
 *
 * 🔑 **Η λίστα είναι η προεπιλογή**, και για τους περισσότερους η μόνη προβολή: η διαχείριση
 * των δικών σου αγγελιών είναι έλεγχος και διόρθωση, όχι αναζήτηση στον χώρο (§8.70.2). Ο
 * χάρτης προστίθεται για όσους έχουν **χαρτοφυλάκιο** (μεσίτες, κατασκευαστές), **μόνο** όταν
 * έχει κάτι να πει (`hasOwnerPortfolioMap`).
 *
 * 🗺️ **ΤΡΕΙΣ ΔΙΑΤΑΞΕΙΣ, ΡΗΤΑ** (§8.75):
 * | διάταξη | πότε | σχήμα |
 * |---|---|---|
 * | `list`  | < 2 σημάδια | η λίστα σκέτη — **χωρίς** `Tabs` (ένα `tabpanel` χωρίς `tablist` είναι σπασμένη δομή) |
 * | `tabs`  | χάρτης, **στενός** περιέκτης | διακόπτης Λίστα/Χάρτης, η προβολή στο URL (`?view=map`) — το μοτίβο κινητού των μεγάλων |
 * | `split` | χάρτης, **φαρδύς** περιέκτης | λίστα ‖ χάρτης, ο χάρτης κολλά στο παράθυρο (πρότυπο Airbnb/Redfin) |
 *
 * ⚠️ **Φαρδύς = ο ΠΕΡΙΕΚΤΗΣ, όχι το παράθυρο** (`useContainerClass`): η πλαϊνή στήλη του
 * ιδιωτικού χώρου τρώει έως 256px, και το zoom στο 400% πρέπει να γυρίζει μόνο του σε `tabs`.
 * ⚠️ Στο `split` το `?view` **δεν** διαβάζεται και **δεν** σβήνεται: ο σύνδεσμος ισχύει ξανά μόλις
 * στενέψει ο χώρος.
 *
 * 🔑 **Η διάταξη ζει πλέον στο `ListMapSplit`** (ADR-896): εξήχθη όταν ο κατάλογος επαγγελματιών
 * (`/pro`) χρειάστηκε την ίδια — εδώ μένουν μόνο η λίστα, ο χάρτης και το «τι είναι αυτό το id».
 */

import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  hasOwnerPortfolioMap,
  type OwnerPortfolioPartition,
} from '@/lib/owner-property/owner-portfolio-map';
import { listingFocusStrength } from '@/lib/listings/listing-focus';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { nowISO } from '@/lib/date-local';
import { ownerListingEntry } from '@/lib/owner-property/owner-property-projection';
import { useUrlListingFocus, type ListingFocusController } from '@/hooks/listings/useListingFocus';
import { LISTING_CARD_ID_ATTRIBUTE } from '@/hooks/listings/useListingRevealTracking';
import {
  listingStatsStateOf,
  useOwnerPortfolioStats,
  type OwnerPortfolioStatsState,
} from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { OwnerProperty } from '@/types/owner-property';
import { ListingMapSnapshotProvider } from '@/components/listing-map-snapshot/ListingMapSnapshotProvider';
import { ListMapSplit } from '@/components/shared/list-map/ListMapSplit';

import { OwnerPropertyCard } from './OwnerPropertyCard';

const VIEW_K = 'property-market:offer.portfolio.view';

/** Η κράτηση θέσης γεμίζει τον **ίδιο** περιέκτη με τον χάρτη ⇒ μηδέν μετατόπιση όταν φτάσει. */
function MapPending(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <p aria-busy="true" className="m-0 flex h-full items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
      {t('property-market:offer.portfolio.map.loading')}
    </p>
  );
}

const OwnerPortfolioMap = dynamic(() => import('./OwnerPortfolioMap'), { ssr: false, loading: MapPending });

type Properties = readonly OwnerProperty[];

interface OwnerPropertyListProps {
  readonly properties: Properties;
  /** 📊 ADR-777 §8.72 — το ΕΝΑ fetch της σελίδας, μοιρασμένο ανά κάρτα. */
  readonly stats: OwnerPortfolioStatsState;
  /** 🗺️ §8.75 — η κοινή εστίαση με τον χάρτη· απούσα όταν δεν υπάρχει χάρτης. */
  readonly focusController?: ListingFocusController;
}

function OwnerPropertyList({ properties, stats, focusController }: OwnerPropertyListProps): React.ReactElement {
  return (
    <ListingMapSnapshotProvider>
      <ul className="flex list-none flex-col gap-3 p-0">
        {properties.map((property, index) => (
          // 🔑 Η κάρτα δηλώνει **ποια είναι** — έτσι τη βρίσκει το κλικ στην πινέζα (`useRevealSelectedListing`).
          <li key={property.id} {...{ [LISTING_CARD_ID_ATTRIBUTE]: property.id }}>
            {/* 🖼️ ADR-777 §8.70 — μόνο η πρώτη μικρογραφία φορτώνεται με υψηλή προτεραιότητα. */}
            <OwnerPropertyCard
              property={property}
              priority={index === 0}
              stats={listingStatsStateOf(stats, property.id)}
              focusStrength={focusController ? listingFocusStrength(focusController.focus, property.id) : 'none'}
              onHover={focusController?.peek}
            />
          </li>
        ))}
      </ul>
    </ListingMapSnapshotProvider>
  );
}

export interface OwnerPortfolioProps {
  readonly properties: Properties;
  readonly partition: OwnerPortfolioPartition;
}

export function OwnerPortfolio({ properties, partition }: OwnerPortfolioProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const stats = useOwnerPortfolioStats();
  const focusController = useUrlListingFocus();

  const describe = useCallback((id: string): ListingMapEntry | null => {
    const property = properties.find((candidate) => candidate.id === id);
    return property === undefined ? null : ownerListingEntry(property, nowISO());
  }, [properties]);

  const renderList = useCallback(
    (mapped: boolean) => (
      <OwnerPropertyList properties={properties} stats={stats} focusController={mapped ? focusController : undefined} />
    ),
    [properties, stats, focusController],
  );

  return (
    <ListMapSplit
      mapAvailable={hasOwnerPortfolioMap(partition)}
      renderList={renderList}
      map={<OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} focusController={focusController} />}
      focusController={focusController}
      describe={describe}
      viewLabels={{ label: t(`${VIEW_K}.label`), list: t(`${VIEW_K}.list`), map: t(`${VIEW_K}.map`) }}
    />
  );
}
