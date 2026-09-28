'use client';

/**
 * **Οι ζώνες αντικειμενικών αξιών μιας περιοχής, για τον χάρτη** (ADR-889 Φ5) — ίδιο ιδίωμα με το `useAdminBoundary`.
 *
 * Τέσσερις καταστάσεις, καμία σιωπηλή: `none` (ο server είπε «καμία ζώνη εδώ» — γεγονός) · `loading` · `ready` ·
 * `unavailable` (ρώτησα και δεν έμαθα — **ποτέ** «καμία ζώνη»).
 */

import { useMemo } from 'react';

import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { valueZoneLayerSource, type ValueZoneLayer } from '@/lib/market/value-zones';

export type ValueZoneLayerState =
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly layer: ValueZoneLayer }
  | { readonly status: 'unavailable' };

/** Ονομασμένη απάντηση «ρώτησα και δεν έμαθα» — συγκρίνεται με **ταυτότητα**. */
const UNAVAILABLE: ValueZoneLayer = { zones: [], fronts: [] };

/** Πηγή για «δεν ζητήθηκε τίποτα» — απαντά αμέσως, δεν ρωτά ποτέ το δίκτυο. */
const NOTHING: LazyJsonSnapshot<ValueZoneLayer> = { peek: () => UNAVAILABLE, load: async () => undefined };

/** `fileIds` από τον server: `null` = το ευρετήριο δεν διαβάστηκε · `[]` = η περιοχή δεν έχει ζώνες. */
export function useValueZoneLayer(fileIds: readonly string[] | null): ValueZoneLayerState {
  const idle = fileIds === null || fileIds.length === 0;
  const source = idle ? NOTHING : valueZoneLayerSource(fileIds);
  const layer = useLazySnapshot(source, UNAVAILABLE);

  return useMemo((): ValueZoneLayerState => {
    if (fileIds === null) return { status: 'unavailable' };
    if (fileIds.length === 0) return { status: 'none' };
    if (layer === null) return { status: 'loading' };
    if (layer === UNAVAILABLE) return { status: 'unavailable' };
    return { status: 'ready', layer };
  }, [fileIds, layer]);
}
