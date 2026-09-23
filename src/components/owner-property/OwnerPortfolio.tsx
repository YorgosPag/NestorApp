'use client';

/**
 * **Το χαρτοφυλάκιο του κατόχου: Λίστα | Χάρτης** (ADR-777 §8.71).
 *
 * 🔑 **Η λίστα είναι η προεπιλογή**, και για τους περισσότερους η μόνη προβολή: η διαχείριση
 * των δικών σου αγγελιών είναι έλεγχος και διόρθωση, όχι αναζήτηση στον χώρο (§8.70.2). Ο
 * χάρτης προστίθεται για όσους έχουν **χαρτοφυλάκιο** (μεσίτες, κατασκευαστές), και ο
 * διακόπτης εμφανίζεται **μόνο** όταν ο χάρτης έχει κάτι να πει (`hasOwnerPortfolioMap`).
 *
 * ⚠️ Χωρίς χάρτη **δεν υπάρχει** `Tabs`: ένα `tabpanel` χωρίς `tablist` είναι σπασμένη δομή
 * προσβασιμότητας. Η λίστα αποδίδεται τότε σκέτη, όπως πριν.
 */

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import {
  hasOwnerPortfolioMap,
  isOwnerPortfolioView,
  partitionOwnerPortfolio,
} from '@/lib/owner-property/owner-portfolio-map';
import { useOwnerPortfolioView } from '@/hooks/owner-property/useOwnerPortfolioView';
import {
  listingStatsStateOf,
  useOwnerPortfolioStats,
  type OwnerPortfolioStatsState,
} from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { OwnerProperty } from '@/types/owner-property';
import { ListingMapSnapshotProvider } from '@/components/listing-map-snapshot/ListingMapSnapshotProvider';

import { OWNER_PORTFOLIO_MAP_HEIGHT } from './owner-portfolio-layout';
import { OwnerPortfolioViewSwitch } from './OwnerPortfolioViewSwitch';
import { OwnerPropertyCard } from './OwnerPropertyCard';

/** Η κράτηση θέσης, **ίδιο ύψος** με τον χάρτη ⇒ μηδέν μετατόπιση όταν φτάσει. */
function MapPending(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <p aria-busy="true" className={`${OWNER_PORTFOLIO_MAP_HEIGHT} m-0 flex items-center justify-center rounded-md border border-border text-sm text-muted-foreground`}>
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
}

function OwnerPropertyList({ properties, stats }: OwnerPropertyListProps): React.ReactElement {
  return (
    <ListingMapSnapshotProvider>
      <ul className="flex list-none flex-col gap-3 p-0">
        {properties.map((property, index) => (
          <li key={property.id}>
            {/* 🖼️ ADR-777 §8.70 — μόνο η πρώτη μικρογραφία φορτώνεται με υψηλή προτεραιότητα. */}
            <OwnerPropertyCard
              property={property}
              priority={index === 0}
              stats={listingStatsStateOf(stats, property.id)}
            />
          </li>
        ))}
      </ul>
    </ListingMapSnapshotProvider>
  );
}

export function OwnerPortfolio({ properties }: { readonly properties: Properties }): React.ReactElement {
  // ⚠️ **Μία ανάγνωση ρολογιού ανά λίστα** (§8.33), όπως στις κάρτες.
  const partition = useMemo(() => partitionOwnerPortfolio(properties, nowISO()), [properties]);
  const mapAvailable = hasOwnerPortfolioMap(partition);
  const { view, setView } = useOwnerPortfolioView(mapAvailable);
  // 📊 ADR-777 §8.72 — **ΕΝΑ** fetch για όλες τις κάρτες, ποτέ ένα ανά κάρτα.
  const stats = useOwnerPortfolioStats();

  if (!mapAvailable) return <OwnerPropertyList properties={properties} stats={stats} />;

  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        if (isOwnerPortfolioView(next)) setView(next);
      }}
      className="flex flex-col gap-3"
    >
      <OwnerPortfolioViewSwitch value={view} />
      <TabsContent value="list" className="mt-0">
        <OwnerPropertyList properties={properties} stats={stats} />
      </TabsContent>
      <TabsContent value="map" className="mt-0">
        <OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} />
      </TabsContent>
    </Tabs>
  );
}
