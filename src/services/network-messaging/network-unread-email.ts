/**
 * @fileoverview **«ΕΚΚΡΕΜΕΙ ΑΚΟΜΗ;»** — η ερώτηση της πύλης αποστολής για το email «έχεις αδιάβαστο
 * μήνυμα» (ADR-867 Β6).
 * @related server/notifications/email-send-gate.ts (ο καλών) · types/notification-email-facts.ts
 *   (`NetworkThreadUnreadFacts`) · network-away.ts (`readAwaysOf`) · CHECK 3.89 (δηλωμένος καταναλωτής)
 * @module services/network-messaging/network-unread-email
 *
 * 🌐 **Το missed-activity email του Teams / το «when I'm not active» του Slack**: email **μόνο** για ό,τι
 * έμεινε αδιάβαστο. Η ειδοποίηση μπήκε στην ουρά με αναμονή (`unread-grace`)· **τη στιγμή που θα
 * έφευγε** ρωτάμε ξανά την αλήθεια — ποτέ ό,τι ίσχυε όταν γράφτηκε.
 *
 * 🏆 **Ρωτά έξι πράγματα, όχι ένα** — και οι μεγάλοι ρωτούν μόνο το πρώτο. Το έκτο είναι το «undo send» του
 * Gmail, πάνω στην αναμονή που **ήδη** έχουμε: Teams και Slack στέλνουν το email ακόμη κι αν το μήνυμα σβήστηκε.
 * ⚠️ Ισχύει όσο το email δεν έχει φύγει (αναμονή 15′ · παράθυρο ανάκλησης 60′): ό,τι έφυγε δεν γυρίζει πίσω.
 * | Ερώτηση | Αν «ναι» |
 * |---|---|
 * | διάβασε το νήμα από το `since`; | δεν φεύγει — το είδε |
 * | το **σίγασε** στο μεταξύ; | δεν φεύγει — ADR-834 (α) ② |
 * | **βγήκε** από το ακροατήριο; | δεν φεύγει — δεν διαβάζει πια (ούτε από email) |
 * | **λείπει** τώρα; | δεν φεύγει — διαβάζουν οι αναπληρωτές του (ADR-834 (ε)) |
 * | το νήμα **έκλεισε**; | δεν φεύγει — ΓΚΠΔ (β) |
 * | υπάρχει **ακόμη** ζωντανό μήνυμα να διαβάσει; | αν όχι, δεν φεύγει — ανακλήθηκε πριν το δει (Ε10) |
 *
 * ⚠️ **Μόνο ανάγνωση** — καμία γραφή ακροατηρίου (Κ3 της CHECK 3.89).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { NetworkAudienceSeat, NetworkThread } from '@/types/network-thread';
import { networkUnreadKey, type NetworkUnreadRef } from '@/types/notification-email-facts';
import { hasLiveUnread } from '@/lib/network-messaging/thread-liveness';

import { joinAudienceSeats } from './audience-seats';
import { isAwayActive, readAwaysOf, type NetworkAway } from './network-away';
import { networkAudienceRef, networkThreadRef } from './network-thread-ref';
import { isLiveAudience } from './thread-audience';

/** Η αλήθεια για **ένα** αδιάβαστο, τη στιγμή της αποστολής. */
export interface UnreadTruth {
  readonly threadOpen: boolean;
  /** Το νήμα, όσο χρειάζεται για το «υπάρχει ακόμη ζωντανό μήνυμα;» (`thread-liveness.ts`). `null` ⇒ δεν υπάρχει. */
  readonly thread: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'> | null;
  /** 🔒 Η θέση **με** την ιδιωτική πλευρά (σίγαση · ώρα ανάγνωσης — ADR-867 Β9(β) Ε9). */
  readonly entry: NetworkAudienceSeat | null;
  readonly away: NetworkAway | null;
}

/** 🔑 **Ο κριτής, καθαρός** — `true` ⇒ το email έχει ακόμη νόημα. */
export function isUnreadStillPending(truth: UnreadTruth, since: string, nowISO: string): boolean {
  const { entry } = truth;
  if (!truth.threadOpen || entry === null || !isLiveAudience(entry) || entry.muted) return false;
  if (isAwayActive(truth.away, nowISO)) return false;
  if (truth.thread === null || !hasLiveUnread(truth.thread, entry.lastReadAt)) return false;
  return entry.lastReadAt === null || Date.parse(entry.lastReadAt) < Date.parse(since);
}

/**
 * **Ποια αδιάβαστα εκκρεμούν ακόμη** — με σταθερό πλήθος αναγνώσεων για όλο το πέρασμα (`getAll` νημάτων,
 * `getAll` γραμμών, `getAll` της ιδιωτικής τους πλευράς, και μία για τις απουσίες). Επιστρέφει κλειδιά `networkUnreadKey`.
 * ⚠️ Αποτυχία ανάγνωσης ⇒ **ρίχνει**: η πύλη τότε αφήνει τα μηνύματα `pending` για το επόμενο πέρασμα.
 */
export async function networkUnreadStillPending(
  adminDb: AdminFirestore,
  refs: readonly NetworkUnreadRef[],
  nowISO: string,
): Promise<ReadonlySet<string>> {
  const unique = [...new Map(refs.map((ref) => [networkUnreadKey(ref), ref])).values()];
  if (unique.length === 0) return new Set();

  const threadIds = [...new Set(unique.map((ref) => ref.threadId))];
  const [threadSnaps, entrySnaps, aways] = await Promise.all([
    adminDb.getAll(...threadIds.map((id) => networkThreadRef(adminDb, id))),
    adminDb.getAll(...unique.map((ref) => networkAudienceRef(adminDb, ref.threadId, ref.recipientUid))),
    readAwaysOf(adminDb, unique.map((ref) => ref.recipientUid)),
  ]);
  const seats = await joinAudienceSeats((...docRefs) => adminDb.getAll(...docRefs), adminDb, unique.map((ref, index) => ({
    threadId: ref.threadId,
    uid: ref.recipientUid,
    publicRaw: entrySnaps[index]?.data(),
  })));
  const threads = new Map(threadSnaps.flatMap((snap) => {
    const thread = snap.data() as NetworkThread | undefined;
    return thread === undefined ? [] : [[snap.id, thread] as const];
  }));

  const pending = new Set<string>();
  unique.forEach((ref, index) => {
    const truth: UnreadTruth = {
      threadOpen: threads.get(ref.threadId)?.state === 'open',
      thread: threads.get(ref.threadId) ?? null,
      entry: seats[index] ?? null,
      away: aways.get(ref.recipientUid) ?? null,
    };
    if (isUnreadStillPending(truth, ref.since, nowISO)) pending.add(networkUnreadKey(ref));
  });
  return pending;
}
