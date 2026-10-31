'use client';

/**
 * @fileoverview **Η κατάσταση της ανάλυσης τιμής** — κωδικός · ποσότητα · ημερομηνία · κοινά · ιστορικό
 *   (ADR-923 §5.11 «3δ» Τμήμα 3).
 * @related price-analysis.ts (η καθαρή λογική) · hooks/useAsyncData.ts (η ΜΙΑ «τελευταία ανάγνωση», χωρίς μπαγιάτικη απάντηση)
 * @module components/catalog/pricing/use-price-analysis
 *
 * 🔑 **Σύγκριση = παράλληλα `price-quote`, ένα ανά θεατή** — ποτέ endpoint «πολλών», ποτέ δεύτερη μηχανή. `allSettled`,
 *    όχι `all`: ο θεατής που απέτυχε δεν σβήνει τους άλλους τρεις.
 * 🔑 **Ζωντανή**: το `revision` (σήματα των όψεων) είναι εξάρτηση, άρα αλλαγή συνθήκης/έκδοσης από άλλη καρτέλα ξαναρωτά.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { fetchPriceHistory, fetchPriceQuote } from '@/services/catalog/catalog-pricing-api.client';
import type { PriceAudience, PriceLineSubject } from '@/subapps/catalog/types/price-list';
import type { PriceHistoryResult } from '@/subapps/catalog/types/price-list-requests';
import { useCatalogCodeResolver } from '../products/use-catalog-code-resolver';
import { validFromOfPicker } from './discount-condition-draft';
import { historyListOf, isCompleteAudience, MAX_ANALYSIS_VIEWERS, type AnalysisCell, type AnalysisViewer } from './price-analysis';

const FIRST_VIEWER: AnalysisViewer = { key: 'viewer-0', audience: { kind: 'anonymous' } };
const LOADING_CELL: AnalysisCell = { state: 'loading' };
const INCOMPLETE_CELL: AnalysisCell = { state: 'incomplete' };

export type SkuLookup =
  | { readonly state: 'empty' | 'resolving' | 'notFound' | 'notSku' }
  | { readonly state: 'ready'; readonly subject: PriceLineSubject };

/** Κωδικός → SKU. Η απάντηση παλιότερης αναζήτησης δεν γράφει ποτέ πάνω στη νεότερη. */
function useSkuLookup(attributes: readonly AttributeRecord[]) {
  const resolve = useCatalogCodeResolver(attributes);
  const [sku, setSku] = useState<SkuLookup>({ state: 'empty' });
  const latest = useRef(0);
  const lookUp = useCallback(async (code: string) => {
    const attempt = ++latest.current;
    const trimmed = code.trim();
    if (trimmed === '') { setSku({ state: 'empty' }); return; }
    setSku({ state: 'resolving' });
    const target = await resolve(trimmed);
    if (attempt !== latest.current) return;
    if (target === null) setSku({ state: 'notFound' });
    else if (target.kind !== 'product') setSku({ state: 'notSku' }); // μοντέλο ≠ SKU: δεν τιμολογείται
    else setSku({ state: 'ready', subject: { kind: 'variant', variantId: target.id } });
  }, [resolve]);
  return { sku, lookUp };
}

function useViewers() {
  const [viewers, setViewers] = useState<readonly AnalysisViewer[]>([FIRST_VIEWER]);
  const nextKey = useRef(1);
  const add = useCallback(() => {
    const key = `viewer-${nextKey.current++}`;
    setViewers((current) => (current.length < MAX_ANALYSIS_VIEWERS ? [...current, { key, audience: { kind: 'signedIn' } }] : current));
  }, []);
  const change = useCallback((key: string, audience: PriceAudience) => {
    setViewers((current) => current.map((viewer) => (viewer.key === key ? { key, audience } : viewer)));
  }, []);
  const remove = useCallback((key: string) => {
    setViewers((current) => (current.length > 1 ? current.filter((viewer) => viewer.key !== key) : current));
  }, []);
  return { viewers, add, change, remove };
}

interface QuoteQuery {
  readonly subject: PriceLineSubject;
  readonly quantity: number;
  readonly at: string | null;
}

async function readCells(query: QuoteQuery, viewers: readonly AnalysisViewer[]): Promise<Readonly<Record<string, AnalysisCell>>> {
  const settled = await Promise.allSettled(
    viewers.map((viewer) => fetchPriceQuote({ ...query, viewAs: viewer.audience, priceListId: null })),
  );
  return Object.fromEntries(settled.map((outcome, index): [string, AnalysisCell] => [
    viewers[index].key,
    outcome.status === 'fulfilled' ? { state: 'ready', result: outcome.value } : { state: 'failed' },
  ]));
}

interface UsePriceAnalysisInput {
  readonly attributes: readonly AttributeRecord[];
  /** Οι αριθμοί σήματος των όψεων: όταν αλλάξουν, ξαναρωτάμε. */
  readonly revision: string;
}

function useAnalysisCells(subject: PriceLineSubject | null, quantity: number, at: string | null, viewers: readonly AnalysisViewer[], revision: string) {
  const asked = useMemo(() => viewers.filter((viewer) => isCompleteAudience(viewer.audience)), [viewers]);
  const reads = useAsyncData<Readonly<Record<string, AnalysisCell>>>({
    fetcher: () => (subject === null ? Promise.resolve({}) : readCells({ subject, quantity, at }, asked)),
    deps: [subject, quantity, at, asked, revision],
    enabled: subject !== null && quantity > 0 && asked.length > 0,
  });
  const cells = useMemo(
    () => viewers.map((viewer): AnalysisCell => {
      if (!isCompleteAudience(viewer.audience)) return INCOMPLETE_CELL;
      return reads.data?.[viewer.key] ?? (reads.error === null ? LOADING_CELL : { state: 'failed' });
    }),
    [viewers, reads.data, reads.error],
  );
  return { cells, busy: reads.loading };
}

function useHistory(subject: PriceLineSubject | null, priceListId: string | null, revision: string) {
  return useAsyncData<PriceHistoryResult | null>({
    fetcher: () => (subject === null || priceListId === null ? Promise.resolve(null) : fetchPriceHistory({ priceListId, subject })),
    deps: [subject, priceListId, revision],
    enabled: subject !== null && priceListId !== null,
  });
}

export function usePriceAnalysis({ attributes, revision }: UsePriceAnalysisInput) {
  const { sku, lookUp } = useSkuLookup(attributes);
  const viewers = useViewers();
  const [quantity, setQuantity] = useState(1);
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [chosenList, setChosenList] = useState<string | null>(null);
  const subject = sku.state === 'ready' && quantity > 0 ? sku.subject : null;
  const { cells, busy } = useAnalysisCells(subject, quantity, validFromOfPicker(day), viewers.viewers, revision);
  const historyListId = historyListOf(chosenList, cells);
  const history = useHistory(subject, historyListId, revision);
  return { sku, lookUp, ...viewers, quantity, setQuantity, day, setDay, cells, busy, historyListId, setChosenList, history, hasSubject: subject !== null };
}

export type PriceAnalysis = ReturnType<typeof usePriceAnalysis>;
