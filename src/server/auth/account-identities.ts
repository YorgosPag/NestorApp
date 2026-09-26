import 'server-only';

/**
 * @fileoverview **ΠΟΙΟΣ ΕΙΝΑΙ Ο ΛΟΓΑΡΙΑΣΜΟΣ** — όνομα + email από την **πηγή**, σε παρτίδες (ADR-884 Κ3β).
 * @related `server/spatial-tour/tour-access-decision.ts` (λίστα αιτημάτων · επαφή CRM)
 * @module server/auth/account-identities
 *
 * 🔑 **Πηγή, όχι αντίγραφο** (πρότυπο Google Drive «Request access»: ο κάτοχος βλέπει όνομα + email του αιτούντος):
 * το αίτημα θέασης κρατά **μόνο** `requesterUid`· το όνομα διαβάζεται **τη στιγμή της ανάγνωσης**, ώστε μια
 * διόρθωση προφίλ να φαίνεται και κανένα αντίγραφο προσωπικών δεδομένων να μη μένει πίσω.
 *
 * 🔑 **Δύο πηγές, ένας κανόνας**: το Firebase Auth λέει email + **αν είναι επαληθευμένο**· το `users/{uid}` λέει τα
 * **δομημένα** ονόματα (όνομα / επώνυμο) που χρειάζεται μια καρτέλα CRM. Όπου λείπουν, το `displayName`.
 *
 * ⚠️ **Άγνωστο ≠ κενό**: λογαριασμός που δεν βρέθηκε **λείπει** από τον χάρτη — ο καλών δείχνει «άγνωστος
 * λογαριασμός», ποτέ κενό όνομα σαν να ήταν γνωστό.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('account-identities');

/** Το όριο του `auth.getUsers` ανά κλήση (Firebase Admin). */
const AUTH_BATCH = 100;

export interface AccountIdentity {
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly givenName: string | null;
  readonly familyName: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

async function authRecords(uids: readonly string[]) {
  const auth = getAdminAuth();
  const batches: string[][] = [];
  for (let i = 0; i < uids.length; i += AUTH_BATCH) batches.push(uids.slice(i, i + AUTH_BATCH));
  const results = await Promise.all(batches.map((batch) => auth.getUsers(batch.map((uid) => ({ uid })))));
  return new Map(results.flatMap((result) => result.users).map((record) => [record.uid, record]));
}

/** **Οι ταυτότητες αυτών των λογαριασμών** — χάρτης ανά uid· όποιος δεν βρέθηκε **λείπει**. */
export async function readAccountIdentities(
  db: Firestore,
  uids: readonly string[],
): Promise<ReadonlyMap<string, AccountIdentity>> {
  const unique = [...new Set(uids.filter((uid) => uid !== ''))];
  if (unique.length === 0) return new Map();
  try {
    const [records, profiles] = await Promise.all([
      authRecords(unique),
      Promise.all(unique.map((uid) => db.collection(COLLECTIONS.USERS).doc(uid).get())),
    ]);
    const identities = new Map<string, AccountIdentity>();
    unique.forEach((uid, index) => {
      const record = records.get(uid);
      if (record === undefined) return;
      const profile = profiles[index]?.data() ?? {};
      identities.set(uid, {
        uid,
        displayName: text(profile.displayName) ?? text(record.displayName),
        email: text(record.email) ?? text(profile.email),
        emailVerified: record.emailVerified === true,
        givenName: text(profile.givenName),
        familyName: text(profile.familyName),
      });
    });
    return identities;
  } catch (error) {
    logger.error('Οι ταυτότητες λογαριασμών δεν διαβάστηκαν — άγνωστες, όχι κενές', {
      count: unique.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
}
