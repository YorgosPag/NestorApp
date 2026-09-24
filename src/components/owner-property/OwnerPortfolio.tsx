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

import React, { useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  hasOwnerPortfolioMap,
  isOwnerPortfolioView,
  type OwnerPortfolioPartition,
} from '@/lib/owner-property/owner-portfolio-map';
import { focusedListingId, listingFocusStrength } from '@/lib/listings/listing-focus';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { nowISO } from '@/lib/date-local';
import { ownerListingEntry } from '@/lib/owner-property/owner-property-projection';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { useUrlListingFocus, type ListingFocusController } from '@/hooks/listings/useListingFocus';
import { LISTING_CARD_ID_ATTRIBUTE, useListingRevealTracking } from '@/hooks/listings/useListingRevealTracking';
import { useOwnerPortfolioView } from '@/hooks/owner-property/useOwnerPortfolioView';
import {
  listingStatsStateOf,
  useOwnerPortfolioStats,
  type OwnerPortfolioStatsState,
} from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { OwnerProperty } from '@/types/owner-property';
import { ListingMapSnapshotProvider } from '@/components/listing-map-snapshot/ListingMapSnapshotProvider';
import { ListingEdgeIndicator } from '@/components/search-results/ListingEdgeIndicator';

import {
  OWNER_PORTFOLIO_EDGE_RAIL,
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

/** «Η κάρτα που κοιτάς είναι πιο πάνω / πιο κάτω» — ή `null` όταν είναι ορατή ή δεν υπάρχει. */
interface PortfolioEdge {
  readonly entry: ListingMapEntry;
  readonly direction: 'above' | 'below';
  readonly onActivate: () => void;
}

/** Ο δείκτης άκρης κρέμεται από ράγα μηδενικού ύψους (`OWNER_PORTFOLIO_EDGE_RAIL`) ⇒ CLS 0. */
function PortfolioEdgeRail({ edge }: { readonly edge: PortfolioEdge }): React.ReactElement {
  return (
    <div className={OWNER_PORTFOLIO_EDGE_RAIL[edge.direction]}>
      <ListingEdgeIndicator entry={edge.entry} direction={edge.direction} onActivate={edge.onActivate} />
    </div>
  );
}

interface PortfolioColumnProps extends Required<OwnerPropertyListProps> {
  /** Η στήλη της λίστας: εκεί **βρίσκονται** οι κάρτες (`useListingRevealTracking`). */
  readonly columnRef: (element: HTMLElement | null) => void;
  readonly edge: PortfolioEdge | null;
}

/**
 * **Η στήλη της λίστας όταν υπάρχει χάρτης** (§8.77) — `split` και καρτέλα «Λίστα» του `tabs`.
 * Εδώ η επιλογή **αποκαλύπτεται** (κλικ πινέζας · σύνδεσμος `?selected=`) και εδώ κρέμεται ο
 * δείκτης άκρης. Χωρίς χάρτη (`list`) δεν υπάρχει εστίαση — άρα ούτε στήλη.
 */
function PortfolioListColumn({ columnRef, edge, ...list }: PortfolioColumnProps): React.ReactElement {
  return (
    <div ref={columnRef}>
      {edge?.direction === 'above' && <PortfolioEdgeRail edge={edge} />}
      <OwnerPropertyList {...list} />
      {edge?.direction === 'below' && <PortfolioEdgeRail edge={edge} />}
    </div>
  );
}

type MappedColumnLayoutProps = MappedLayoutProps & Pick<PortfolioColumnProps, 'columnRef' | 'edge'>;

/** `split` — λίστα ‖ χάρτης. Ο χάρτης κολλά στο παράθυρο ενώ κυλά η σελίδα. */
function PortfolioSplit({ partition, ...column }: MappedColumnLayoutProps): React.ReactElement {
  return (
    <div className={OWNER_PORTFOLIO_SPLIT_GRID}>
      <PortfolioListColumn {...column} />
      <div className={OWNER_PORTFOLIO_MAP_PANE}>
        <OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} focusController={column.focusController} />
      </div>
    </div>
  );
}

/** `tabs` — ο διακόπτης του στενού χώρου, με την προβολή στο URL (§8.71). */
function PortfolioTabs({ partition, ...column }: MappedColumnLayoutProps): React.ReactElement {
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
        <PortfolioListColumn {...column} />
      </TabsContent>
      <TabsContent value="map" className={`mt-0 ${OWNER_PORTFOLIO_MAP_HEIGHT}`}>
        <OwnerPortfolioMap mapped={partition.mapped} unmapped={partition.unmapped} focusController={column.focusController} />
      </TabsContent>
    </Tabs>
  );
}

export interface OwnerPortfolioProps {
  readonly properties: Properties;
  /** Η διαμέριση του **ενός** κριτή (`partitionOwnerPortfolio`) — υπολογίζεται μία φορά, στη σελίδα. */
  readonly partition: OwnerPortfolioPartition;
}

/**
 * **Πού είναι η κάρτα που κοιτάς** (ADR-777 §8.77) — το **ίδιο** `useListingRevealTracking` με την
 * οθόνη 2, με κάδρο το **παράθυρο** (εδώ κυλά η σελίδα). Το κλικ στην πινέζα κυλά (`nearest`)· το
 * hover **ποτέ** — το λέει ο δείκτης άκρης.
 */
function usePortfolioEdge(
  properties: Properties,
  focusController: ListingFocusController,
): { readonly columnRef: (element: HTMLElement | null) => void; readonly edge: PortfolioEdge | null } {
  const { containerRef, focusVisibility, revealFocused } = useListingRevealTracking(focusController.focus, 'viewport');
  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const focusedId = focusedListingId(focusController.focus);
  const property = focusedId === null ? undefined : byId.get(focusedId);
  const edge = property !== undefined && (focusVisibility === 'above' || focusVisibility === 'below')
    ? { entry: ownerListingEntry(property, nowISO()), direction: focusVisibility, onActivate: revealFocused }
    : null;
  return { columnRef: containerRef, edge };
}

export function OwnerPortfolio({ properties, partition }: OwnerPortfolioProps): React.ReactElement {
  const mapAvailable = hasOwnerPortfolioMap(partition);
  // 📊 ADR-777 §8.72 — **ΕΝΑ** fetch για όλες τις κάρτες, ποτέ ένα ανά κάρτα.
  const stats = useOwnerPortfolioStats();
  const focusController = useUrlListingFocus();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const room = useContainerClass(rootRef, OWNER_PORTFOLIO_SPLIT_MIN_REM);
  const layout = !mapAvailable ? 'list' : room === 'wide' ? 'split' : 'tabs';
  // Η στήλη (άρα αποκάλυψη + δείκτης άκρης) υπάρχει μόνο όταν υπάρχει χάρτης: `split` και καρτέλα «Λίστα».
  const { columnRef, edge } = usePortfolioEdge(properties, focusController);

  return (
    // Κουτί μέτρησης, όχι ορόσημο: το πλάτος του είναι ο χώρος που πραγματικά υπάρχει.
    <div ref={rootRef} data-portfolio-layout={layout}>
      {layout === 'list' && <OwnerPropertyList properties={properties} stats={stats} />}
      {layout === 'split' && (
        <PortfolioSplit
          properties={properties}
          stats={stats}
          focusController={focusController}
          partition={partition}
          columnRef={columnRef}
          edge={edge}
        />
      )}
      {layout === 'tabs' && (
        <PortfolioTabs
          properties={properties}
          stats={stats}
          focusController={focusController}
          partition={partition}
          columnRef={columnRef}
          edge={edge}
        />
      )}
    </div>
  );
}
