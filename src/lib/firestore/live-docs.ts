/**
 * Η ανάγνωση **μόνο των ζωντανών** εγγραφών ενός ερωτήματος με όριο — η άλλη όψη του
 * `lifecycle-list` (που διαβάζει μόνο τις αποσυρμένες).
 *
 * Όποιος διαβάζει «τις πρώτες N» και πετά τις αποσυρμένες **μετά** το `limit`, επιστρέφει
 * λιγότερες από όσες ζητήθηκαν και δηλώνει λάθος «υπάρχουν κι άλλες». Εδώ το όριο μετρά
 * **ζωντανές**: η σάρωση προχωρά με δρομέα ώσπου να μαζευτούν ή να τελειώσει το ερώτημα.
 *
 * ⚠️ Γιατί ΟΧΙ `where('status', 'not-in', RETIRED_STATUSES)` στο ερώτημα:
 *   1. το Firestore απαγορεύει `not-in` μαζί με `!=` (τομέας αναφορών «αγοραστές»)·
 *   2. `not-in` δεν επιστρέφει έγγραφα **χωρίς** `status` — σιωπηλή απώλεια γραμμών·
 *   3. θέλει σύνθετο δείκτη ανά πεδίο ταξινόμησης (CHECK 3.91)·
 *   4. όπου υπάρχει κλίμακα υποχώρησης (εργαλείο AI), η αποτυχία δείκτη θα τα ξανάφερνε.
 *
 * @module lib/firestore/live-docs
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import "server-only";

import { processAdminBatch } from "@/lib/admin-batch-utils";
import { isRetired } from "./trashed-status";

/** Πόσες φορές το όριο σαρώνεται το πολύ, όταν ο καλών δεν δηλώνει δικό του φράγμα. */
const DEFAULT_SCAN_FACTOR = 4;

export interface LiveDocsOptions {
  /**
   * Το πολύ πόσα έγγραφα διαβάζονται συνολικά. Φράγμα κόστους: συλλογή γεμάτη αποσυρμένα
   * δεν σαρώνεται ολόκληρη για να γεμίσει μία σελίδα.
   */
  readonly maxScan?: number;
}

/**
 * Τα πρώτα `limit` **ζωντανά** έγγραφα του ερωτήματος, με τη σειρά του.
 *
 * @param query ταξινομημένο ερώτημα **χωρίς** `limit` — το όριο το βάζει ο αναγνώστης
 */
export async function readLiveDocs(
  query: FirebaseFirestore.Query,
  limit: number,
  options: LiveDocsOptions = {},
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (limit <= 0) return [];

  const maxScan = options.maxScan ?? limit * DEFAULT_SCAN_FACTOR;
  const live: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let scanned = 0;

  await processAdminBatch(
    query,
    Math.min(limit, maxScan),
    (docs) => {
      scanned += docs.length;
      for (const doc of docs) {
        if (!isRetired(doc.data())) live.push(doc);
      }
    },
    () => live.length >= limit || scanned >= maxScan,
  );

  return live.slice(0, limit);
}

/**
 * Οι πρώτες `limit` εγγραφές ενός ερωτήματος — **ζωντανές** όταν το ζητά ο καλών.
 *
 * Ο ένας διακόπτης των γενικών αναγνωστών (κατασκευαστής αναφορών · εργαλείο ερωτημάτων AI):
 * δέχονται όνομα συλλογής, άρα μόνο σε χρόνο εκτέλεσης ξέρουν αν υπάρχει κύκλος ζωής.
 *
 * @param query ταξινομημένο ερώτημα **χωρίς** `limit`
 */
export async function readFirstDocs(
  query: FirebaseFirestore.Query,
  limit: number,
  options: LiveDocsOptions & { readonly liveOnly: boolean },
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (options.liveOnly) return readLiveDocs(query, limit, options);
  return (await query.limit(limit).get()).docs;
}
