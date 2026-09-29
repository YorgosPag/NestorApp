'use client';

/**
 * @fileoverview **Το μοντέλο του χάρτη σύγκρισης μιας σελίδας περιοχής** (ADR-890 §15 · §16) — τμήμα, κατάταξη των
 * παιδιών (Π.Ε. μιας Περιφέρειας · Δήμοι μιας Π.Ε. · Δ.Ε. ενός Δήμου), γεωμετρία (τεμπέλικη), οι λέξεις της βαθμίδας και
 * το **ενεργό** παιδί. Ένα μοντέλο για **τρεις** καταναλωτές: τη στρώση (παιδί του χάρτη), το πάνελ και τον πίνακα
 * (αδελφοί του χάρτη) — ό,τι δείχνει το ένα, το τονίζουν και τα άλλα.
 * @related `area-children-view.ts` (η καθαρή όψη) · `AreaMapSection.tsx` (ο ιδιοκτήτης) · ιδίωμα `hooks/market/usePriceMap.ts`
 * @module components/area-market/useAreaChildMap
 *
 * 🔑 **Οι τιμές έρχονται από τον server** (`AreaMarketPageData.childPrices`, προβολή του ίδιου `price-map.json`): ο πίνακας
 *   αποδίδεται στο HTML (SEO, πληκτρολόγιο) χωρίς να περιμένει τίποτα. Μόνο η **γεωμετρία** φορτώνεται στον browser, και
 *   μόνο όταν ο χάρτης δείχνει τιμές.
 * 🔑 **Ενεργό παιδί με ΠΡΟΕΛΕΥΣΗ** (`pointer` · `touch` · `row`): το ίδιο δεύτερο πάτημα σημαίνει «μπες μέσα» **μόνο** αν
 *   το πρώτο ήταν πάτημα — ο δείκτης που απλώς πέρασε από πάνω δεν «οπλίζει» την πλοήγηση.
 */

import { useCallback, useMemo, useState } from 'react';

import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import type { AdminOverviewFile } from '@/lib/geo/admin-overview-file';
import type { MarketSegment } from '@/lib/market/market-segments';
import type { PriceMapAreas } from '@/lib/market/price-map';
import { adminOverviewChildrenSource } from '@/lib/market/price-map-sources';
import { rankedSelectionsOf, type PriceMapChoice, type PriceMapSelection } from '@/lib/market/price-map-view';
import type { AreaMarketPageData } from '@/types/area-market';

import { childMapWordsOf, type ChildMapWords } from './area-level-words';
import { childMapChoice, childPropertiesOf, childSegmentsOf, defaultChildSegment } from './area-children-view';

/** Από πού ενεργοποιήθηκε ένα παιδί — καθορίζει τι σημαίνει το επόμενο πάτημα. */
export type ChildActiveVia = 'pointer' | 'touch' | 'row';

export interface ChildActive {
  readonly id: string;
  readonly via: ChildActiveVia;
}

/** Γεωμετρία: `null` = φορτώνει ή δεν ζητήθηκε · `'unavailable'` = ρώτησα και δεν έμαθα (ποτέ κενός χάρτης σιωπηλά). */
export type ChildGeometry = AdminOverviewFile | 'unavailable' | null;

export interface AreaChildMapModel {
  readonly asOf: string;
  /** Οι λέξεις της βαθμίδας της σελίδας (τίτλος, υπόδειξη, ετικέτα γονέα, διαγράμμιση). */
  readonly words: ChildMapWords;
  readonly areas: PriceMapAreas;
  readonly segments: readonly MarketSegment[];
  readonly choice: PriceMapChoice;
  readonly setSegment: (segment: MarketSegment) => void;
  /** Όλα τα παιδιά, ακριβότερο πρώτο, «λίγα» στο τέλος — η σειρά του πίνακα **και** των ετικετών. */
  readonly rows: readonly PriceMapSelection[];
  readonly geometry: ChildGeometry;
  readonly active: ChildActive | null;
  readonly activeRow: PriceMapSelection | null;
  readonly activate: (next: ChildActive | null) => void;
}

const NO_FILE: AdminOverviewFile = { type: 'FeatureCollection', v: 0, tier: 'municipal_unit', toleranceM: 0, features: [] };
const IDLE: LazyJsonSnapshot<AdminOverviewFile> = { peek: () => NO_FILE, load: async () => undefined };

function useChildGeometry(parentId: string, wanted: boolean): ChildGeometry {
  const source = wanted ? adminOverviewChildrenSource(parentId) : IDLE;
  const file = useLazySnapshot(source, NO_FILE);
  if (file === null || source === IDLE) return null;
  return file === NO_FILE ? 'unavailable' : file;
}

/**
 * Το μοντέλο, ή `null` όταν η σελίδα **δεν** έχει χάρτη σύγκρισης (Δ.Ε., περιοχή με < 2 παιδιά, τιμές που δεν διαβάστηκαν).
 * @param geometryWanted ο χάρτης δείχνει τιμές τώρα — αλλιώς ούτε ένα byte γεωμετρίας
 */
export function useAreaChildMap(data: AreaMarketPageData, geometryWanted: boolean): AreaChildMapModel | null {
  const { area, children, childPrices } = data;
  const { t } = useTranslation(['area-market', 'price-map']);
  const words = useMemo(() => childMapWordsOf(t, area.level), [area.level, t]);
  const areas = childPrices.kind === 'ready' ? childPrices.areas : null;
  const properties = useMemo(() => childPropertiesOf(area, children), [area, children]);
  const segments = useMemo(() => (areas === null ? [] : childSegmentsOf(areas, properties)), [areas, properties]);
  const [picked, setSegment] = useState<MarketSegment | null>(null);
  const segment = picked !== null && segments.includes(picked) ? picked : defaultChildSegment(segments);
  const choice = useMemo(() => childMapChoice(segment), [segment]);
  const rows = useMemo(() => (areas === null ? [] : rankedSelectionsOf(properties, areas, choice)), [areas, choice, properties]);
  const [active, setActive] = useState<ChildActive | null>(null);
  const activate = useCallback((next: ChildActive | null) => setActive(next), []);
  const geometry = useChildGeometry(area.id, geometryWanted && areas !== null);
  const activeRow = useMemo(() => rows.find((row) => row.id === active?.id) ?? null, [active, rows]);

  if (childPrices.kind !== 'ready' || areas === null || words === null) return null;
  return { asOf: childPrices.asOf, words, areas, segments, choice, setSegment, rows, geometry, active, activeRow, activate };
}
