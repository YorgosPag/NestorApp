'use client';

/**
 * @fileoverview **ΤΟ ΔΗΜΟΣΙΕΥΜΕΝΟ ΣΤΙΓΜΙΟΤΥΠΟ ΕΔΑΦΟΥΣ, ΟΤΑΝ ΖΗΤΗΘΕΙ** (ADR-920 Β6.6).
 * @related lib/terrain/publication/listing-terrain-snapshot-fetch (το fetch + η ονομασμένη απάντηση) ·
 *   components/listing-detail/terrain/ListingTerrainPanel (ο καταναλωτής) · hooks/geo/usePlaceOutline (το ίδιο σχήμα)
 * @module hooks/listings/useListingTerrainSnapshot
 *
 * 🔑 **Κατεβαίνει όταν προσαρτηθεί ο καταναλωτής** — η καρτέλα «Ανάγλυφο» προσαρτά τη σκηνή της μόνο όταν ανοίξει, άρα
 *   κανένα byte δεν φεύγει για επισκέπτη που δεν την πάτησε.
 * 🔑 **`AbortController`, όχι σημαία**: αλλαγή καρτέλας ή αγγελίας κόβει το αίτημα — κανείς δεν πληρώνει μεγαμπάιτ που
 *   κανείς δεν θα διαβάσει. Η ακύρωση δεν είναι αποτυχία.
 * 🔑 **Η άρνηση πάει στο ημερολόγιο, όχι στον επισκέπτη**: εκείνος διαβάζει «δεν μπορεί να εμφανιστεί»· ο λόγος
 *   (`unknown-version`, `index-out-of-range`…) είναι για εμάς.
 */

import { useCallback, useEffect, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import { fetchListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot-fetch';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

const logger = createModuleLogger('useListingTerrainSnapshot');

/**
 * | Κατάσταση | Τι λέει στον άνθρωπο |
 * |---|---|
 * | `loading` | κατεβαίνει |
 * | `ready` | ορίστε το ανάγλυφο |
 * | `unreachable` | **δεν μάθαμε** — η επανάληψη μπορεί να βοηθήσει |
 * | `refused` | ήρθε, αλλά δεν σχεδιάζεται — η επανάληψη **δεν** θα βοηθήσει |
 */
export type ListingTerrainSnapshotState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly snapshot: ListingTerrainSnapshot }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'refused' };

export interface ListingTerrainSnapshotApi {
  readonly state: ListingTerrainSnapshotState;
  /** Νέα προσπάθεια — έχει νόημα μόνο στο `unreachable`. */
  readonly retry: () => void;
}

export function useListingTerrainSnapshot(url: string): ListingTerrainSnapshotApi {
  const [state, setState] = useState<ListingTerrainSnapshotState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchListingTerrainSnapshot(url, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (result.kind === 'ready') {
          setState({ kind: 'ready', snapshot: result.snapshot });
        } else if (result.kind === 'refused') {
          logger.warn('Το δημοσιευμένο στιγμιότυπο εδάφους δεν διαβάζεται', { data: { url, reason: result.reason } });
          setState({ kind: 'refused' });
        } else {
          logger.warn('Το δημοσιευμένο στιγμιότυπο εδάφους δεν απάντησε', { data: { url, status: result.status } });
          setState({ kind: 'unreachable' });
        }
      },
      (error: unknown) => {
        // Η ακύρωση είναι εντολή μας, όχι αποτυχία. Οτιδήποτε άλλο ⇒ ποτέ κολλημένο «Φόρτωση…».
        if (controller.signal.aborted) return;
        logger.warn('Απρόσμενη αποτυχία στο στιγμιότυπο εδάφους', { data: { url }, error: String(error) });
        setState({ kind: 'unreachable' });
      },
    );
    return () => controller.abort();
  }, [url, attempt]);

  return { state, retry };
}
