'use client';

/**
 * @fileoverview **ΛΙΣΤΑ ‖ ΧΑΡΤΗΣ** — η μία διάταξη κάθε οθόνης που δείχνει τα ίδια πράγματα ως
 * κάρτες **και** ως σημάδια (πρότυπο Airbnb · Zillow · Yelp: λίστα αριστερά, χάρτης δεξιά).
 * @related ADR-777 §8.71 · §8.75 · §8.77 · ADR-896 · components/shared/list-map/list-map-layout
 * @module components/shared/list-map/ListMapSplit
 *
 * 🔑 **Εξήχθη από το `OwnerPortfolio` (`/offers`) όταν απέκτησε δεύτερο καταναλωτή (`/pro`).**
 * Δύο διατάξεις γραμμένες χωριστά θα διαφωνούσαν σε κατώφλι, sticky πάνελ και δείκτη άκρης
 * στην πρώτη αλλαγή — ο άνθρωπος θα έβλεπε τον χάρτη να συμπεριφέρεται αλλιώς σε κάθε οθόνη.
 *
 * Τρεις διατάξεις, **μία** απόφαση (`layoutOf`):
 * | διάταξη | πότε | τι |
 * |---|---|---|
 * | `list` | ο χάρτης δεν έχει τι να πει | μόνο η λίστα, χωρίς εστίαση |
 * | `split` | ο **περιέκτης** χωρά ≥ `LIST_MAP_SPLIT_MIN_REM` | λίστα ‖ sticky χάρτης |
 * | `tabs` | στενός περιέκτης (κινητό) | καρτέλες Λίστα / Χάρτης, η επιλογή στο URL |
 *
 * ⚠️ Το πλάτος μετριέται στον **περιέκτη** (`useContainerClass`), όχι στο παράθυρο: η ίδια
 * οθόνη μέσα σε κέλυφος με πλαϊνή μπάρα έχει άλλο διαθέσιμο πλάτος.
 */

import React, { useMemo, useRef } from 'react';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { focusedListingId } from '@/lib/listings/listing-focus';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { isListMapView } from '@/lib/list-map/list-map-view';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import type { ListingFocusController } from '@/hooks/listings/useListingFocus';
import { useListingRevealTracking } from '@/hooks/listings/useListingRevealTracking';
import { useListMapView } from '@/hooks/list-map/useListMapView';
import { ListingEdgeIndicator } from '@/components/search-results/ListingEdgeIndicator';

import {
  LIST_MAP_EDGE_RAIL,
  LIST_MAP_MAP_HEIGHT,
  LIST_MAP_MAP_PANE,
  LIST_MAP_SPLIT_GRID,
  LIST_MAP_SPLIT_MIN_REM,
} from './list-map-layout';
import { ListMapViewSwitch, type ListMapViewLabels } from './ListMapViewSwitch';

type ListMapLayout = 'list' | 'split' | 'tabs';

/**
 * Η **μία** απόφαση διάταξης — καθαρή, ώστε να ελέγχεται χωρίς DOM.
 * ⚠️ `measuring` ⇒ `tabs`: η στοιβαγμένη εκδοχή είναι η ασφαλής πριν μετρηθεί ο περιέκτης.
 */
function layoutOf(mapAvailable: boolean, room: ViewportClass): ListMapLayout {
  if (!mapAvailable) return 'list';
  return room === 'wide' ? 'split' : 'tabs';
}

interface ListMapEdge {
  readonly entry: ListingMapEntry;
  readonly direction: 'above' | 'below';
  readonly onActivate: () => void;
}

/**
 * **Ο δείκτης άκρης** (ADR-777 §8.77): «η κάρτα που κοιτάς στον χάρτη είναι πιο πάνω / πιο κάτω».
 * Κυλά **η σελίδα**, άρα η άκρη είναι η άκρη του **παραθύρου**.
 */
function useListMapEdge(
  focusController: ListingFocusController,
  describe: (id: string) => ListingMapEntry | null,
): { readonly columnRef: (element: HTMLElement | null) => void; readonly edge: ListMapEdge | null } {
  const { containerRef, focusVisibility, revealFocused } = useListingRevealTracking(focusController.focus, 'viewport');
  const focusedId = focusedListingId(focusController.focus);
  const entry = focusedId === null ? null : describe(focusedId);
  const edge = entry !== null && (focusVisibility === 'above' || focusVisibility === 'below')
    ? { entry, direction: focusVisibility, onActivate: revealFocused }
    : null;
  return { columnRef: containerRef, edge };
}

