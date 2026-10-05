'use client';

/**
 * @fileoverview **Η λίστα χώρων μιας καρτέλας κτιρίου** (θέσεις · αποθήκες) — ADR-898 §21.6 Ε2β · ADR-300.
 * @module components/building-management/shared/useBuildingSpaceList
 *
 * 🔴 **«Δεν φόρτωσε» ≠ «δεν υπάρχει καμία»**: η καρτέλα αποθηκών σε αποτυχημένη ανάγνωση έκανε `setUnits([])` και έδειχνε
 *   «Αποθήκες — 0» (ή την προτροπή «πρόσθεσε αποθήκη»): ψευδές πράσινο, ίδια κλάση με το Ε2. Η καρτέλα θέσεων έδειχνε
 *   σφάλμα, αλλά με το ωμό κείμενο του server και πετώντας τη λίστα που ήδη είχε. Οι δύο καρτέλες έγραφαν το ίδιο fetch
 *   με το χέρι· γράφεται εδώ μία φορά.
 * 🔑 Ρητή κατάσταση `loading | ready | error`, από τον ΕΝΑ μηχανισμό ανάγνωσης με αρίθμηση (`useReconciledResource`:
 *   εφαρμόζεται μόνο η τελευταία απάντηση). Η απάντηση κρατιέται **μαζί με το κτίριο που ρωτήθηκε**.
 * 🔑 Η τελευταία γνωστή λίστα (cache ADR-300) **μένει** στην οθόνη όταν η επανανάγνωση αποτύχει — `known` λέει στον
 *   καταναλωτή αν έχει κάτι αληθινό να δείξει δίπλα στο σφάλμα.
 */

import { useCallback, useMemo } from 'react';

import { useReconciledResource } from '@/hooks/useReconciledResource';
import type { StaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useBuildingSpaceList');

export type BuildingSpaceListStatus = 'loading' | 'ready' | 'error';

/** Η ανάγνωση μιας λίστας: **πετά** σε αποτυχία — κενός πίνακας σημαίνει «ο server είπε καμία». */
export type BuildingSpaceListLoader<T> = (buildingId: string) => Promise<T[]>;

export interface BuildingSpaceList<T> {
  readonly items: T[];
  /** `error` ⇒ η τελευταία ανάγνωση απέτυχε· τα `items` είναι τότε η τελευταία γνωστή εικόνα (αν `known`). */
  readonly status: BuildingSpaceListStatus;
  /** Υπάρχει λίστα που απάντησε κάποτε ο server για ΑΥΤΟ το κτίριο; */
  readonly known: boolean;
  readonly refetch: () => Promise<void>;
}

interface LoadedList<T> {
  readonly buildingId: string;
  readonly items: T[];
}

/**
 * @param cache — η cache επιπέδου module της καρτέλας (ADR-300): μηδέν spinner στην επιστροφή.
 * @param loadList — **σταθερή αναφορά** (module-level ή `useCallback`)· αλλαγή της ξαναδιαβάζει.
 */
export function useBuildingSpaceList<T>(
  buildingId: string,
  cache: StaleCache<T[]>,
  loadList: BuildingSpaceListLoader<T>,
): BuildingSpaceList<T> {
  const load = useCallback(async (): Promise<LoadedList<T> | null> => {
    try {
      const items = await loadList(buildingId);
      cache.set(items, buildingId);
      return { buildingId, items };
    } catch (error) {
      logger.warn('Building space list failed to load', { buildingId, error: String(error) });
      return null;
    }
  }, [buildingId, cache, loadList]);

  const { data, status, refresh } = useReconciledResource(load);

  return useMemo(() => {
    const fresh = data?.buildingId === buildingId ? data.items : null;
    const items = fresh ?? cache.get(buildingId);
    const known = items !== null;
    return {
      items: items ?? [],
      status: status === 'error' ? 'error' : known ? 'ready' : 'loading',
      known,
      refetch: refresh,
    };
  }, [data, status, refresh, buildingId, cache]);
}
