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
 */

import React, { useRef } from 'react';
import dynamic from 'next/dynamic';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  hasOwnerPortfolioMap,
  isOwnerPortfolioView,
  type OwnerPortfolioPartition,
} from '@/lib/owner-property/owner-portfolio-map';
import { listingFocusStrength } from '@/lib/listings/listing-focus';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { useListingFocus, type ListingFocusController } from '@/hooks/listings/useListingFocus';
import {
  LISTING_CARD_ID_ATTRIBUTE,
  useRevealSelectedListing,
} from '@/hooks/listings/useListingRevealTracking';
import { useOwnerPortfolioView } from '@/hooks/owner-property/useOwnerPortfolioView';
import {
  listingStatsStateOf,
  useOwnerPortfolioStats,
  type OwnerPortfolioStatsState,
} from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { OwnerProperty } from '@/types/owner-property';
import { ListingMapSnapshotProvider } from '@/components/listing-map-snapshot/ListingMapSnapshotProvider';

import {
  OWNER_PORTFOLIO_MAP_HEIGHT,
  OWNER_PORTFOLIO_MAP_PANE,
  OWNER_PORTFOLIO_SPLIT_GRID,
  OWNER_PORTFOLIO_SPLIT_MIN_REM,
} from './owner-portfolio-layout';
import { OwnerPortfolioViewSwitch } from './OwnerPortfolioViewSwitch';
import { OwnerPropertyCard } from './OwnerPropertyCard';

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

interface MappedLayoutProps extends Required<OwnerPropertyListProps> {
  readonly partition: OwnerPortfolioPartition;
}

/** `split` — λίστα ‖ χάρτης. Ο χάρτης κολλά στο παράθυρο ενώ κυλά η σελίδα. */
function PortfolioSplit({ partition, ...list }: MappedLayoutProps): React.ReactElement {
  return (
    <div className={OWNER_PORTFOLIO_SPLIT_GRID}>
      <OwnerPropertyList {...list} />
      <div className={OWNER_PORTFOLIO_MAP_PANE}>
        <OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} focusController={list.focusController} />
      </div>
    </div>
  );
}

/** `tabs` — ο διακόπτης του στενού χώρου, με την προβολή στο URL (§8.71). */
function PortfolioTabs({ partition, ...list }: MappedLayoutProps): React.ReactElement {
  const { view, setView } = useOwnerPortfolioView();
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
        <OwnerPropertyList {...list} />
      </TabsContent>
      <TabsContent value="map" className={`mt-0 ${OWNER_PORTFOLIO_MAP_HEIGHT}`}>
        <OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} focusController={list.focusController} />
      </TabsContent>
    </Tabs>
  );
}

export interface OwnerPortfolioProps {
  readonly properties: Properties;
  /** Η διαμέριση του **ενός** κριτή (`partitionOwnerPortfolio`) — υπολογίζεται μία φορά, στη σελίδα. */
  readonly partition: OwnerPortfolioPartition;
}

export function OwnerPortfolio({ properties, partition }: OwnerPortfolioProps): React.ReactElement {
  const mapAvailable = hasOwnerPortfolioMap(partition);
  // 📊 ADR-777 §8.72 — **ΕΝΑ** fetch για όλες τις κάρτες, ποτέ ένα ανά κάρτα.
  const stats = useOwnerPortfolioStats();
  const focusController = useListingFocus();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const room = useContainerClass(rootRef, OWNER_PORTFOLIO_SPLIT_MIN_REM);
  const layout = !mapAvailable ? 'list' : room === 'wide' ? 'split' : 'tabs';
  // Το κλικ στην πινέζα φέρνει την κάρτα στο οπτικό πεδίο — μόνο όταν συνυπάρχουν.
  useRevealSelectedListing(rootRef, layout === 'split' ? focusController.focus.selected : null);

  return (
    // Κουτί μέτρησης, όχι ορόσημο: το πλάτος του είναι ο χώρος που πραγματικά υπάρχει.
    <div ref={rootRef} data-portfolio-layout={layout}>
      {layout === 'list' && <OwnerPropertyList properties={properties} stats={stats} />}
      {layout === 'split' && (
        <PortfolioSplit properties={properties} stats={stats} focusController={focusController} partition={partition} />
      )}
      {layout === 'tabs' && (
        <PortfolioTabs properties={properties} stats={stats} focusController={focusController} partition={partition} />
      )}
    </div>
  );
}
