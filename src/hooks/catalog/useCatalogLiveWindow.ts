'use client';
/**
 * **Ζωντανό παράθυρο που μεγαλώνει** — η σελιδοποίηση της Firestore **χωρίς** μπαγιάτικες σελίδες (ADR-923 §5.10.4 Β2).
 *
 * Ένας ακροατής με `limit` που αυξάνεται με «περισσότερα» (το πρότυπο της Firestore για ζωντανές λίστες): κάθε
 * στοιχείο του παραθύρου μένει **ζωντανό** — μια αλλαγή αλλού φαίνεται αμέσως, χωρίς «ανανέωση σελίδας». Δρομέας
 * `startAfter` θα έδινε σελίδες που παλιώνουν μόλις γραφτούν (στοιχείο που αλλάζει θέση = διπλό ή χαμένο).
 *
 * Οι περιορισμοί χτίζονται **μόνο** από το σχέδιο (`catalogListQueryPlan`) — εκεί που η άγκυρα ελέγχει τους δείκτες.
 * Όταν μεγαλώνει το όριο τα ορατά **μένουν** ως το νέο στιγμιότυπο (η λίστα δεν αναβοσβήνει).
 *
 * @module hooks/catalog/useCatalogLiveWindow
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { orderBy, where, type QueryConstraint } from 'firebase/firestore';

import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { LiveWindow } from '@/lib/firestore/merge-live-windows';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { CatalogListQueryPlan } from '@/subapps/catalog/list/catalog-list-query';

import type { CatalogLoadState } from './useCatalogCollection';

const logger = createModuleLogger('useCatalogLiveWindow');

export type CatalogWindowKey = 'CATALOG_PRODUCT_MODELS' | 'CATALOG_PRODUCTS';

export interface CatalogLiveWindow<T> extends LiveWindow<T> {
  readonly state: CatalogLoadState;
  /** Μεγάλωσε το παράθυρο κατά μία σελίδα. */
  readonly grow: () => void;
}

/** Οι περιορισμοί του σχεδίου — η **μόνη** μετάφραση σχέδιο → Firestore. */
export function constraintsOfPlan(plan: CatalogListQueryPlan): QueryConstraint[] {
  const constraints: QueryConstraint[] = plan.equalities.map(([field, value]) => where(field, '==', value));
  if (plan.arrayContainsAny) constraints.push(where(plan.arrayContainsAny[0], 'array-contains-any', plan.arrayContainsAny[1]));
  constraints.push(orderBy(plan.orderBy[0], plan.orderBy[1]));
  return constraints;
}

interface WindowState<T> {
  readonly planKey: string;
  readonly limit: number;
  readonly state: CatalogLoadState;
  readonly items: readonly T[];
  readonly complete: boolean;
}

export function useCatalogLiveWindow<T>(key: CatalogWindowKey, plan: CatalogListQueryPlan | null, pageSize: number): CatalogLiveWindow<T> {
  const { user, loading: authLoading } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const planKey = plan ? JSON.stringify(plan) : '';
  const planRef = useRef(plan);
  planRef.current = plan;
  const [win, setWin] = useState<WindowState<T>>({ planKey, limit: pageSize, state: 'loading', items: [], complete: false });
  // Νέο σχέδιο (φίλτρο/ταξινόμηση) ⇒ ξανά από την πρώτη σελίδα.
  const current = win.planKey === planKey ? win : { planKey, limit: pageSize, state: 'loading' as const, items: [], complete: false };
  const { limit } = current;

  useEffect(() => {
    // Το σχέδιο διαβάζεται από ref: η εξάρτηση είναι η ταυτότητα του ΠΕΡΙΕΧΟΜΕΝΟΥ του (`planKey`), όχι η αναφορά.
    const plan = planRef.current;
    if (authLoading || !plan) return undefined;
    if (!user || !companyId) { setWin((prev) => ({ ...prev, planKey, state: 'failed' })); return undefined; }
    return firestoreQueryService.subscribe<T & Record<string, unknown>>(
      key,
      (result) => setWin({ planKey, limit, state: 'ready', items: result.documents, complete: result.documents.length < limit }),
      (error) => {
        logger.error('Η ζωντανή λίστα του καταλόγου απέτυχε', { key, error: error.message });
        setWin((prev) => ({ ...prev, planKey, limit, state: 'failed' }));
      },
      { constraints: constraintsOfPlan(plan), maxResults: limit },
    );
  }, [authLoading, user, companyId, key, planKey, limit]);

  const grow = useCallback(() => setWin((prev) => (prev.planKey === planKey ? { ...prev, limit: prev.limit + pageSize } : prev)), [planKey, pageSize]);
  return useMemo(() => ({ state: current.state, items: current.items, complete: current.complete, grow }), [current.state, current.items, current.complete, grow]);
}
