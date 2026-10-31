/**
 * @fileoverview **ΜΙΑ ΛΙΣΤΑ ΜΕ ΔΡΟΜΕΑ, ΣΤΟΝ ΠΕΛΑΤΗ** — «φόρτωσε περισσότερα» πάνω σε endpoint που επιστρέφει
 * `PaginatedResult` (`lib/pagination.ts`).
 * @related Google AIP-158 · ADR-ACC-010 §2.1.1 Φάση 3β · ADR-300 (stale cache)
 * @module hooks/useCursorPagedList
 *
 * 🔑 Τέσσερα hooks/σελίδες της λογιστικής ξανάγραφαν το ίδιο «token → fetch → json → items» και ΚΑΝΕΝΑ δεν μπορούσε
 * να ζητήσει 2η σελίδα. Εδώ ζει **μία φορά**:
 *   - **ρητό σφάλμα** (`error` με κωδικό/κατάσταση) — ποτέ «κενή λίστα» όταν απέτυχε η ανάγνωση·
 *   - **χωρίς αγώνα**: κάθε απάντηση ανήκει σε μια **ταυτότητα** (endpoint + φίλτρα + γενιά)· απάντηση παλιάς
 *     ταυτότητας (ο χρήστης άλλαξε φίλτρο ενώ φόρτωνε) **πετιέται**, δεν γράφει πάνω στη νέα λίστα·
 *   - **ένα «περισσότερα» τη φορά**: διπλό κλικ δεν φέρνει την ίδια σελίδα δύο φορές·
 *   - ADR-300: η πρώτη σελίδα σπέρνεται από την προσωρινή μνήμη (μηδέν αναβόσβημα στην επιστροφή).
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { PaginatedResult } from '@/lib/pagination';
import type { StaleCache } from '@/lib/stale-cache';

/** Τιμή φίλτρου στο query — `undefined` ⇒ το φίλτρο δεν στέλνεται. */
export type PagedListParamValue = string | number | undefined;

/** Η πρώτη σελίδα, όπως κρατιέται στην προσωρινή μνήμη. */
export interface CachedFirstPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Γιατί δεν φορτώθηκε η λίστα — ο κωδικός του διακομιστή (αν υπάρχει) για μετάφραση στο UI. */
export interface PagedListError {
  readonly status: number | null;
  readonly code: string | null;
}

export interface UseCursorPagedListOptions<T> {
  readonly url: string;
  readonly params: Readonly<Record<string, PagedListParamValue>>;
  /** Πύλη (π.χ. συνδεδεμένος χρήστης). Όσο είναι `false`, δεν φεύγει αίτημα. */
  readonly enabled: boolean;
  readonly pageSize?: number;
  readonly cache?: StaleCache<CachedFirstPage<T>>;
}

export interface UseCursorPagedListReturn<T> {
  readonly items: T[];
  /** Η πρώτη σελίδα φορτώνει (και δεν υπάρχει τίποτα να δειχτεί). */
  readonly loading: boolean;
  readonly loadingMore: boolean;
  readonly error: PagedListError | null;
  readonly hasMore: boolean;
  readonly loadMore: () => Promise<void>;
  readonly refetch: () => Promise<void>;
}

/**
 * Το URL μιας λίστας με τα φίλτρα της. Εξάγεται ώστε μια **σύνοψη** της ίδιας λίστας (π.χ. `INVOICES.SUMMARY`) να
 * στέλνει ακριβώς τις ίδιες παραμέτρους — `cursor: null` και χωρίς `pageSize`.
 */
export function buildUrl(url: string, params: Readonly<Record<string, PagedListParamValue>>, cursor: string | null, pageSize?: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  if (pageSize !== undefined) query.set('pageSize', String(pageSize));
  if (cursor !== null) query.set('cursor', cursor);
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

function toPagedListError(error: unknown): PagedListError {
  if (error instanceof ApiClientError) return { status: error.statusCode, code: error.errorCode ?? null };
  return { status: null, code: null };
}

/** Σταθερή ταυτότητα της λίστας: ίδιο endpoint + ίδια φίλτρα ⇔ ίδιο κλειδί, ανεξάρτητα από τη σειρά των κλειδιών. */
function identityOf(url: string, params: Readonly<Record<string, PagedListParamValue>>, pageSize?: number): string {
  return buildUrl(url, Object.fromEntries(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1))), null, pageSize);
}

export function useCursorPagedList<T>(options: UseCursorPagedListOptions<T>): UseCursorPagedListReturn<T> {
  const { url, params, enabled, pageSize, cache } = options;
  const identity = useMemo(() => identityOf(url, params, pageSize), [url, params, pageSize]);
  const cached = cache?.get(identity) ?? null;

  const [items, setItems] = useState<T[]>(cached ? [...cached.items] : []);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<PagedListError | null>(null);

  // Η ταυτότητα της ΤΡΕΧΟΥΣΑΣ λίστας + γενιά (κάθε refetch) — απαντήσεις άλλης ταυτότητας πετιούνται.
  const current = useRef({ identity, generation: 0 });
  const loadingMoreRef = useRef(false);
  // 🔑 Οι καλούντες περνούν `params` ως ΝΕΟ αντικείμενο σε κάθε render: η ανάγνωση είναι σταθερή συνάρτηση
  //    (`useEventCallback`) και η ανανέωση κρέμεται από την ταυτότητα-ΚΕΙΜΕΝΟ — αλλιώς κάθε render θα ξαναζητούσε.
  const fetchPage = useEventCallback((cursor: string | null) =>
    apiClient.get<PaginatedResult<T>>(buildUrl(url, params, cursor, pageSize)));

  const refetch = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const ticket = { identity, generation: current.current.generation + 1 };
    current.current = ticket;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    if (!cache?.hasLoaded(identity)) setLoading(true);
    try {
      const page = await fetchPage(null);
      if (current.current !== ticket) return;
      cache?.set({ items: page.items, nextCursor: page.nextCursor }, identity);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (current.current !== ticket) return;
      setItems([]);
      setNextCursor(null);
      setError(toPagedListError(cause));
    } finally {
      if (current.current === ticket) setLoading(false);
    }
  }, [enabled, identity, cache, fetchPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!enabled || nextCursor === null || loadingMoreRef.current) return;
    const ticket = current.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextCursor);
      if (current.current !== ticket) return;
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (cause) {
      if (current.current === ticket) setError(toPagedListError(cause));
    } finally {
      if (current.current === ticket) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [enabled, nextCursor, fetchPage]);

  // Νέα ταυτότητα (φίλτρα / χρήστης) ⇒ σπορά από την προσωρινή μνήμη + ανανέωση.
  useEffect(() => {
    const seed = cache?.get(identity) ?? null;
    setItems(seed ? [...seed.items] : []);
    setNextCursor(seed?.nextCursor ?? null);
    void refetch();
  }, [identity, cache, refetch]);

  return { items, loading, loadingMore, error, hasMore: nextCursor !== null, loadMore, refetch };
}
