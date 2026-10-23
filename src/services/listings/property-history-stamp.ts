/**
 * @fileoverview **Ο ΠΥΡΗΝΑΣ ΚΑΘΕ ΣΦΡΑΓΙΔΑΣ ΙΣΤΟΡΙΚΟΥ ΣΤΟ ΑΚΙΝΗΤΟ**: ένα συμβόλαιο, πολλά πεδία.
 * @related ADR-777 §8.69 · ADR-919 §10 · services/listings/price-history-stamp.ts · availability-history-stamp.ts
 * @module services/listings/property-history-stamp
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ (ADR-919 §10, 2026-10-23)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ιστορικό τιμής (§8.69) και το ιστορικό διαθεσιμότητας (ADR-919 §10) έχουν **ακριβώς** το ίδιο συμβόλαιο.
 * Δύο αντίγραφα θα ήταν το σχήμα του ADR-749: κάποια μέρα το ένα θα γράφει με `set` και το άλλο με `update`.
 * Η **κρίση** («τι γράφω;») μένει σε κάθε πεδίο (καθαρή, στο `lib/listings/`). Εδώ ζει μόνο η **μηχανική**.
 *
 * | Κανόνας | Γιατί |
 * |---|---|
 * | Γράφει στο `properties` / `owner_properties` | η απόσυρση **σβήνει** την προβολή· το ιστορικό δεν επιτρέπεται να σβήνεται μαζί |
 * | Συναλλαγή **μόνο** όταν αλλάζει κάτι | αποθήκευση που δεν άγγιξε το πεδίο δεν πληρώνει τίποτα |
 * | Δεύτερη ανάγνωση **μέσα** στη συναλλαγή | δύο ταυτόχρονα περάσματα δεν γράφουν δύο παρατηρήσεις |
 * | `update`, ποτέ `set` | ένα `set` με merge θα **δημιουργούσε** έγγραφο για ακίνητο που διαγράφηκε στη μέση |
 * | **Δεν πετά ποτέ** | η αποτυχία του ιστορικού δεν ακυρώνει τη δημοσίευση |
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { AdminFirestore } from '@/lib/api/guarded-route';

const logger = createModuleLogger('PropertyHistoryStamp');

/** **Η κρίση ενός πεδίου ιστορικού**: καθαρή, από το `lib/listings/`. */
export interface PropertyHistoryPolicy<TEntry, TObservation> {
  /** Το πεδίο του εγγράφου πηγής (`priceHistory` · `availabilityHistory`). */
  readonly field: string;
  /** Αποθηκευμένο → ιστορικό. Σκουπίδι ⇒ κενό. */
  readonly read: (value: unknown) => readonly TEntry[];
  /** Το ιστορικό μετά την παρατήρηση, ή `null` όταν δεν αλλάζει τίποτα. */
  readonly next: (history: readonly TEntry[], observation: TObservation, at: string) => readonly TEntry[] | null;
  /** Τι λέει το log όταν η εγγραφή αποτύχει: τι **δεν** θα δείξει η αγγελία. */
  readonly failureMessage: string;
}

/** Η διεύθυνση της πηγής και η παρατήρηση αυτού του περάσματος. */
export interface PropertyHistoryStampInput<TObservation> {
  readonly collectionName: string;
  readonly docId: string;
  /** Ό,τι κουβαλά **ήδη** το έγγραφο πηγής (ωμό, από τη βάση). */
  readonly current: unknown;
  readonly observation: TObservation;
  /** Η στιγμή του περάσματος: η **ίδια** με το `projectedAt`. */
  readonly at: string;
}

/**
 * **Το ιστορικό όπως ισχύει ΜΕΤΑ από αυτό το πέρασμα**: διαβάζοντας ή, όταν άλλαξε κάτι, γράφοντας.
 *
 * @returns Το ιστορικό προς προβολή, ή **`null` όταν η εγγραφή απέτυχε**. ⚠️ **`null` και ΟΧΙ το παλιό
 *   ιστορικό**: το παλιό **δεν** περιέχει την τρέχουσα παρατήρηση, και κάθε συμπέρασμα πάνω του θα έλεγε
 *   ψέματα. Με `null` η αγγελία δημοσιεύεται **χωρίς** το συμπέρασμα, που είναι αληθές.
 */
export async function resolvePropertyHistory<TEntry, TObservation>(
  adminDb: AdminFirestore,
  policy: PropertyHistoryPolicy<TEntry, TObservation>,
  input: PropertyHistoryStampInput<TObservation>,
): Promise<readonly TEntry[] | null> {
  const { collectionName, docId, observation, at } = input;
  const existing = policy.read(input.current);
  if (policy.next(existing, observation, at) === null) return existing;

  const ref = adminDb.collection(collectionName).doc(docId);

  try {
    return await adminDb.runTransaction<readonly TEntry[]>(async (transaction) => {
      // 🔴 **Η ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ ΕΙΝΑΙ ΤΟ CAS**: ίδιο ιδίωμα με το `resolveListedAt`. Αν άλλο πέρασμα
      //    κατέγραψε ήδη την ίδια παρατήρηση, το `next` εδώ μέσα απαντά «καμία αλλαγή».
      const snapshot = await transaction.get(ref);
      const winner = policy.read(snapshot.data()?.[policy.field]);
      const next = policy.next(winner, observation, at);
      if (next === null) return winner;

      transaction.update(ref, { [policy.field]: next });
      return next;
    });
  } catch (error) {
    logger.error(policy.failureMessage, {
      collection: collectionName,
      docId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
