/**
 * ADR-798 §22 — **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΚΥΚΛΟΥ ΖΩΗΣ ΜΙΑΣ REALTIME ΣΥΝΔΡΟΜΗΣ**.
 *
 * Ζευγάρι του `create-realtime-collection-hook.ts`: εκεί ζει η **μηχανή**, εδώ
 * το **σχήμα της παραλλαγής**. Ίδιος διαχωρισμός με το **ADR-594**
 * (`bim-entity-persistence-hook-types.ts`) — το πρότυπο του έργου για
 * «εργοστάσιο hook»: *μικρός υποχρεωτικός πυρήνας + προαιρετικά με λογικές
 * προεπιλογές*, ποτέ θεός-config σαράντα υποχρεωτικών πεδίων.
 *
 * @module services/realtime/hooks/realtime-collection.types
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §22
 */

import type { Dispatch, SetStateAction } from 'react';
import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import type { CollectionKey } from '@/config/firestore-collections';
import type { Logger } from '@/lib/telemetry';
import type { StaleCache } from '@/lib/stale-cache';
import type { SubscriptionStatus } from '../types';

/**
 * Η **παραλλαγή** ενός εταιρικού realtime hook — ό,τι είναι *γνήσια δικό του*.
 *
 * ⚠️ Ό,τι **δεν** είναι εδώ είναι κοινό **εκ κατασκευής**: το tenant-scoped
 * ερώτημα (`firestoreQueryService.subscribe`, ADR-214/355), ο ισοδυναμικός
 * φρουρός (ADR-361), η **κρίση «σχεδιασμένη κατάσταση ή βλάβη;»**
 * (`routeTenantScopedError`, §21) και ο καθαρισμός.
 */
export interface RealtimeCollectionConfig<TDoc extends DocumentData, TItem> {
  /** Κλειδί συλλογής — λύνεται από το `firestore-collections` SSoT. */
  readonly collection: CollectionKey;

  /**
   * Ο καταγραφέας **του καλούντος**, ώστε η γραμμή να λέει *ποιος* μίλησε.
   * Περνιέται στιγμιότυπο (όχι όνομα) για να μη γεννηθεί δεύτερος logger.
   */
  readonly logger: Logger;

  /**
   * 🔑 **Η ΜΟΝΗ ΥΠΟΧΡΕΩΤΙΚΗ ΜΕΤΑΦΡΑΣΗ**: έγγραφα Firestore → μοντέλο οθόνης.
   *
   * Δέχεται **ολόκληρο** τον πίνακα (όχι έγγραφο-έγγραφο) ώστε το φιλτράρισμα
   * και η ταξινόμηση — που είναι επίσης παραλλαγή — να μένουν **εδώ**, σε ένα
   * σημείο ανά hook, αντί για δεύτερο πεδίο config.
   */
  readonly mapDocuments: (documents: readonly TDoc[]) => TItem[];

  /**
   * Επιπλέον περιορισμοί **πάνω** στον αυτόματο tenant φρουρό — ποτέ αντί
   * αυτού (⛔ ο πελάτης δεν χτίζει δεύτερο query builder, ADR-355).
   */
  readonly constraints?: readonly QueryConstraint[];

  /**
   * ADR-300 stale-while-revalidate. Όταν δοθεί, η πρώτη τιμή έρχεται από τη
   * μνήμη ⇒ **καμία αναλαμπή** σε επαναπλοήγηση, και το spinner ανάβει **μόνο**
   * στην πρώτη ποτέ φόρτωση. Όταν παραλειφθεί, η συμπεριφορά είναι η κλασική
   * *«άδειο + loading»*.
   */
  readonly cache?: StaleCache<TItem[]>;
}

/**
 * Ό,τι επιστρέφει η μηχανή. **Δεν είναι δημόσιο API** — κάθε hook το τυλίγει
 * και εκθέτει τα **δικά του** ονόματα (ADR-594: *thin wrapper*), ώστε καμία
 * υπάρχουσα οθόνη να μην αγγιχτεί.
 */
export interface RealtimeCollection<TItem> {
  readonly items: TItem[];
  /**
   * Αισιόδοξη ενημέρωση από το **event bus** — το *άλλο* ερώτημα (ADR-749).
   * Εκτίθεται σκόπιμα: η μηχανή κατέχει τον **κύκλο ζωής**, όχι τη ροή UI.
   */
  readonly setItems: Dispatch<SetStateAction<TItem[]>>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly status: SubscriptionStatus;
  readonly refetch: () => void;
}
