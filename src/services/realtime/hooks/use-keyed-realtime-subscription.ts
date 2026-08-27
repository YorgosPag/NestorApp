'use client';

/**
 * ADR-798 §22.6 — **Η ΣΥΝΔΡΟΜΗ ΜΕ ΑΝΤΙΔΡΑΣΤΙΚΟ ΚΛΕΙΔΙ**, μία φορά.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΜΗΧΑΝΗ — ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ Η ΔΙΑΦΟΡΑ
 *
 * Το `create-realtime-collection-hook.ts` κρατά **ένα store ανά ΟΡΙΣΜΟ** hook:
 * όλοι οι καταναλωτές του `useRealtimeProperties` βλέπουν **την ίδια** λίστα,
 * και γι' αυτό αρκεί **ένας** listener για όλους *(§22.7)*. Αυτό **δεν ισχύει**
 * όταν το ερώτημα εξαρτάται από κλειδί: δύο κτίρια είναι **δύο διαφορετικά
 * σύνολα ορόφων**, άρα το κοινό store θα έπρεπε να γίνει **ανά κλειδί** (`Map`)
 * — γνήσια **επέκταση** της μηχανής, όχι παραλλαγή, και ρητά **εκτός** εκείνης
 * της λωρίδας.
 *
 * 🔑 Ό,τι όμως **δεν** εξαρτάται από το κλειδί είναι ο **κύκλος ζωής**: άνοιγμα,
 * καθάρισμα στην αλλαγή κλειδιού, `loading`, **κρίση σφάλματος**, κλείσιμο στο
 * unmount. Αυτό ήταν γραμμένο **τρεις** φορές *(`useRealtimeBuildingFloors` ×2 ·
 * `useRealtimeBuildingFloorplan`)* και το CHECK 3.28 κατήγγειλε το δίδυμο **μέσα
 * στο ίδιο commit** που το γέννησε — το ακριβές σχήμα του N.18.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΤΟΥ ΚΛΕΙΔΙΟΥ, ΟΝΟΜΑΣΤΙΚΑ
 *
 * | Κλειδί | Τι σημαίνει | Αποτέλεσμα |
 * |---|---|---|
 * | `null` | ο καλών **δεν έχει ακόμη** αντικείμενο | `empty`, `loading:false`, **καμία** συνδρομή |
 * | αλλάζει | άλλο αντικείμενο | παλιά συνδρομή κλείνει, `loading:true`, νέα ανοίγει |
 * | ίδιο | τίποτα | **καμία** επανασυνδρομή *(οι εξαρτήσεις είναι `key` + `collection`, τίποτε άλλο)* |
 *
 * 🔴 **ΓΙΑΤΙ `select`/`constraints` ΜΕΣΑ ΣΕ `ref` ΚΑΙ ΟΧΙ ΣΤΙΣ ΕΞΑΡΤΗΣΕΙΣ**: ο
 * καλών τα γράφει **inline**, άρα η ταυτότητά τους αλλάζει σε **κάθε render**.
 * Στις εξαρτήσεις, θα ξανάνοιγαν τη συνδρομή σε κάθε render — δηλαδή θα
 * γεννούσαν ακριβώς τη βλάβη που όλο το §22 υπάρχει για να λύσει. Παράγονται
 * **αποδεδειγμένα** από το κλειδί, οπότε το κλειδί είναι η **σωστή** εξάρτηση.
 * ⛔ **ΜΗΝ** τα βάλεις στο `deps` «για σιγουριά».
 *
 * @module services/realtime/hooks/use-keyed-realtime-subscription
 * @see ./create-realtime-collection-hook.ts — το **άλλο** ερώτημα (store ανά ορισμό)
 * @see ./subscription-error-handler.ts — η κρίση + η καταγραφή
 */

import { useEffect, useRef, useState } from 'react';
import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { CollectionKey } from '@/config/firestore-collections';
import type { Logger } from '@/lib/telemetry';
import { createSubscriptionErrorHandler } from './subscription-error-handler';

export interface KeyedRealtimeSubscriptionConfig<TResult> {
  /** Η συλλογή, με το **κεντρικό** κλειδί (`@/config/firestore-collections`). */
  readonly collection: CollectionKey;
  readonly logger: Logger;
  /** `null` ⇒ καμία συνδρομή. Κάθε αλλαγή ⇒ επανασύνδεση. */
  readonly key: string | null;
  /** Οι περιορισμοί, **παραγόμενοι από το κλειδί**. */
  readonly constraints: (key: string) => readonly QueryConstraint[];
  /** Η **κενή** τιμή του τομέα: άδειος πίνακας · `false` · άδειο `Set` · `0`. */
  readonly empty: TResult;
  /** Από το αποτέλεσμα Firestore στο σχήμα που θέλει ο καλών. */
  readonly select: (result: QueryResult<DocumentData>) => TResult;
}

export interface KeyedRealtimeSubscription<TResult> {
  readonly data: TResult;
  readonly loading: boolean;
  /** Πραγματική βλάβη **μόνο**. Το άδειο του αυτόνομου *δεν* είναι σφάλμα. */
  readonly error: string | null;
}

/**
 * Συνδρομή Firestore της οποίας το ερώτημα εξαρτάται από **κλειδί**.
 *
 * ⚠️ Η **σχεδιασμένη σιωπή** *(ADR-807: ο αυτόνομος δεν έχει οργανισμό)* δίνει
 * `empty` **χωρίς** σφάλμα και **χωρίς** κόκκινη γραμμή — ο κριτής είναι ο ίδιος
 * που χρησιμοποιεί όλο το §22.
 */
export function useKeyedRealtimeSubscription<TResult>(
  config: KeyedRealtimeSubscriptionConfig<TResult>,
): KeyedRealtimeSubscription<TResult> {
  const { collection, key, empty } = config;

  const [data, setData] = useState<TResult>(empty);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const [error, setError] = useState<string | null>(null);

  // Βλ. επικεφαλίδα: ταυτότητα που αλλάζει ανά render ΔΕΝ γίνεται εξάρτηση.
  const latest = useRef(config);
  latest.current = config;

  useEffect(() => {
    const settleEmpty = (): void => {
      setData(latest.current.empty);
      setLoading(false);
      setError(null);
    };

    if (key === null) {
      settleEmpty();
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      collection,
      (result: QueryResult<DocumentData>) => {
        setData(latest.current.select(result));
        setLoading(false);
        setError(null);
      },
      createSubscriptionErrorHandler({
        logger: latest.current.logger,
        collection,
        onDesignedEmpty: settleEmpty,
        onFailure: (message) => {
          setLoading(false);
          setError(message);
        },
      }),
      { constraints: [...latest.current.constraints(key)] },
    );

    return () => unsubscribe();
  }, [collection, key]);

  return { data, loading, error };
}
