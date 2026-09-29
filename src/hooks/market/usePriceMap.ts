'use client';

/**
 * **Η κατάσταση του χάρτη τιμών στην αναζήτηση** (ADR-890 §14) — ορατότητα, επιλογή πηγής/τμήματος, γεωμετρία ανά
 * βαθμίδα, τιμές, η επιλεγμένη περιοχή και όσες φαίνονται. Ένα μοντέλο για **δύο** καταναλωτές: τη στρώση (παιδί του
 * χάρτη) και το πάνελ (αδελφός του χάρτη) — ο χάρτης του Geo-Canvas δεν μοιράζεται React context με το πάνελ.
 *
 * 🔑 **Τίποτα δεν φορτώνεται πριν ανοίξει η στρώση**, και οι Δ.Ε. μόνο όταν το zoom τις πλησιάσει.
 * 🔑 **Τέσσερις καταστάσεις δεδομένων, καμία σιωπηλή** (ιδίωμα `useValueZoneLayer`): `loading` · `ready` · `none`
 *   (η πηγή απάντησε «καμία νύχτα ακόμη» — γεγονός) · `unavailable` (ρώτησα και δεν έμαθα — **ποτέ** «λίγα παντού»).
 */

import { useCallback, useMemo, useState } from 'react';

import {
  UNIT_PREFETCH_ZOOM,
  defaultPriceMapChoice,
  normalizeChoice,
  type PriceMapChoice,
} from '@/lib/market/price-map-view';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import type { AdminOverviewFile, AdminOverviewProperties } from '@/lib/geo/admin-overview-file';
import type { AskingPriceMapResponse, ContractPriceMapFile, PriceMapAreas } from '@/lib/market/price-map';
import { adminOverviewSource, askingPriceMapSource, contractPriceMapSource } from '@/lib/market/price-map-sources';

export type PriceMapData =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly areas: PriceMapAreas; readonly asOf: string }
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' };

/** Ονομασμένες απαντήσεις «ρώτησα και δεν έμαθα» — συγκρίνονται με **ταυτότητα**. */
const NO_FILE: AdminOverviewFile = { type: 'FeatureCollection', v: 0, tier: 'municipality', toleranceM: 0, features: [] };
const NO_CONTRACTS: ContractPriceMapFile = { v: 0, asOf: '', areas: {} };
const NO_ASKING: AskingPriceMapResponse = { kind: 'none' };

/** Πηγή «δεν ζητήθηκε τίποτα» — απαντά αμέσως, δεν ρωτά ποτέ το δίκτυο. */
function idle<T>(empty: T): LazyJsonSnapshot<T> {
  return { peek: () => empty, load: async () => undefined };
}
const IDLE_FILE = idle(NO_FILE);
const IDLE_CONTRACTS = idle(NO_CONTRACTS);
const IDLE_ASKING = idle(NO_ASKING);

/** Γεωμετρία βαθμίδας: `null` = φορτώνει ή δεν ζητήθηκε · `NO_FILE` ⇒ μη διαθέσιμη. */
function useTier(source: LazyJsonSnapshot<AdminOverviewFile>): AdminOverviewFile | 'unavailable' | null {
  const file = useLazySnapshot(source, NO_FILE);
  if (file === null) return null;
  return file === NO_FILE ? (source === IDLE_FILE ? null : 'unavailable') : file;
}

function usePriceData(visible: boolean, choice: PriceMapChoice): PriceMapData {
  const wantsContracts = visible && choice.source === 'contracts';
  const wantsAsking = visible && choice.source === 'asking';
  const contracts = useLazySnapshot(wantsContracts ? contractPriceMapSource : IDLE_CONTRACTS, NO_CONTRACTS);
  const asking = useLazySnapshot(wantsAsking ? askingPriceMapSource : IDLE_ASKING, NO_ASKING);

  return useMemo((): PriceMapData => {
    if (choice.source === 'contracts') {
      if (contracts === null) return { status: 'loading' };
      return contracts === NO_CONTRACTS ? { status: 'unavailable' } : { status: 'ready', areas: contracts.areas, asOf: contracts.asOf };
    }
    if (asking === null) return { status: 'loading' };
    if (asking === NO_ASKING) return { status: wantsAsking ? 'unavailable' : 'loading' };
    return asking.kind === 'none'
      ? { status: 'none' }
      : { status: 'ready', areas: asking.offers[choice.offer], asOf: asking.day };
  }, [asking, choice.offer, choice.source, contracts, wantsAsking]);
}

function sameIds(a: readonly AdminOverviewProperties[], b: readonly AdminOverviewProperties[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index].id);
}

export interface PriceMapModel {
  readonly visible: boolean;
  readonly setVisible: (visible: boolean) => void;
  readonly choice: PriceMapChoice;
  readonly setChoice: (choice: PriceMapChoice) => void;
  readonly data: PriceMapData;
  readonly municipalities: AdminOverviewFile | 'unavailable' | null;
  readonly units: AdminOverviewFile | 'unavailable' | null;
  /** Ο χάρτης αναφέρει το zoom του — οι Δ.Ε. φορτώνονται μόλις πλησιάσει. */
  readonly onZoom: (zoom: number) => void;
  readonly selected: AdminOverviewProperties | null;
  readonly select: (properties: AdminOverviewProperties | null) => void;
  readonly rendered: readonly AdminOverviewProperties[];
  readonly onRendered: (rendered: readonly AdminOverviewProperties[]) => void;
}

export function usePriceMap(criteria: ListingCriteria): PriceMapModel {
  const [visible, setVisible] = useState(false);
  // Η αφετηρία ακολουθεί την αναζήτηση **μέχρι** να διαλέξει ο άνθρωπος — μετά κρατά τη δική του επιλογή.
  const [override, setOverride] = useState<PriceMapChoice | null>(null);
  const choice = useMemo(() => override ?? defaultPriceMapChoice(criteria), [criteria, override]);
  const setChoice = useCallback((next: PriceMapChoice) => setOverride(normalizeChoice(next)), []);
  const [unitsWanted, setUnitsWanted] = useState(false);
  const onZoom = useCallback((zoom: number) => {
    if (zoom >= UNIT_PREFETCH_ZOOM) setUnitsWanted(true);
  }, []);
  const [selected, select] = useState<AdminOverviewProperties | null>(null);
  const [rendered, setRendered] = useState<readonly AdminOverviewProperties[]>([]);
  // Ο χάρτης αναφέρει σε κάθε ηρεμία· νέα κατάσταση **μόνο** όταν άλλαξε το σύνολο — αλλιώς κάθε pan = απόδοση.
  const onRendered = useCallback((next: readonly AdminOverviewProperties[]) => {
    setRendered((previous) => (sameIds(previous, next) ? previous : next));
  }, []);

  const municipalities = useTier(visible ? adminOverviewSource('municipality') : IDLE_FILE);
  const units = useTier(visible && unitsWanted ? adminOverviewSource('municipal_unit') : IDLE_FILE);
  const data = usePriceData(visible, choice);

  return useMemo(
    () => ({ visible, setVisible, choice, setChoice, data, municipalities, units, onZoom, selected, select, rendered, onRendered }),
    [visible, choice, setChoice, data, municipalities, units, onZoom, selected, rendered, onRendered],
  );
}