function EdgeRail({ edge }: { readonly edge: ListMapEdge }): React.ReactElement {
  return (
    <div className={LIST_MAP_EDGE_RAIL[edge.direction]}>
      <ListingEdgeIndicator entry={edge.entry} direction={edge.direction} onActivate={edge.onActivate} />
    </div>
  );
}

function ListColumn({
  columnRef,
  edge,
  children,
}: {
  readonly columnRef: (element: HTMLElement | null) => void;
  readonly edge: ListMapEdge | null;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div ref={columnRef}>
      {edge?.direction === 'above' && <EdgeRail edge={edge} />}
      {children}
      {edge?.direction === 'below' && <EdgeRail edge={edge} />}
    </div>
  );
}

/**
 * Οι καρτέλες. 🔑 Το `useListMapView` καλείται **μόνο** εδώ, άρα το URL διαβάζεται και γράφεται
 * **μόνο** όταν υπάρχει διακόπτης: στις `list` / `split` ένα `?view=map` μένει όπως το έστειλε ο
 * άνθρωπος, χωρίς να «διορθωθεί» σιωπηλά (ADR-777 §8.75).
 */
function ListMapTabs({
  list,
  map,
  labels,
}: {
  readonly list: React.ReactNode;
  readonly map: React.ReactNode;
  readonly labels: ListMapViewLabels;
}): React.ReactElement {
  const { view, setView } = useListMapView();
  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        if (isListMapView(next)) setView(next);
      }}
      className="flex flex-col gap-3"
    >
      <ListMapViewSwitch value={view} labels={labels} />
      <TabsContent value="list" className="mt-0">
        {list}
      </TabsContent>
      <TabsContent value="map" className={`mt-0 ${LIST_MAP_MAP_HEIGHT}`}>
        {map}
      </TabsContent>
    </Tabs>
  );
}

export interface ListMapSplitProps {
  /** Έχει ο χάρτης κάτι να πει; — η **μία** ερώτηση για διακόπτη και απόδοση (π.χ. `hasOwnerPortfolioMap`). */
  readonly mapAvailable: boolean;
  /**
   * Η λίστα. `mapped` = συνυπάρχει με χάρτη, άρα οι κάρτες δέχονται εστίαση· στη διάταξη `list`
   * δεν υπάρχει χάρτης να τη δείξει, και μια κάρτα που «φωτίζεται» για κανέναν θα ήταν θόρυβος.
   */
  readonly renderList: (mapped: boolean) => React.ReactNode;
  /** Ο χάρτης — ήδη lazy (`next/dynamic`, `ssr:false`) από τον καταναλωτή. */
  readonly map: React.ReactNode;
  readonly focusController: ListingFocusController;
  /** Τι είναι αυτό το id, για τον δείκτη άκρης· `null` = δεν υπάρχει πια στη λίστα. */
  readonly describe: (id: string) => ListingMapEntry | null;
  readonly viewLabels: ListMapViewLabels;
}

export function ListMapSplit({
  mapAvailable,
  renderList,
  map,
  focusController,
  describe,
  viewLabels,
}: ListMapSplitProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const room = useContainerClass(rootRef, LIST_MAP_SPLIT_MIN_REM);
  const layout = layoutOf(mapAvailable, room);
  const { columnRef, edge } = useListMapEdge(focusController, describe);
  const mappedList = useMemo(
    () => <ListColumn columnRef={columnRef} edge={edge}>{renderList(true)}</ListColumn>,
    [columnRef, edge, renderList],
  );

  return (
    <div ref={rootRef} data-list-map-layout={layout}>
      {layout === 'list' && renderList(false)}
      {layout === 'split' && (
        <div className={LIST_MAP_SPLIT_GRID}>
          {mappedList}
          <div className={LIST_MAP_MAP_PANE}>{map}</div>
        </div>
      )}
      {layout === 'tabs' && <ListMapTabs list={mappedList} map={map} labels={viewLabels} />}
    </div>
  );
}
