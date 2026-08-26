'use client';

/**
 * ADR-798 §22 — **Η ΑΙΣΙΟΔΟΞΗ ΕΝΗΜΕΡΩΣΗ, ΜΙΑ ΦΟΡΑ**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 **ΔΕΥΤΕΡΟ ΕΡΩΤΗΜΑ, ΔΕΥΤΕΡΟ ΣΠΙΤΙ** — και είναι **ΚΑΝΟΝΑΣ**, όχι γούστο.
 *
 * Το `create-realtime-collection-hook.ts` απαντά *«πώς **ζει** μια συνδρομή
 * Firestore;»*. Αυτό απαντά *«πώς φτάνει στην οθόνη μια αλλαγή **πριν** γυρίσει
 * ο server;»*. Είναι **δύο** μηχανισμοί: ο ένας είναι `onSnapshot` (ADR-355), ο
 * άλλος είναι το `RealtimeService` event bus (cross-tab σήματα). Η ένωσή τους
 * θα γεννούσε **τρίτο λεξιλόγιο** — ακριβώς η αστοχία που καταγράφει το
 * **ADR-749**. Γι' αυτό ζουν σε δύο αρχεία και **δεν** γνωρίζονται.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ ΤΩΡΑ, ΜΑΖΙ ΜΕ ΤΟΝ ΚΥΚΛΟ ΖΩΗΣ
 *
 * Τρία hooks *(properties · opportunities · tasks)* έγραφαν την **ίδια** τριάδα
 * — *δημιουργήθηκε ⇒ ξαναζήτα · ενημερώθηκε ⇒ μπάλωσε τη γραμμή · διαγράφηκε ⇒
 * βγάλε τη γραμμή* — με διαφορετικά ονόματα συμβάντος και **διαφορετικό όνομα
 * πεδίου ταυτότητας** (`propertyId` · `opportunityId` · `taskId`).
 *
 * ⚠️ Το `jscpd` **δεν** τα είχε καταγγείλει: τα διαφορετικά αναγνωριστικά
 * κρατούσαν την ομοιότητα κάτω από τα 50 tokens. Αν έφευγε **μόνο** ο κύκλος
 * ζωής, τα σώματα θα συρρικνώνονταν γύρω από αυτή την τριάδα και η ομοιότητα θα
 * **ανέβαινε** — δηλαδή η θεραπεία θα γεννούσε τον **επόμενο** κλώνο. Το
 * μάθημα του N.18 αυτούσιο: *«κεντρικοποιείς το Α, γράφεις Β+Γ ως δίδυμα»*.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ **ΤΟ ΞΑΝΑΖΗΤΑ ΕΙΝΑΙ ΓΙΑ ΤΟ «ΔΗΜΙΟΥΡΓΗΘΗΚΕ», ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ**: μια νέα
 * οντότητα δεν έχει γραμμή να μπαλωθεί, και το payload του συμβάντος κουβαλά
 * **περίληψη**, όχι το πλήρες έγγραφο. Μπάλωμα από περίληψη θα ζωγράφιζε
 * μισοάδεια γραμμή μέχρι να φτάσει το `onSnapshot`.
 *
 * @module services/realtime/hooks/use-realtime-entity-events
 * @see ./create-realtime-collection-hook.ts — το **άλλο** ερώτημα
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §22
 */

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { RealtimeService } from '../RealtimeService';
import type { RealtimeEventMap } from '../types';
import { applyUpdates } from '@/lib/utils';
import type { Logger } from '@/lib/telemetry';

/**
 * Η **παραλλαγή** της τριάδας. Τρία ονόματα συμβάντος και **δύο αναγνώστες
 * payload** — αυτό είναι *όλο* ό,τι διαφέρει ανάμεσα στα αδέλφια.
 *
 * ⚠️ Οι αναγνώστες είναι **συναρτήσεις**, όχι όνομα πεδίου σε string: ένα
 * `idField: 'taskId'` θα απαιτούσε δεικτοδότηση με χαλαρό τύπο και θα έσπαγε
 * **σιωπηλά** σε μετονομασία πεδίου. Έτσι, ο μεταγλωττιστής το πιάνει.
 */
interface RealtimeEntityEventsConfig<
  TItem extends { readonly id?: string },
  KCreated extends keyof RealtimeEventMap,
  KUpdated extends keyof RealtimeEventMap,
  KDeleted extends keyof RealtimeEventMap,
