'use client';

/**
 * ADR-798 §22 — **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ REALTIME ΣΥΝΔΡΟΜΗΣ, ΜΙΑ ΦΟΡΑ**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΕΙΚΑΖΟΜΕΝΟ
 *
 * Πέντε εταιρικά realtime hooks έγραφαν τον **ίδιο** κύκλο ζωής *(στήσιμο →
 * εγγραφή → χαρτογράφηση → σφάλμα → καθαρισμός)* με **διαφορετικά ονόματα
 * setter**. Το **CHECK 3.28 (jscpd)** το κατήγγειλε με **8 κλώνους** — και
 * μετρήθηκε ότι οι **ίδιοι 8** υπήρχαν ήδη στο `HEAD`: το χρέος **προϋπήρχε**,
 * δεν το γέννησε η θεραπεία του §21.
 *
 * Το κριτήριο δεν ήταν «περνά η πύλη» — ήταν *«υπάρχει **ΕΝΑ** σημείο που ξέρει
 * πώς ζει μια realtime συνδρομή;»*. Το πράσινο είναι **συνέπεια**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΤΟ ΣΧΗΜΑ, ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ
 *
 * *Shared primitive + per-instance binding* — το πρότυπο κάθε μεγάλου παίχτη για
 * data layer (TanStack `QueryObserver`, Apollo `useQuery` options, ORM repository
 * factories) και **ήδη το πρότυπο ΑΥΤΟΥ του έργου**: το **ADR-594**
 * (`createBimEntityPersistenceHook`) κατέρρευσε έτσι **~21** ταυτόσημα hooks.
 * Δεν εφευρίσκουμε λεξιλόγιο· συνεχίζουμε το δικό μας.
 *
 * ⛔ **ΚΑΜΙΑ ΝΕΑ ΕΞΑΡΤΗΣΗ.** Το TanStack Query / SWR λύνει *cache + dedup*, αλλά
 * **δεν** είναι στο `.license-allowlist.json` (⇒ N.5 + απόφαση Giorgio) και
 * κουβαλά **τεκμηριωμένη** αιχμή στα realtime: όταν φύγει ο τελευταίος
 * καταναλωτής η συνδρομή κλείνει, και σε επαναπροσάρτηση **όσο η εγγραφή ζει
 * ακόμη στη μνήμη** το `queryFn` δεν ξανατρέχει ⇒ **σιωπηλά παγωμένα δεδομένα**
 * *(invertase/tanstack-query-firebase #25)*. Δεν το χρειαζόμαστε.
 *
 * 🔑 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ**: καμία βιβλιοθήκη δεν εγγυάται ότι *«σχεδιασμένη
 * κατάσταση δεν αναφέρεται ως βλάβη»*. Ο αυτόνομος επαγγελματίας **δεν έχει**
 * οργανισμό **εκ σχεδιασμού** (ADR-807) και κάθε εταιρικό ερώτημά του πετά
 * `MissingTenantError`. Εδώ η κρίση είναι **ΔΟΜΙΚΗ, ΟΧΙ ΕΠΙΛΟΓΗ**: η μόνη
 * διαδρομή προς συνδρομή περνά από τον `routeTenantScopedError` (§21). Ένα
 * αδέλφι **δεν μπορεί** να ξεχάσει να ρωτήσει τον κριτή — δεν του δίνεται
 * σημείο να το κάνει.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ ΤΙ **ΔΕΝ** ΚΑΝΕΙ, ΕΠΙΤΗΔΕΣ
 *
 * 1. ⛔ **Δεν στήνει ερώτημα.** Το `firestoreQueryService.subscribe` **είναι** το
 *    SSoT (ADR-214/355) — tenant φρουρός, auth-gating, ισοδυναμία (ADR-361).
 * 2. ⛔ **Δεν αγγίζει το `RealtimeService`** (event bus). Δύο ερωτήματα, δύο
 *    σπίτια (ADR-749) — το bus ζει στο `use-realtime-entity-events.ts`.
 * 3. ⛔ **Δεν μοιράζεται listener μεταξύ καταναλωτών.** Σκόπιμο **σε αυτό το
 *    βήμα**: μηχανικός refactor χωριστά από σημασιολογική αλλαγή. Το δόγμα του
 *    `useFirestoreBuildings` (ένας ref-counted listener + `useSyncExternalStore`)
 *    είναι το επόμενο βήμα και πλέον αλλάζει **ΕΝΑ** αρχείο — αυτό. Βλ. §22.
 *
 * @module services/realtime/hooks/create-realtime-collection-hook
 * @see ./realtime-collection.types.ts — το συμβόλαιο της παραλλαγής
 * @see ./tenant-scoped-error.ts — η κρίση «σχεδιασμένη κατάσταση ή βλάβη;»
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §22
 */

