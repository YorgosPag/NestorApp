/**
 * **Η μεταφορά του ιστορικού του λογαριασμού** — το ΜΟΝΟ σημείο που μιλά στο Firestore για
 * αυτό (ADR-882 Φάση 2).
 *
 * Φορτώνεται **δυναμικά** από την αποθήκη μόνο όταν υπάρχει συνδεδεμένος άνθρωπος: ο ανώνυμος
 * επισκέπτης της οθόνης 1 δεν χρειάζεται ποτέ αυτόν τον κώδικα.
 *
 * 🔑 **Γράφει με `merge`, ΠΟΤΕ ολόκληρο το έγγραφο**: κάθε πράξη αγγίζει μόνο τα φύλλα της
 * (`entries.<k>`, `tombstones.<k>`) ⇒ δύο συσκευές δεν συγκρούονται, και η πρώτη γραφή
 * δημιουργεί το έγγραφο χωρίς αγώνα create/update. Κάθε γραφή κουβαλά `userId` +
 * `schemaVersion`, ώστε οι κανόνες να κρίνουν το ίδιο σχήμα είτε δημιουργεί είτε ενημερώνει.
 */

import { deleteField, type FieldValue } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { generateUserPlaceSearchesId } from '@/services/enterprise-id.service';
import {
  ACCOUNT_PLACE_SEARCHES_SCHEMA_VERSION,
  type AccountPatch,
} from './recent-place-searches-account-model';

type Leaf<T> = T | FieldValue;

function leaves<T>(set: Readonly<Record<string, T>>, remove: readonly string[]): Record<string, Leaf<T>> {
  const result: Record<string, Leaf<T>> = { ...set };
  for (const key of remove) result[key] = deleteField();
  return result;
}

/** Η πράξη → φύλλα `merge`. Κενός χάρτης παραλείπεται (δεν δημιουργεί άδειο πεδίο). */
function accountPatchPayload(uid: string, patch: AccountPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = { userId: uid, schemaVersion: ACCOUNT_PLACE_SEARCHES_SCHEMA_VERSION };
  if (patch.clearedAt !== undefined) {
    return { ...payload, entries: deleteField(), tombstones: deleteField(), clearedAt: patch.clearedAt };
  }
  const entries = leaves(patch.put, patch.drop);
  const tombstones = leaves(patch.tomb, patch.untomb);
  if (Object.keys(entries).length > 0) payload.entries = entries;
  if (Object.keys(tombstones).length > 0) payload.tombstones = tombstones;
  return payload;
}

export function writeAccountPatch(uid: string, patch: AccountPatch): Promise<void> {
  return firestoreQueryService.update(
    'USER_PLACE_SEARCHES',
    generateUserPlaceSearchesId(uid),
    accountPatchPayload(uid, patch),
    { merge: true },
  );
}

/**
 * Ζωντανή ανάγνωση του ΕΝΟΣ εγγράφου — οι αλλαγές άλλης συσκευής φτάνουν χωρίς ανανέωση.
 * Η απομόνωση είναι δομική: το id είναι `uplsrch_{uid}` και ο κανόνας απαιτεί το ίδιο.
 */
export function subscribeAccountDoc(
  uid: string,
  onData: (raw: unknown) => void,
  onError: (error: Error) => void,
): () => void {
  return firestoreQueryService.subscribeDoc<Record<string, unknown>>(
    'USER_PLACE_SEARCHES',
    generateUserPlaceSearchesId(uid),
    onData,
    onError,
  );
}
