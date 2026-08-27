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
 * μετρήθηκε ότι οι **ίδιοι 8** υπήρχαν ήδη στο `HEAD`: το χρέος **προϋπήρχε**.
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
 *
 * ⛔ **ΚΑΜΙΑ ΝΕΑ ΕΞΑΡΤΗΣΗ.** Το TanStack Query / SWR λύνει *cache + dedup*, αλλά
 * **δεν** είναι στο `.license-allowlist.json` (⇒ N.5 + απόφαση Giorgio) και
 * κουβαλά **τεκμηριωμένη** αιχμή στα realtime: όταν φύγει ο τελευταίος
 * καταναλωτής η συνδρομή κλείνει, και σε επαναπροσάρτηση **όσο η εγγραφή ζει
 * ακόμη στη μνήμη** το `queryFn` δεν ξανατρέχει ⇒ **σιωπηλά παγωμένα δεδομένα**
 * *(invertase/tanstack-query-firebase #25)*. Εδώ η επαναπροσάρτηση **ξαναστήνει**
 * τη συνδρομή (βλ. `acquire`), άρα η αιχμή είναι **δομικά ανύπαρκτη**.
 *
 * 🔑 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ**: καμία βιβλιοθήκη δεν εγγυάται ότι *«σχεδιασμένη
 * κατάσταση δεν αναφέρεται ως βλάβη»*. Ο αυτόνομος επαγγελματίας **δεν έχει**
 * οργανισμό **εκ σχεδιασμού** (ADR-807) και κάθε εταιρικό ερώτημά του πετά
 * `MissingTenantError`. Εδώ η κρίση είναι **ΔΟΜΙΚΗ, ΟΧΙ ΕΠΙΛΟΓΗ**: η μόνη
 * διαδρομή προς συνδρομή περνά από τον `routeTenantScopedError` (§21). Ένα
 * αδέλφι **δεν μπορεί** να ξεχάσει να ρωτήσει τον κριτή.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΒΗΜΑ Β (§22.7) — **ΕΝΑΣ LISTENER ΓΙΑ ΟΛΟΥΣ ΤΟΥΣ ΚΑΤΑΝΑΛΩΤΕΣ**
 *
 * Κάθε καταναλωτής άνοιγε **δικό του** `onSnapshot`. Το ίδιο έκανε κάποτε και το
 * `useFirestoreBuildings`, μέχρι που **μετρήθηκε** (2026-06-11): ~11 ταυτόχρονοι
 * καταναλωτές ⇒ **9×** «Buildings updated» + 9× map/sort **ανά αλλαγή**. Εδώ οι
 * πέντε αδελφοί είχαν **2-4** ταυτόχρονους καταναλωτές ο καθένας.
 *
 * Πλέον η κατάσταση ζει σε **ένα** store ανά **ορισμό** hook *(ένα ανά κλήση του
 * εργοστασίου — άρα διαφορετικοί περιορισμοί ⇒ διαφορετικό ερώτημα ⇒ διαφορετικό
 * store, σωστά)*. Πρώτος συνδρομητής **ανοίγει**, τελευταίος **κλείνει**.
 *
 * 🔑 **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ `enabled` ΜΕΝΕΙ ΑΤΟΜΙΚΟ.** Ο κοινός listener είναι
 * ενεργός όσο **έστω ένας** καταναλωτής τον θέλει· ένας καταναλωτής με
 * `enabled: false` εξακολουθεί να βλέπει **`idle` + κενό**, όπως πάντα. Το
 * store είναι κοινό — η **προβολή** του, όχι.
 *
 * ⚠️ **ΤΟ ADR-040 ΔΕΝ ΙΣΧΥΕΙ ΕΔΩ, ΚΑΙ ΤΟ ΛΕΩ ΡΗΤΑ**: οι κανόνες του για
 * `useSyncExternalStore` αφορούν **υψηλόσυχνες** πηγές του καμβά DXF (δείκτης,
 * hover, transform — 60fps), όπου ο συνδρομητής πρέπει να είναι micro-leaf. Μια
 * συνδρομή Firestore εκπέμπει **σε αλλαγή εγγράφου**, και ο φρουρός ισοδυναμίας
 * του ADR-361 κόβει ήδη τις ταυτόσημες παραδόσεις **ανάντη**.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ ΤΙ **ΔΕΝ** ΚΑΝΕΙ, ΕΠΙΤΗΔΕΣ
 *
 * 1. ⛔ **Δεν στήνει ερώτημα.** Το `firestoreQueryService.subscribe` **είναι** το
 *    SSoT (ADR-214/355) — tenant φρουρός, auth-gating, ισοδυναμία (ADR-361).
 * 2. ⛔ **Δεν αγγίζει το `RealtimeService`** (event bus). Δύο ερωτήματα, δύο
 *    σπίτια (ADR-749) — το bus ζει στο `use-realtime-entity-events.ts`.
 * 3. ⛔ **Δεν φτιάχνει δεύτερο pub/sub.** Το `createExternalStore` (`@/lib/state`)
 *    **είναι** το SSoT primitive· εδώ γράφεται μόνο ο κύκλος ζωής από πάνω του.
 *
 * @module services/realtime/hooks/create-realtime-collection-hook
 * @see ./realtime-collection.types.ts — το συμβόλαιο της παραλλαγής
 * @see ./tenant-scoped-error.ts — η κρίση «σχεδιασμένη κατάσταση ή βλάβη;»
 * @see src/hooks/useFirestoreBuildings.ts — το δόγμα που υιοθετήθηκε στο Βήμα Β
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §22
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult, SubscribeOptions } from '@/services/firestore';
import type { StaleCache } from '@/lib/stale-cache';
import { createExternalStore } from '@/lib/state/createExternalStore';
import type { SubscriptionStatus } from '../types';
import { createSubscriptionErrorHandler } from './subscription-error-handler';
import type {
  RealtimeCollection,
  RealtimeCollectionConfig,
} from './realtime-collection.types';

