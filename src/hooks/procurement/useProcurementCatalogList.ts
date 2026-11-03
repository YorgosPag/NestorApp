'use client';

/**
 * Η ζωντανή λίστα ενός καταλόγου προμηθειών (ADR-330 · ADR-355 · ADR-361 · ADR-300) — υλικά, συμβάσεις-πλαίσιο,
 * συμφωνητικά υπεργολαβίας ανά έργο, βιβλιοθήκη ρητρών και πρότυπα (ADR-928 Φ3α-2).
 *
 * Διαβάζει μέσω `firestoreQueryService.subscribe`, με stale cache ώστε η επιστροφή στη σελίδα να μην
 * αναβοσβήνει. Τα hooks διέφεραν μόνο στη συλλογή, στη σειρά και στο κείμενο του log (CHECK 3.28) — και, από τη Φ3α-2
 * του ADR-928, στην **εμβέλεια** (π.χ. «του έργου Χ») και στο **πεδίο ζωντάνιας** (`isDeleted` · `isArchived` · κανένα).
 * Ένα hook, όχι τρίτο αντίγραφο.
 *
 * ⚠️ Το `config` πρέπει να είναι σταθερή τιμή επιπέδου module: είναι εξάρτηση της συνδρομής. Το `scope` να είναι
 *    `useMemo` στο κλειδί του — αλλάζει **μόνο** όταν αλλάζει η εμβέλεια.
 */

import { useEffect, useState } from 'react';
import { where, type QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { CollectionKey } from '@/config/firestore-collections';
import type { StaleCache } from '@/lib/stale-cache';
import type { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';

/** Τα boolean πεδία ενός τύπου — υποψήφια «πεδία ζωντάνιας» (`false` ⇒ μένει στη λίστα). */
type BooleanField<T> = { [K in keyof T]-?: T[K] extends boolean ? K : never }[keyof T] & string;

/**
 * Ποιο πεδίο βγάζει μια εγγραφή από τη λίστα. Προεπιλογή `isDeleted` — **μόνο** όταν ο τύπος το έχει· αλλιώς η
 * δήλωση είναι υποχρεωτική (`null` = καμία: π.χ. τα συμφωνητικά δεν διαγράφονται, απορρίπτονται με κατάσταση).
 */
type LivenessOption<T> = T extends { readonly isDeleted: boolean }
  ? { readonly liveness?: BooleanField<T> | null }
  : { readonly liveness: BooleanField<T> | null };

interface ProcurementCatalogListBase<T> {
  readonly collection: CollectionKey;
  readonly cache: StaleCache<T[]>;
  readonly compare: (a: T, b: T) => number;
  readonly logger: ReturnType<typeof createModuleLogger>;
  /** Όνομα για τα μηνύματα log, π.χ. `Materials`. */
  readonly label: string;
}

export type ProcurementCatalogListConfig<T> = ProcurementCatalogListBase<T> & LivenessOption<T>;

/**
 * Εμβέλεια της λίστας: επιπλέον περιορισμοί του ερωτήματος (ο `companyId` μπαίνει πάντα από την υπηρεσία) και το κλειδί
 * της stale cache, ώστε η λίστα του έργου Α να μη φανεί ποτέ, ούτε για ένα render, στο έργο Β.
 */
export interface ProcurementCatalogListScope {
  readonly cacheKey: string;
  readonly constraints: readonly QueryConstraint[];
}

export interface ProcurementCatalogList<T> {
  readonly items: T[];
  readonly loading: boolean;
  readonly error: string | null;
}

const DEFAULT_LIVENESS = 'isDeleted';

/**
 * Ο **ένας** κενός πίνακας: η επανεκτέλεση του effect χωρίς δεδομένα στην cache δεν αλλάζει κατάσταση (ίδια αναφορά ⇒
 * το React παραλείπει το render). Νέο `[]` σε κάθε εκτέλεση θα έκανε κάθε αλλαγή ταυτότητας εξάρτησης βρόχο.
 */
const EMPTY: never[] = [];

function livenessFieldOf<T>(config: ProcurementCatalogListConfig<T>): string | null {
  return config.liveness === undefined ? DEFAULT_LIVENESS : config.liveness;
}

function isLive(item: unknown, field: string | null): boolean {
  return field === null || (item as Record<string, unknown>)[field] === false;
}

function queryConstraintsOf(field: string | null, scope: ProcurementCatalogListScope | undefined): QueryConstraint[] {
  const liveness = field === null ? [] : [where(field, '==', false)];
  return [...liveness, ...(scope?.constraints ?? [])];
}

interface ListSink<T> {
  readonly setItems: (items: T[]) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
}

/** Η συνδρομή μιας εμβέλειας: ζωντανά, ταξινομημένα, στην cache **του κλειδιού της**. */
function subscribeList<T>(
  config: ProcurementCatalogListConfig<T>,
  scope: ProcurementCatalogListScope | undefined,
  sink: ListSink<T>,
): () => void {
  const { cache, collection, compare, label, logger } = config;
  const field = livenessFieldOf(config);
  const cacheKey = scope?.cacheKey;
  // Νέα εμβέλεια ⇒ ό,τι ξέρει η cache **γι' αυτήν**, ποτέ τα στοιχεία της προηγούμενης.
  sink.setItems(cache.get(cacheKey) ?? EMPTY);
  sink.setLoading(!cache.hasLoaded(cacheKey));

  return firestoreQueryService.subscribe<Record<string, unknown>>(
    collection,
    (result) => {
      const next = result.documents
        .map((d) => d as unknown as T)
        .filter((item) => isLive(item, field))
        .sort(compare);
      cache.set(next, cacheKey);
      sink.setItems(next);
      sink.setLoading(false);
      sink.setError(null);
      logger.info(`${label} loaded`, { count: next.length });
    },
    (err) => {
      logger.error(`${label} subscription error`, { error: err.message });
      sink.setError('SUBSCRIPTION_ERROR');
      sink.setLoading(false);
    },
    // companyId auto-injected by firestoreQueryService (tenant-config default)
    { constraints: queryConstraintsOf(field, scope) },
  );
}

export function useProcurementCatalogList<T>(
  config: ProcurementCatalogListConfig<T>,
  scope?: ProcurementCatalogListScope,
): ProcurementCatalogList<T> {
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;

  const cacheKey = scope?.cacheKey;
  const [items, setItems] = useState<T[]>(config.cache.get(cacheKey) ?? EMPTY);
  const [loading, setLoading] = useState(!config.cache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const missing = !user ? 'AUTH_REQUIRED' : !companyId ? 'COMPANY_ID_UNAVAILABLE' : null;
    if (missing) {
      setLoading(false);
      setError(missing);
      return;
    }
    return subscribeList(config, scope, { setItems, setLoading, setError });
  }, [authLoading, user, companyId, config, scope]);

  return { items, loading, error };
}