> {
  /** Το συμβάν «δημιουργήθηκε» ⇒ πλήρες ξαναζήτημα (βλ. σχόλιο παραπάνω). */
  readonly created: KCreated;
  /** Το συμβάν «ενημερώθηκε» ⇒ αισιόδοξο μπάλωμα της γραμμής. */
  readonly updated: KUpdated;
  /** Το συμβάν «διαγράφηκε» ⇒ αφαίρεση της γραμμής. */
  readonly deleted: KDeleted;

  /** «Ποια γραμμή;» για το `updated`. */
  readonly updatedId: (payload: RealtimeEventMap[KUpdated]) => string;
  /** «Τι άλλαξε;» για το `updated`. */
  readonly updatedFields: (payload: RealtimeEventMap[KUpdated]) => Partial<TItem>;
  /** «Ποια γραμμή;» για το `deleted`. */
  readonly deletedId: (payload: RealtimeEventMap[KDeleted]) => string;

  /** Ο γραφέας της λίστας — δίνεται από το `RealtimeCollection`. */
  readonly setItems: Dispatch<SetStateAction<TItem[]>>;
  /** Πλήρες ξαναζήτημα — δίνεται από το `RealtimeCollection`. */
  readonly refetch: () => void;
  /** Ο καταγραφέας **του καλούντος**, ώστε η γραμμή να λέει ποιος μίλησε. */
  readonly logger: Logger;
}

/**
 * Συνδέει μια λίστα οντοτήτων στα τρία συμβάντα του κύκλου ζωής της.
 *
 * @example
 * ```ts
 * useRealtimeEntityEvents({
 *   created: 'TASK_CREATED',
 *   updated: 'TASK_UPDATED',
 *   deleted: 'TASK_DELETED',
 *   updatedId: (p) => p.taskId,
 *   updatedFields: (p) => p.updates as Partial<CrmTask>,
 *   deletedId: (p) => p.taskId,
 *   setItems, refetch, logger,
 * });
 * ```
 */
export function useRealtimeEntityEvents<
  TItem extends { readonly id?: string },
  KCreated extends keyof RealtimeEventMap,
  KUpdated extends keyof RealtimeEventMap,
  KDeleted extends keyof RealtimeEventMap,
>(config: RealtimeEntityEventsConfig<TItem, KCreated, KUpdated, KDeleted>): void {
  const { created, updated, deleted } = config;

  /**
   * 🔴 **ΑΝΑΓΝΩΣΗ ΣΕ ΧΡΟΝΟ ΣΥΜΒΑΝΤΟΣ, ΟΧΙ ΣΤΙΓΜΙΟΤΥΠΟ ΣΕ DEP ARRAY.**
   *
   * Οι αναγνώστες payload γράφονται **κυριολεκτικά** στο σημείο κλήσης
   * (`updatedId: (p) => p.taskId`), άρα αποκτούν **νέα ταυτότητα σε κάθε
   * render**. Σε dep array θα ξέσχιζαν και θα ξανάστηναν τις τρεις συνδρομές
   * του bus **σε κάθε render** — ενώ τα πρωτότυπα έμπαιναν **μία φορά**
   * (`[refetch]`, σταθερό). Το ref κρατά την ταυτότητα του effect σταθερή και
   * δίνει πάντα την **τρέχουσα** διαμόρφωση τη στιγμή που χτυπά το συμβάν.
   *
   * Ίδιο πρότυπο με τον κανόνα #2 του ADR-040 και τη γενίκευση #1 του ADR-594.
   */
  const latest = useRef(config);
  latest.current = config;

  useEffect(() => {
    const onCreated = (): void => {
      latest.current.logger.debug('Entity created — triggering refetch', { event: created });
      latest.current.refetch();
    };

    const onUpdated = (payload: RealtimeEventMap[KUpdated]): void => {
      const { updatedId, updatedFields, setItems, logger } = latest.current;
      const id = updatedId(payload);
      logger.debug('Applying optimistic update', { event: updated, id });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? applyUpdates(item, updatedFields(payload)) : item)),
      );
    };

    const onDeleted = (payload: RealtimeEventMap[KDeleted]): void => {
      const { deletedId, setItems, logger } = latest.current;
      const id = deletedId(payload);
      logger.debug('Removing deleted entity', { event: deleted, id });
      setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const unsubscribers = [
      RealtimeService.subscribe(created, onCreated),
      RealtimeService.subscribe(updated, onUpdated),
      RealtimeService.subscribe(deleted, onDeleted),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
    // Μόνη εξάρτηση: τα **ονόματα** των συμβάντων — σταθερά ανά ορισμό hook.
  }, [created, updated, deleted]);
}