/** Η κατάσταση που μοιράζονται όλοι οι καταναλωτές ενός ορισμού hook. */
interface CollectionState<TItem> {
  readonly items: TItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly status: SubscriptionStatus;
}

/** «Έχει ήδη φορτώσει ποτέ;» — χωρίς μνήμη ADR-300 η απάντηση είναι πάντα όχι. */
function hasEverLoaded<TItem>(cache: StaleCache<TItem[]> | undefined): boolean {
  return cache?.hasLoaded() ?? false;
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
  // Σταθερά ανά **ορισμό** hook: δεν ξαναχτίζονται σε κάθε render.
  const options: SubscribeOptions<TDoc> = config.constraints
    ? { constraints: config.constraints }
    : {};

  /** Σταθερή ταυτότητα «κανένα στοιχείο» — ποτέ νέος πίνακας ανά render. */
  const NO_ITEMS: TItem[] = [];

  /** Η προβολή που βλέπει καταναλωτής με `enabled: false`. Ταυτότητα σταθερή. */
  const IDLE: CollectionState<TItem> = {
    items: NO_ITEMS,
    loading: false,
    error: null,
    status: 'idle',
  };

  // ==========================================================================
  // ΤΟ ΚΟΙΝΟ STORE — ένα ανά ορισμό hook (§22.7)
  // ==========================================================================

  const store = createExternalStore<CollectionState<TItem>>({
    items: config.cache?.get() ?? NO_ITEMS,
    loading: !hasEverLoaded(config.cache),
    error: null,
    status: 'idle',
  });

  const patch = (next: Partial<CollectionState<TItem>>): void => {
    store.set({ ...store.get(), ...next });
  };

  /** Φρέσκα δεδομένα: **η μόνη** διαδρομή προς «ενεργή, υγιής συνδρομή». */
  function deliver(result: QueryResult<TDoc>): void {
    const items = config.mapDocuments(result.documents);

    config.logger.debug('Realtime documents received', {
      collection: config.collection,
      count: items.length,
    });

    // ADR-300: γράψε στη μνήμη ⇒ η επόμενη προσάρτηση προσπερνά το spinner.
    config.cache?.set(items);

    patch({ items, loading: false, error: null, status: 'active' });
  }

  /**
   * **Σχεδιασμένο κενό** (ADR-807): «δεν ανήκεις σε εταιρεία» ⇒ κενό αποτέλεσμα,
   * κατάσταση **`active`**, **ποτέ** `error`, **ποτέ** θόρυβος στην κονσόλα.
   *
   * ⚠️ **ΔΕΝ γράφει στη μνήμη ADR-300** — επίτηδες. Το κενό του αυτόνομου δεν
   * είναι δεδομένο· αποθηκευμένο, θα το κληρονομούσε η επόμενη ταυτότητα.
   */
  function designedEmpty(): void {
    patch({ items: NO_ITEMS, loading: false, error: null, status: 'active' });
  }

  /**
   * Πραγματική βλάβη: **αυτή** αξίζει κόκκινο.
   *
   * ⚠️ Η **κρίση και η καταγραφή** ζουν στο `createSubscriptionErrorHandler`
   * (§22.6 #1) — εδώ μένει **μόνο** η μετάβαση κατάστασης, που είναι το μόνο
   * που ξέρει αυτή η μηχανή. Ήταν γραμμένη εδώ και **πουθενά** στα τρία hooks
   * με αντιδραστικό κλειδί, όπου το σφάλμα καταπινόταν σιωπηλά.
   */
  const handleSubscriptionError = createSubscriptionErrorHandler({
    logger: config.logger,
    collection: config.collection,
    onDesignedEmpty: designedEmpty,
    onFailure: (message) => patch({ error: message, loading: false, status: 'error' }),
  });

  let unsubscribe: (() => void) | null = null;
  let refCount = 0;

  /** Ανοίγει τη **μία** συνδρομή. Ιδιοδύναμο: δεύτερη κλήση δεν κάνει τίποτα. */
  function start(): void {
    if (unsubscribe) return;

    // ADR-300: spinner **μόνο** στην πρώτη ποτέ φόρτωση, όχι σε επαναπλοήγηση.
    patch(
      hasEverLoaded(config.cache)
        ? { status: 'connecting' }
        : { status: 'connecting', loading: true },
    );

    // Η ετοιμότητα auth κρίνεται **κεντρικά** μέσα στο
    // `firestoreQueryService.subscribe()` (`waitForAuthReady`) — όχι εδώ.
    unsubscribe = firestoreQueryService.subscribe<TDoc>(
      config.collection,
      deliver,
      // §21 — «δεν έχεις εταιρεία» ⇒ κενό, όχι βλάβη. Ο κριτής είναι ΕΝΑΣ.
      handleSubscriptionError,
      options,
    );
  }

  /** Κλείνει τη συνδρομή όταν φύγει ο **τελευταίος** καταναλωτής. */
  function stop(): void {
    if (!unsubscribe) return;
    config.logger.debug('Closing shared realtime subscription', {
      collection: config.collection,
    });
    unsubscribe();
    unsubscribe = null;
    patch({ status: 'idle' });
  }

  /**
   * Ο συνδρομητής της React **και** μία θέση στον μετρητή αναφορών.
   *
   * 🔑 Η επαναπροσάρτηση **ξαναστήνει** τη συνδρομή (refCount 0 → 1 ⇒ `start`),
   * ενώ τα δεδομένα του store επιβιώνουν ⇒ **μηδέν αναλαμπή ΚΑΙ μηδέν παγωμένα
   * δεδομένα**. Είναι ακριβώς η αιχμή που το TanStack τεκμηριώνει ως ανοιχτή.
   */
  function acquire(listener: () => void): () => void {
    const detach = store.subscribe(listener);
    refCount += 1;
    if (refCount === 1) start();

    return () => {
      detach();
      refCount -= 1;
      if (refCount === 0) stop();
    };
  }

  /** `refetch`: κλείσε και ξανάνοιξε — μόνο αν κάποιος ακούει. */
  function restart(): void {
    if (refCount === 0) return;
    stop();
    start();
  }

  /**
   * Αισιόδοξη ενημέρωση από το **event bus**.
   *
   * ⚠️ **ΙΔΙΟΔΥΝΑΜΟ ΕΞ ΑΝΑΓΚΗΣ**: με κοινό store, N προσαρτημένοι καταναλωτές
   * ακούν ο καθένας το bus, άρα το ίδιο μπάλωμα εφαρμόζεται N φορές. Το
   * «αντικατέστησε τη γραμμή» και το «βγάλε τη γραμμή» δίνουν το **ίδιο**
   * αποτέλεσμα σε κάθε επανάληψη — γι' αυτό η τριάδα του bus παραμένει ασφαλής.
   * Η ταυτόσημη γραφή κόβεται εδώ, ώστε να μη γεννά render.
   */
  const setItems: Dispatch<SetStateAction<TItem[]>> = (action) => {
    const current = store.get().items;
    const next =
      typeof action === 'function'
        ? (action as (prev: TItem[]) => TItem[])(current)
        : action;
    if (next !== current) patch({ items: next });
  };

  return function useRealtimeCollection(enabled = true): RealtimeCollection<TItem> {
    // Ο απενεργοποιημένος **ακούει χωρίς να κρατά θέση**: δεν ανοίγει συνδρομή,
    // και η προβολή του μένει `IDLE` — το ατομικό συμβόλαιο του `enabled`.
    const subscribe = useCallback(
      (listener: () => void) => (enabled ? acquire(listener) : store.subscribe(listener)),
      [enabled],
    );

    const shared = useSyncExternalStore(subscribe, store.get, store.get);
    const state = enabled ? shared : IDLE;

    const refetch = useCallback(() => {
      if (enabled) restart();
    }, [enabled]);

    return useMemo(
      () => ({
        items: state.items,
        setItems,
        loading: state.loading,
        error: state.error,
        status: state.status,
        refetch,
      }),
      [state, refetch],
    );
  };
}
