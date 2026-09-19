import 'server-only';

/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ** — «διαβάζει ο καλών αυτό το νήμα; αν ναι, ποιοι είναι όλοι;»
 * @related ADR-867 §4.2 · Β5 (παρουσία) · Β7 (ονόματα) · CHECK 3.89 (δηλωμένος καταναλωτής — **μόνο ανάγνωση**)
 * @module services/network-messaging/thread-reader
 *
 * 🔑 **Μία πόρτα, δύο ερωτήματα**: η **παρουσία** («ποιος λείπει») και τα **ονόματα** («πώς λέγονται»)
 * δίνουν **μόνο** σε όποιον διαβάζει ήδη το νήμα. Δύο αντίγραφα του ελέγχου θα απέκλιναν την ημέρα που
 * το «διαβάζει» αποκτήσει δεύτερη προϋπόθεση (π.χ. φραγή, Β8).
 *
 * ⚠️ `null` για ξένο **και** για ανύπαρκτο νήμα — η **ίδια** απάντηση (ADR-742): αλλιώς η διαδρομή θα
 * έλεγε σε αγνώστους «αυτό το νήμα υπάρχει».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { NetworkAudienceEntry, NetworkThread } from '@/types/network-thread';

import { networkThreadAudience, networkThreadRef } from './network-thread-ref';
import { isLiveAudience } from './thread-audience';

/** **Όλο** το ακροατήριο (και σφραγισμένα) — μόνο αν ο καλών διαβάζει **τώρα**· αλλιώς `null`. */
export async function readAudienceAsReader(
  adminDb: AdminFirestore,
  threadId: string,
  callerUid: string,
): Promise<readonly NetworkAudienceEntry[] | null> {
  const audience = (await networkThreadAudience(adminDb, threadId).get()).docs
    .map((doc) => doc.data() as NetworkAudienceEntry);
  return isLiveAudience(audience.find((entry) => entry.uid === callerUid)) ? audience : null;
}

/**
 * **Το θέμα ενός νήματος, χωρίς αναγνώστη** — για το εργαλείο διαχειριστή που ελέγχει προορισμούς
 * ειδοποιήσεων (ADR-849 Β2). ⚠️ **Καμία** διαδρομή πελάτη δεν το καλεί: δεν ρωτά «διαβάζει ο καλών;».
 */
export async function readThreadTopic(
  adminDb: AdminFirestore,
  threadId: string,
): Promise<NetworkThread['topic'] | null> {
  const thread = (await networkThreadRef(adminDb, threadId).get()).data() as NetworkThread | undefined;
  return thread?.topic ?? null;
}

/** Το νήμα **και** το ακροατήριό του, για αναγνώστη — ή `null` (ξένο · ανύπαρκτο: ίδια απάντηση). */
export async function readThreadAsReader(
  adminDb: AdminFirestore,
  threadId: string,
  callerUid: string,
): Promise<{ readonly thread: NetworkThread; readonly audience: readonly NetworkAudienceEntry[] } | null> {
  const [threadSnap, audience] = await Promise.all([
    networkThreadRef(adminDb, threadId).get(),
    readAudienceAsReader(adminDb, threadId, callerUid),
  ]);
  const thread = threadSnap.data() as NetworkThread | undefined;
  return thread === undefined || audience === null ? null : { thread, audience };
}
