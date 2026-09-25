'use client';

/**
 * @fileoverview **Το όριο μιας περιοχής για την οθόνη** — τρεις ρητές καταστάσεις, ποτέ `boolean`.
 * @related ADR-883 · `lib/geo/admin-boundaries.ts` · `hooks/useLazySnapshot.ts`
 * @module hooks/geo/useAdminBoundary
 *
 * 🔑 **«Φορτώνει» ≠ «μη διαθέσιμο» ≠ «καμία περιοχή»** — και καθένα έχει διαφορετική θεραπεία:
 * το πρώτο **περιμένει** (η λίστα δεν διαβάζει όλη την Ελλάδα για να αναβοσβήσει μετά), το
 * δεύτερο **λέγεται** στον άνθρωπο, το τρίτο δεν δείχνει τίποτα.
 */

import { useMemo } from 'react';

import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { adminBoundarySource, type LoadedAdminBoundary } from '@/lib/geo/admin-boundaries';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';

export type AdminBoundaryState =
  | { readonly status: 'none' }
  | { readonly status: 'loading'; readonly adminId: string }
  | { readonly status: 'ready'; readonly adminId: string; readonly boundary: LoadedAdminBoundary }
  | { readonly status: 'unavailable'; readonly adminId: string };

/** Ονομασμένη απάντηση «ρώτησα και δεν έμαθα» — συγκρίνεται με **ταυτότητα**. */
const UNAVAILABLE: LoadedAdminBoundary = {
  geometry: { type: 'MultiPolygon', coordinates: [] },
  level: 0,
  region: { adminId: '', rings: [], bbox: { south: 0, west: 0, north: 0, east: 0 }, toleranceM: 0 },
};

/** Πηγή για «καμία περιοχή» — απαντά αμέσως, δεν ρωτά ποτέ το δίκτυο. */
const NO_REGION: LazyJsonSnapshot<LoadedAdminBoundary> = {
  peek: () => UNAVAILABLE,
  load: async () => undefined,
};

export function useAdminBoundary(adminId: string | null): AdminBoundaryState {
  const boundary = useLazySnapshot(adminId === null ? NO_REGION : adminBoundarySource(adminId), UNAVAILABLE);

  // 🔑 Σταθερή ταυτότητα: η κατάσταση αλλάζει **μόνο** όταν αλλάξει ο δήμος ή φτάσει το
  //    όριο — αλλιώς κάθε `useMemo` πιο κάτω θα ξαναέκρινε όλες τις αγγελίες σε κάθε απόδοση.
  return useMemo((): AdminBoundaryState => {
    if (adminId === null) return { status: 'none' };
    if (boundary === null) return { status: 'loading', adminId };
    if (boundary === UNAVAILABLE) return { status: 'unavailable', adminId };
    return { status: 'ready', adminId, boundary };
  }, [adminId, boundary]);
}
