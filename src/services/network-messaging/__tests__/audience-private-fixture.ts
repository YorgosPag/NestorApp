/**
 * @fileoverview **Η ΙΔΙΩΤΙΚΗ ΠΛΕΥΡΑ ΤΗΣ ΘΕΣΗΣ, ΓΙΑ ΤΙΣ ΑΓΚΥΡΕΣ** (ADR-867 Β9(β) Ε9) — ένα σημείο για το «πού» και
 * για τον ισχυρισμό «η δημόσια γραμμή δεν κουβαλά ιδιωτικό πεδίο».
 * @related types/network-thread.ts (`NETWORK_AUDIENCE_PRIVATE_FIELDS`) · places/__tests__/fake-firestore.ts
 *
 * 🔑 Ο ισχυρισμός διαβάζει τα ονόματα από το **μητρώο ορατότητας**, όχι από λίστα γραμμένη εδώ: πεδίο που γίνεται
 * ιδιωτικό αύριο ελέγχεται αυτόματα σε **κάθε** σουίτα που τον καλεί.
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { NETWORK_AUDIENCE_PRIVATE_FIELDS } from '@/types/network-thread';

import type { FakeFirestore } from '../../places/__tests__/fake-firestore';

const publicPath = (threadId: string): string =>
  `${COLLECTIONS.NETWORK_THREADS}/${threadId}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;

const privatePath = (threadId: string): string =>
  `${COLLECTIONS.NETWORK_THREADS}/${threadId}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE_PRIVATE}`;

/** Το ιδιωτικό έγγραφο ενός ανθρώπου σε ένα νήμα — `null` ⇒ δεν γράφτηκε ποτέ. */
export function privateSideOf(fake: FakeFirestore, threadId: string, uid: string): Record<string, unknown> | null {
  return JSON.parse(fake.snapshotOf(privatePath(threadId), uid)) as Record<string, unknown> | null;
}

/** Γράφει ιδιωτικό έγγραφο όπως θα το άφηνε ο γραφέας — για σενάρια «είχε ήδη διαβάσει/σιγάσει». */
export function seedPrivateSide(fake: FakeFirestore, threadId: string, uid: string, doc: Record<string, unknown>): void {
  fake.write(privatePath(threadId), uid, doc);
}

/** 🔒 Ε9: **καμία** δημόσια γραμμή του νήματος δεν έχει όνομα ιδιωτικού πεδίου — αυτό βλέπει η άλλη πλευρά. */
export function privateFieldsOnPublicRows(fake: FakeFirestore, threadId: string): readonly string[] {
  return fake
    .all<Record<string, unknown>>(publicPath(threadId))
    .flatMap((row) => NETWORK_AUDIENCE_PRIVATE_FIELDS.filter((field) => field in row).map((field) => `${String(row.uid)}.${field}`));
}