import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult, SubscribeOptions } from '@/services/firestore';
import type { StaleCache } from '@/lib/stale-cache';
import type { SubscriptionStatus } from '../types';
import { routeTenantScopedError } from './tenant-scoped-error';
import type {
  RealtimeCollection,
  RealtimeCollectionConfig,
} from './realtime-collection.types';

/**
 * Οι **μεταβάσεις κατάστασης** του καλούντος, σε ένα δεμάτι.
 *
 * ⚠️ Το `tenant-scoped-error.ts` τις άφησε ρητά **έξω** («κοινή είναι η ΚΡΙΣΗ,
 * όχι η συνέπειά της») — και είχε δίκιο **τότε**: ο καθένας είχε δικό του σχήμα
 * κενού *(άδειος πίνακας · άδειος χάρτης · μηδενικός μετρητής)*. Εδώ το σχήμα
 * είναι **ένα** (`items: TItem[]`), και τα παράγωγα βγαίνουν από αυτό — άρα η
 * συνέπεια γίνεται κι αυτή κοινή, **χωρίς** ψεύτικο κοινό σχήμα.
 */
interface CollectionSinks<TItem> {
  readonly setItems: Dispatch<SetStateAction<TItem[]>>;
  readonly setLoading: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly setStatus: Dispatch<SetStateAction<SubscriptionStatus>>;
}

/** «Έχει ήδη φορτώσει ποτέ;» — χωρίς μνήμη ADR-300 η απάντηση είναι πάντα όχι. */
function hasEverLoaded<TItem>(cache: StaleCache<TItem[]> | undefined): boolean {
  return cache?.hasLoaded() ?? false;
}

/** Φρέσκα δεδομένα έφτασαν: **η μόνη** διαδρομή προς «ενεργή, υγιής συνδρομή». */
function deliver<TDoc extends DocumentData, TItem>(
  config: RealtimeCollectionConfig<TDoc, TItem>,
  sinks: CollectionSinks<TItem>,
  result: QueryResult<TDoc>,
): void {
  const items = config.mapDocuments(result.documents);

  config.logger.debug('Realtime documents received', {
    collection: config.collection,
    count: items.length,
  });

  // ADR-300: γράψε στη μνήμη ⇒ η επόμενη προσάρτηση προσπερνά το spinner.
  config.cache?.set(items);

  sinks.setItems(items);
  sinks.setLoading(false);
  sinks.setError(null);
  sinks.setStatus('active');
}

/**
 * **Σχεδιασμένο κενό** (ADR-807): «δεν ανήκεις σε εταιρεία» ⇒ κενό αποτέλεσμα,
 * κατάσταση **`active`**, **ποτέ** `error`, **ποτέ** θόρυβος στην κονσόλα.
 *
 * ⚠️ **ΔΕΝ γράφει στη μνήμη ADR-300** — επίτηδες. Το κενό του αυτόνομου δεν
 * είναι δεδομένο· αποθηκευμένο, θα το κληρονομούσε η επόμενη ταυτότητα.
 */
function designedEmpty<TItem>(sinks: CollectionSinks<TItem>): void {
  sinks.setItems([]);
  sinks.setLoading(false);
  sinks.setError(null);
  sinks.setStatus('active');
}

