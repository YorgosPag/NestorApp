'use client';

/**
 * @fileoverview **Το ευρετήριο περιοχών για την οθόνη** — ονόματα, γενεαλογία, αναζήτηση (ADR-883).
 * `null` = φορτώνει ακόμη· κενό ευρετήριο = «ρώτησα και δεν έμαθα» (δες `useLazySnapshot`).
 */

import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { ADMIN_AREA_INDEX_SOURCE, buildAdminAreaIndex, type AdminAreaIndex } from '@/lib/geo/admin-area-search';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';

const EMPTY_INDEX: AdminAreaIndex = buildAdminAreaIndex(new Map());

/** «Δεν ζητήθηκε ακόμη» — δεν ρωτά ποτέ το δίκτυο, και δεν είναι αποτυχία. */
const NOT_ASKED: LazyJsonSnapshot<AdminAreaIndex> = {
  peek: () => null,
  load: () => new Promise<void>(() => undefined),
};

/**
 * @param wanted `false` ⇒ **καμία** λήψη ακόμη (`null`). Η αρχική σελίδα το ζητά μόνο όταν
 *   ο άνθρωπος ανοίξει το πεδίο — τα ~100 KB δεν τα πληρώνει όποιος απλώς περνά.
 */
export function useAdminAreaIndex(wanted = true): AdminAreaIndex | null {
  return useLazySnapshot(wanted ? ADMIN_AREA_INDEX_SOURCE : NOT_ASKED, EMPTY_INDEX);
}
