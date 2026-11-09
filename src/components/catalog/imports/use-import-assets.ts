'use client';

/**
 * @fileoverview **Η ουρά μέσων μιας παρτίδας** (ADR-934 §5.2.2 Μ-β4): όταν ανοίγει ανοιχτή παρτίδα, κάθε διεύθυνση που δεν έχει
 *   κατέβει ακόμη ζητείται από τον διακομιστή — ως {@link ASSET_FETCH_CONCURRENCY} μαζί, ως {@link ASSET_FETCH_PER_HOST} προς τον ίδιο
 *   server (ευγένεια προς τον CDN του προμηθευτή, όπως οι browsers ανά προέλευση). Κάθε απάντηση αντικαθιστά τη γραμμή της.
 * @module components/catalog/imports/use-import-assets
 *
 * 🔑 **Μία ουρά, όχι δεύτερη**: `createPriorityTaskQueue` (ιδεμπότητο ανά κλειδί = URI, ακύρωση ανά ομάδα = host). Η «Ξαναδοκιμή»
 *    μπαίνει μπροστά (προτεραιότητα 0).
 * 🔑 **Αισιόδοξα**: η γραμμή γίνεται «κατεβαίνει» τη στιγμή που ξεκινά· βλάβη μεταφοράς την επαναφέρει όπως ήταν.
 * 🔑 **429 ⇒ αναμονή, όχι αποτυχία**: το `apiClient` δεν ξαναδοκιμάζει σε 429· εδώ περιμένουμε όσο λέει το `Retry-After`
 *    (RFC 9110 §10.2.3) και ξαναζητάμε — ο διακομιστής είναι ιδεμπότητος ανά διεύθυνση, άρα η επανάληψη δεν κατεβάζει δύο φορές.
 * 🔑 Κάθε διεύθυνση ζητείται **μία φορά ανά άνοιγμα** αυτόματα: αποτυχία δεν γίνεται βρόχος, ξαναδοκιμάζεται μόνο ρητά.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createPriorityTaskQueue, isTaskCancelled, type PriorityTaskQueue } from '@/lib/async/priority-task-queue';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { retryAfterMs } from '@/lib/http/retry-after';
import { fetchImportAsset, fetchImportAssets } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportAssetView } from '@/subapps/catalog/types/catalog-media';
import { ASSET_FETCH_CONCURRENCY, ASSET_FETCH_PER_HOST } from '@/subapps/catalog/vocabulary/asset-fetch';

const RATE_LIMITED = 429;
/** Χωρίς `Retry-After`: όσο το παράθυρο του ορίου ρυθμού (ανά λεπτό) χρειάζεται για να αδειάσει κατά το ήμισυ. */
const RATE_LIMIT_FALLBACK_WAIT_MS = 30_000;
const RATE_LIMIT_MAX_WAIT_MS = 60_000;
const RATE_LIMIT_ATTEMPTS = 3;
const RETRY_PRIORITY = 0;
const AUTO_PRIORITY = 1;

/** Η ομάδα της ουράς: ο server της διεύθυνσης. Άκυρη (δεν θα έπρεπε — είναι κανονική) ⇒ η ίδια, μόνη της. */
function hostOf(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

async function fetchRespectingRateLimit(batchId: string, uri: string, retry: boolean, signal: AbortSignal): Promise<ImportAssetView> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchImportAsset(batchId, { uri, retry });
    } catch (error) {
      const limited = ApiClientError.isApiClientError(error) && error.statusCode === RATE_LIMITED;
      if (!limited || attempt >= RATE_LIMIT_ATTEMPTS) throw error;
      await waitFor(retryAfterMs(error.response, RATE_LIMIT_MAX_WAIT_MS) ?? RATE_LIMIT_FALLBACK_WAIT_MS, signal);
    }
  }
}

type SetFailure = (failure: CatalogFailure | null) => void;

/** Η ουρά της παρτίδας: καινούργια σε κάθε παρτίδα, και ό,τι εκκρεμεί ακυρώνεται όταν φεύγει ο άνθρωπος. */
function useAssetQueue(batchId: string, open: boolean) {
  const queue = useRef<PriorityTaskQueue | null>(null);
  const groups = useRef(new Set<string>());
  const cancelAll = useCallback(() => {
    for (const group of groups.current) queue.current?.cancelGroup(group);
  }, []);
  useEffect(() => {
    queue.current = createPriorityTaskQueue(ASSET_FETCH_CONCURRENCY, { perGroup: ASSET_FETCH_PER_HOST });
    groups.current = new Set();
    return cancelAll;
  }, [batchId, cancelAll]);
  // Η παρτίδα έκλεισε ή εγκαταλείφθηκε: καμία νέα λήψη — ο διακομιστής θα την αρνιόταν έτσι κι αλλιώς.
  useEffect(() => {
    if (!open) cancelAll();
  }, [open, cancelAll]);
  return { queue, groups };
}

export function useImportAssets(batchId: string, open: boolean, setFailure: SetFailure) {
  const [assets, setAssets] = useState<readonly ImportAssetView[] | null>(null);
  const asked = useRef(new Set<string>());
  const { queue, groups } = useAssetQueue(batchId, open);
  // Η τελευταία συνάρτηση αναφοράς: ο καλών δεν οφείλει να τη σταθεροποιήσει, και η αλλαγή της δεν ξαναφορτώνει την ουρά.
  const report = useRef(setFailure);
  useEffect(() => {
    report.current = setFailure;
  }, [setFailure]);
  const fail = useCallback((cause: unknown) => report.current(catalogFailureOf(cause)), []);

  useEffect(() => {
    let alive = true;
    asked.current = new Set();
    setAssets(null);
    fetchImportAssets(batchId).then(
      (view) => {
        if (alive) setAssets(view.assets);
      },
      (cause: unknown) => {
        if (alive) fail(cause);
      },
    );
    return () => {
      alive = false;
    };
  }, [batchId, fail]);

  const replace = useCallback((view: ImportAssetView) => setAssets((current) => current?.map((asset) => (asset.uri === view.uri ? view : asset)) ?? current), []);

  const schedule = useCallback((asset: ImportAssetView, retry: boolean) => {
    const group = hostOf(asset.uri);
    groups.current.add(group);
    queue.current?.schedule(asset.uri, { priority: retry ? RETRY_PRIORITY : AUTO_PRIORITY, group }, (signal) => {
      replace({ ...asset, status: 'fetching', failure: null });
      return fetchRespectingRateLimit(batchId, asset.uri, retry, signal);
    }).then(replace, (cause: unknown) => {
      replace(asset);
      if (!isTaskCancelled(cause)) fail(cause);
    });
  }, [batchId, fail, groups, queue, replace]);

  useEffect(() => {
    if (!open || assets === null) return;
    for (const asset of assets) {
      if (asset.status !== 'queued' || asked.current.has(asset.uri)) continue;
      asked.current.add(asset.uri);
      schedule(asset, false);
    }
  }, [assets, open, schedule]);

  const retry = useCallback((asset: ImportAssetView) => schedule(asset, true), [schedule]);
  const retryFailed = useCallback(() => {
    for (const asset of assets ?? []) if (asset.status === 'failed') schedule(asset, true);
  }, [assets, schedule]);
  return { assets, retry, retryFailed };
}