/** Πραγματική βλάβη: **αυτή** αξίζει κόκκινο. */
function failure<TDoc extends DocumentData, TItem>(
  config: RealtimeCollectionConfig<TDoc, TItem>,
  sinks: CollectionSinks<TItem>,
  error: Error,
): void {
  config.logger.error('Realtime subscription error', {
    collection: config.collection,
    error: error.message,
  });
  sinks.setError(error.message);
  sinks.setLoading(false);
  sinks.setStatus('error');
}

/** Άνοιγμα συνδρομής + ο καθαρισμός της, ως ένα αδιαίρετο ζεύγος. */
function openSubscription<TDoc extends DocumentData, TItem>(
  config: RealtimeCollectionConfig<TDoc, TItem>,
  options: SubscribeOptions<TDoc>,
  sinks: CollectionSinks<TItem>,
): () => void {
  const unsubscribe = firestoreQueryService.subscribe<TDoc>(
    config.collection,
    (result: QueryResult<TDoc>) => deliver(config, sinks, result),
    // §21 — «δεν έχεις εταιρεία» ⇒ κενό, όχι βλάβη. Ο κριτής είναι ΕΝΑΣ.
    (err: Error) =>
      routeTenantScopedError(
        err,
        () => designedEmpty(sinks),
        () => failure(config, sinks, err),
      ),
    options,
  );

  return () => {
    config.logger.debug('Cleaning up realtime subscription', {
      collection: config.collection,
    });
    unsubscribe();
  };
}

/**
 * Χτίζει ένα εταιρικό realtime hook από τη **μόνη** του παραλλαγή.
 *
 * @example
 * ```ts
 * const useTasksCollection = createRealtimeCollectionHook<DocumentData, CrmTask>({
 *   collection: 'TASKS',
 *   logger,
 *   cache: tasksCache,
 *   mapDocuments: (docs) =>
 *     docs
 *       .map((d) => toTask(d as DocumentData & { id: string }))
 *       .filter((t) => t.status !== 'cancelled'),
 * });
 * ```
 */
export function createRealtimeCollectionHook<TDoc extends DocumentData, TItem>(
  config: RealtimeCollectionConfig<TDoc, TItem>,
): (enabled?: boolean) => RealtimeCollection<TItem> {
  // Σταθερό αντικείμενο ανά **ορισμό** hook: δεν ξαναχτίζεται σε κάθε render και
  // δεν μπορεί να γίνει αιτία επανεγγραφής.
  const options: SubscribeOptions<TDoc> = config.constraints
    ? { constraints: config.constraints }
    : {};

  return function useRealtimeCollection(enabled = true): RealtimeCollection<TItem> {
    const [items, setItems] = useState<TItem[]>(() => config.cache?.get() ?? []);
    const [loading, setLoading] = useState(enabled && !hasEverLoaded(config.cache));
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<SubscriptionStatus>('idle');

    // 🚀 PERF (ADR-798 §22, υιοθετεί τη μέτρηση του 2026-06-11): ο πυροδότης
    // είναι **STATE**, ποτέ ref. Ένα `ref.current` διαβασμένο σε dep array
    // συλλαμβάνεται μη-αντιδραστικά — τότε το `refetch()` επανεγγράφεται μόνο
    // **κατά τύχη**, όποτε ένα `setState` δίπλα του προκαλέσει render. Με state,
    // το `refetch` είναι η **μόνη, αξιόπιστη** αιτία επανεγγραφής.
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refetch = useCallback(() => {
      setRefreshTrigger((n) => n + 1);
      setLoading(true);
      setError(null);
    }, []);

    useEffect(() => {
      // Η ετοιμότητα auth κρίνεται **κεντρικά** μέσα στο
      // `firestoreQueryService.subscribe()` (`waitForAuthReady`) — όχι εδώ.
      if (!enabled) {
        setStatus('idle');
        setLoading(false);
        return;
      }

      setStatus('connecting');
      // ADR-300: spinner **μόνο** στην πρώτη ποτέ φόρτωση, όχι σε επαναπλοήγηση.
      if (!hasEverLoaded(config.cache)) setLoading(true);

      return openSubscription(config, options, {
        setItems,
        setLoading,
        setError,
        setStatus,
      });
    }, [enabled, refreshTrigger]);

    return { items, setItems, loading, error, status, refetch };
  };
}
