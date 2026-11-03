'use client';

/**
 * Η ζωντανή λίστα ενός καταλόγου προμηθειών (ADR-330 · ADR-355 · ADR-361 · ADR-300) — υλικά, συμβάσεις-πλαίσιο.
 *
 * Διαβάζει μέσω `firestoreQueryService.subscribe`, με stale cache ώστε η επιστροφή στη σελίδα να μην
 * αναβοσβήνει. Τα δύο hooks διέφεραν μόνο στη συλλογή, στη σειρά και στο κείμενο του log (CHECK 3.28).
 *
 * ⚠️ Το `config` πρέπει να είναι σταθερή τιμή επιπέδου module: είναι εξάρτηση της συνδρομής.
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { CollectionKey } from '@/config/firestore-collections';
import type { StaleCache } from '@/lib/stale-cache';
import type { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';

export interface ProcurementCatalogListConfig<T> {
  readonly collection: CollectionKey;
  readonly cache: StaleCache<T[]>;
  readonly compare: (a: T, b: T) => number;
  readonly logger: ReturnType<typeof createModuleLogger>;
  /** Όνομα για τα μηνύματα log, π.χ. `Materials`. */
  readonly label: string;
}

export interface ProcurementCatalogList<T> {
  readonly items: T[];
  readonly loading: boolean;
  readonly error: string | null;
}

export function useProcurementCatalogList<T extends { readonly isDeleted: boolean }>(
  config: ProcurementCatalogListConfig<T>,
): ProcurementCatalogList<T> {
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;

  const { cache, collection, compare, label, logger } = config;
  const [items, setItems] = useState<T[]>(cache.get() ?? []);
  const [loading, setLoading] = useState(!cache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('AUTH_REQUIRED');
      return;
    }
    if (!companyId) {
      setLoading(false);
      setError('COMPANY_ID_UNAVAILABLE');
      return;
    }

    setLoading(!cache.hasLoaded());

    return firestoreQueryService.subscribe<Record<string, unknown>>(
      collection,
      (result) => {
        const next = result.documents
          .map((d) => d as unknown as T)
          .filter((item) => item.isDeleted === false)
          .sort(compare);

        cache.set(next);
        setItems(next);
        setLoading(false);
        setError(null);
        logger.info(`${label} loaded`, { count: next.length });
      },
      (err) => {
        logger.error(`${label} subscription error`, { error: err.message });
        setError('SUBSCRIPTION_ERROR');
        setLoading(false);
      },
      {
        // companyId auto-injected by firestoreQueryService (tenant-config default)
        constraints: [where('isDeleted', '==', false)],
      },
    );
  }, [authLoading, user, companyId, cache, collection, compare, label, logger]);

  return { items, loading, error };
}
