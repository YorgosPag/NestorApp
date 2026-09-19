import 'server-only';

/**
 * @fileoverview **ΠΩΣ ΛΕΓΟΝΤΑΙ ΟΣΟΙ ΔΙΑΒΑΖΟΥΝ** — ονόματα και φωτογραφίες του ακροατηρίου, για τον αναγνώστη.
 * @related ADR-867 Β7 · §8 #8 · ADR-798 (ταυτότητα προσώπου — `users/{uid}`) · ADR-834 (γ) ③
 * @module services/network-messaging/thread-people
 *
 * 🔴 **ΓΙΑΤΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ** (2026-09-19): ο κανόνας `users/{uid}` δίνει
 * ανάγνωση **μόνο** στον ίδιο, στην **ίδια εταιρεία** και στον super_admin. Ο ιδιοκτήτης **δεν μπορεί**
 * να διαβάσει τον μεσίτη, ούτε το γραφείο τον ιδιώτη ⇒ το `useUserDisplayNames` θα έδινε **κενό** — και
 * η λίστα «ποιοι διαβάζουν» (γ) ③ θα ήταν λίστα από ανώνυμους. Το §8 #8 («τα ονόματα από την ταυτότητα
 * προσώπου») **τηρείται**: η πηγή είναι το ADR-798, απλώς διαβάζεται εκεί όπου επιτρέπεται.
 *
 * 🔒 **ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ (ΓΚΠΔ)**: μόνο όνομα + φωτογραφία, **μόνο** για πρόσωπα **αυτού** του ακροατηρίου
 * (και όσους διάβαζαν — η λίστα τους δείχνει ούτως ή άλλως), **μόνο** σε όποιον διαβάζει ήδη. **Κανένα
 * email**: η άλλη πλευρά είναι ξένος χώρος (Slack Connect το δείχνει· εδώ δεν χρειάζεται — ADR-827 §9.8).
 * **Κανένα όνομα δεν αποθηκεύεται** στο νήμα: αλλάζει όνομα ο άνθρωπος ⇒ αλλάζει παντού.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import type { NetworkPeopleResult, NetworkPerson } from '@/types/network-wire';

import { readThreadAsReader } from './thread-reader';

/**
 * Το σχήμα ζει στο **καλώδιο** (`types/network-wire.ts`) — ένα για διαδρομή και οθόνη. `name: null` ⇒ η
 * οθόνη λέει τον **ρόλο** («Μέλος του γραφείου»), ποτέ id· `hostName` = η επωνυμία του γραφείου (Slack
 * Connect: ο οργανισμός φαίνεται).
 */
export type ThreadPeople = Omit<NetworkPeopleResult, 'success'>;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * **Όνομα + φωτογραφία** για συγκεκριμένα πρόσωπα — ο **ένας** αναγνώστης (ονόματα νήματος · επιλογέας ομάδας).
 * ⚠️ Ο **καλών** αποφασίζει ποιοι επιτρέπεται να ονομαστούν· εδώ δεν κρίνεται τίποτα.
 */
export async function readNetworkPeople(adminDb: AdminFirestore, uids: readonly string[]): Promise<readonly NetworkPerson[]> {
  if (uids.length === 0) return [];
  const users = adminDb.collection(COLLECTIONS.USERS);
  const snaps = await adminDb.getAll(...uids.map((uid) => users.doc(uid)));
  return snaps.map((snap, index) => {
    const data = snap.data();
    return { uid: uids[index] ?? snap.id, name: text(data?.displayName), photoUrl: text(data?.photoURL) };
  });
}

/** Τα ονόματα του ακροατηρίου — ή `null` (ξένο · ανύπαρκτο: ίδια απάντηση, ADR-742). */
export async function readThreadPeople(
  adminDb: AdminFirestore,
  threadId: string,
  callerUid: string,
): Promise<ThreadPeople | null> {
  const read = await readThreadAsReader(adminDb, threadId, callerUid);
  if (read === null) return null;

  const uids = [...new Set(read.audience.map((entry) => entry.uid))].sort();
  const { topic } = read.thread;
  const [people, hostName] = await Promise.all([
    readNetworkPeople(adminDb, uids),
    topic.kind === 'act' ? readCompanyPublicName(adminDb, topic.hostCompanyId) : Promise.resolve(null),
  ]);
  return { people, hostName };
}
