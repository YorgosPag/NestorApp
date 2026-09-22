#!/usr/bin/env tsx
/**
 * **ΤΟ ΚΟΥΤΙ ΑΔΙΑΒΑΣΤΩΝ ΣΥΜΦΩΝΕΙ ΜΕ ΤΗΝ ΑΛΗΘΕΙΑ;** — ADR-867 §4.5 (Β10): μετανάστευση **και** δίχτυ (N.7.2 #4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ ΚΑΝΕΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Η γραμμή `network_inbox/{uid}/network_inbox_unread/{threadId}` υπάρχει **⇔** η θέση μετρά ως αδιάβαστη
 * (`seatCountsAsUnread`). Ο γραφέας τη γράφει στην ίδια συναλλαγή με κάθε μετάβαση — αλλά τα νήματα που
 * υπήρχαν **πριν** το Β10 δεν έχουν καμία γραμμή. Αυτό το αρχείο:
 *   1. υπολογίζει το **αναμενόμενο** κουτί από την αλήθεια (θέσεις + ιδιωτική πλευρά + νήματα),
 *   2. το συγκρίνει με το **υπάρχον** (collection group — πιάνει και ορφανές γραμμές),
 *   3. για κάθε απόκλιση **ζητά** από τον γραφέα `reconcileInboxSeat` (δική του συναλλαγή, ιδεμποτής).
 *
 * 🔑 **Καμία γραφή εδώ** (CHECK 3.89 Κ3): ο μετανάστης ζητά, ο γραφέας γράφει — και ξαναδιαβάζει την αλήθεια
 * μέσα στη συναλλαγή του, άρα ένα μήνυμα που φτάνει ενώ τρέχει το script **δεν** γράφεται λάθος.
 * ⚠️ Πρώτα `firebase deploy --only firestore:rules` (ο κανόνας του κουτιού) — αλλιώς η οθόνη παίρνει άρνηση
 * και δείχνει 0 (commit ≠ deploy, CHECK 3.86).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ — ξηρό εξ ορισμού· το ξηρό τρέξιμο ΕΙΝΑΙ η αναφορά απόκλισης (exit 1 αν ≠ 0)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run migrate:network-inbox
 *   npm run migrate:network-inbox -- --apply
 *
 * @see docs/centralized-systems/reference/adrs/ADR-867-network-messaging-core.md §4.5
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { inboxVerdictsOf } from '@/lib/network-messaging/thread-liveness';
import { joinAudienceSeats } from '@/services/network-messaging/audience-seats';
import {
  networkAudienceGroup,
  networkInboxUnreadGroup,
  networkThreadRef,
} from '@/services/network-messaging/network-thread-ref';
import { reconcileInboxSeat, type InboxReconcileOutcome } from '@/services/network-messaging/thread-writer';
import type { NetworkThread } from '@/types/network-thread';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const APPLY = process.argv.slice(2).includes('--apply');
/** Όριο αναφορών ανά `getAll` — πολύ κάτω από το όριο αιτήματος. */
const CHUNK = 300;

/** Κλειδί θέσης: `threadId/uid` → η τιμή της γραμμής· απουσία κλειδιού ⇒ καμία γραμμή. */
type InboxState = Map<string, string | null>;

const keyOf = (threadId: string, uid: string): string => `${threadId}/${uid}`;

function chunks<T>(items: readonly T[]): readonly (readonly T[])[] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/** Το **αναμενόμενο** κουτί — από την αλήθεια, με τον **ίδιο** ορισμό που χρησιμοποιεί ο γραφέας. */
async function expectedInbox(): Promise<InboxState> {
  const db = getAdminFirestore();
  const rows = (await networkAudienceGroup(db).get()).docs.flatMap((doc) => {
    const threadId = doc.ref.parent.parent?.id;
    return threadId === undefined ? [] : [{ threadId, uid: doc.id, publicRaw: doc.data() }];
  });
  const expected: InboxState = new Map();
  for (const part of chunks(rows)) {
    const threadIds = [...new Set(part.map((row) => row.threadId))];
    const [seats, threads] = await Promise.all([
      joinAudienceSeats((...refs) => db.getAll(...refs), db, part),
      db.getAll(...threadIds.map((id) => networkThreadRef(db, id))),
    ]);
    const threadById = new Map(threads.map((snap) => [snap.id, snap.data() as NetworkThread | undefined]));
    part.forEach((row, index) => {
      const seat = seats[index];
      const thread = threadById.get(row.threadId);
      const [verdict] = seat === null || seat === undefined || thread === undefined ? [] : inboxVerdictsOf([seat], thread);
      // Μόνο όσες ΠΡΕΠΕΙ να υπάρχουν — απουσία κλειδιού = «καμία γραμμή», ίδια σημασία με το υπάρχον κουτί.
      if (verdict !== undefined && verdict.liveMessageAt !== null) expected.set(keyOf(row.threadId, row.uid), verdict.liveMessageAt);
    });
  }
  return expected;
}

/** Το **υπάρχον** κουτί — όλες οι γραμμές, και οι ορφανές. */
async function actualInbox(): Promise<InboxState> {
  const snapshot = await networkInboxUnreadGroup(getAdminFirestore()).get();
  const actual: InboxState = new Map();
  for (const doc of snapshot.docs) {
    const uid = doc.ref.parent.parent?.id;
    const value = doc.data().liveMessageAt;
    if (uid !== undefined) actual.set(keyOf(doc.id, uid), typeof value === 'string' ? value : null);
  }
  return actual;
}

/** Οι θέσεις όπου αναμενόμενο και υπάρχον **διαφωνούν** — λείπει, περισσεύει ή έχει άλλη τιμή. */
async function drift(): Promise<readonly string[]> {
  const [expected, actual] = await Promise.all([expectedInbox(), actualInbox()]);
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  return [...keys].filter((key) => rowOf(expected, key) !== rowOf(actual, key));
}

/** Η γραμμή όπως φαίνεται στη σύγκριση: `null` ⇒ δεν υπάρχει· χαλασμένη τιμή ⇒ `'∅'` (ώστε να διορθωθεί). */
function rowOf(state: InboxState, key: string): string | null {
  if (!state.has(key)) return null;
  return state.get(key) ?? '∅';
}

async function main(): Promise<void> {
  const pending = await drift();
  console.log(`🔎 Θέσεις όπου το κουτί αδιάβαστων διαφωνεί με την αλήθεια: ${pending.length}`);
  for (const key of pending) console.log(`   • ${key}`);

  if (!APPLY) {
    console.log(pending.length === 0 ? '✅ Απόκλιση 0.' : '⚠️  Ξηρό τρέξιμο. Με `-- --apply` διορθώνονται από τον γραφέα.');
    process.exit(pending.length === 0 ? 0 : 1);
  }

  const tally: Record<InboxReconcileOutcome, number> = { unread: 0, clear: 0 };
  for (const key of pending) {
    const [threadId, uid] = key.split('/');
    tally[await reconcileInboxSeat(getAdminFirestore(), threadId, uid)] += 1;
  }
  console.log(`✍️  Αδιάβαστες: ${tally.unread} · καθαρές: ${tally.clear}`);
  const left = await drift();
  console.log(left.length === 0 ? '✅ Απόκλιση 0.' : `❌ Απομένουν ${left.length}.`);
  process.exit(left.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('❌ Η συμφιλίωση απέτυχε:', error);
  process.exit(1);
});
