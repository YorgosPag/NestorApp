/**
 * @fileoverview **«ΙΣΧΥΕΙ ΑΚΟΜΗ;»** — η ερώτηση της πύλης αποστολής για το email «ο πελάτης σού έγραψε»
 *   (ADR-939 §6.1 βήμα 6Β · ADR-849 §6ε).
 * @related server/notifications/email-send-gate.ts (ο καλών) · types/notification-email-facts.ts
 *   (`CrmConversationUnreadFacts`) · services/network-messaging/network-unread-email.ts (το ίδιο σχήμα για το δίκτυο)
 * @module server/comms/crm/crm-conversation-unread-email
 *
 * 🌐 **Το email συνεργάτη του Intercom**: φεύγει μετά από σιωπή, **ένα** για όλα τα μηνύματα, και **καθόλου** αν το
 * είδε. Η ειδοποίηση μπήκε στην ουρά με αναμονή (`unread-grace`)· **τη στιγμή που θα έφευγε** ρωτάμε την αλήθεια.
 *
 * 🏆 **Ρωτά δύο πράγματα — το Intercom ρωτά μόνο το δεύτερο:**
 * | Ερώτηση | Αν «όχι» |
 * |---|---|
 * | είναι **αυτό** ακόμη το τελευταίο μήνυμα της συνομιλίας; | δεν φεύγει — απάντησε **οποιοσδήποτε** συνάδελφος, ή ο πελάτης έγραψε ξανά (το email πάει με **εκείνο**, που κουβαλά όλα τα αναπάντητα) |
 * | **δεν** είδε ο παραλήπτης την ειδοποίηση; | δεν φεύγει — την είδε στο κουδούνι |
 *
 * ⚠️ **Ταυτότητα, ποτέ ώρα**: «το τελευταίο» κρίνεται με το id του μηνύματος.
 * ⚠️ **Δεν** χρησιμοποιεί το `conversations.unreadCount`: μετρημένο ότι μόνο αυξάνεται και αφορά όλη την εταιρεία.
 * ⚠️ **Μόνο ανάγνωση.** Αποτυχία ανάγνωσης ⇒ **ρίχνει**: η πύλη αφήνει τα μηνύματα `pending` για το επόμενο πέρασμα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { readMessagesPage } from '@/app/api/conversations/[conversationId]/messages/conversation-messages-page';
import { COLLECTIONS } from '@/config/firestore-collections';
import { notificationWasSeen } from '@/server/notifications/notification-read';
import { crmConversationUnreadKey, type CrmConversationUnreadRef } from '@/types/notification-email-facts';

/** Η αλήθεια για **ένα** email, τη στιγμή της αποστολής. */
export interface CrmUnreadTruth {
  /** Το id του πιο πρόσφατου μηνύματος της συνομιλίας — `null` αν δεν υπάρχει κανένα. */
  readonly latestMessageId: string | null;
  /** Είδε ο παραλήπτης την ειδοποίηση; (`false` αν το email δεν έχει ειδοποίηση) */
  readonly notificationSeen: boolean;
}

/** 🔑 **Ο κριτής, καθαρός** — `true` ⇒ το email έχει ακόμη νόημα. */
export function isCrmUnreadStillPending(truth: CrmUnreadTruth, messageId: string): boolean {
  return truth.latestMessageId === messageId && !truth.notificationSeen;
}

/** Το πιο πρόσφατο μήνυμα ανά συνομιλία — μία ανάγνωση ανά **διαφορετική** συνομιλία του περάσματος. */
async function latestMessageIds(conversationIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
  const pages = await Promise.all(conversationIds.map((conversationId) =>
    readMessagesPage({ conversationId, page: 1, pageSize: 1, order: 'desc' })));
  return new Map(conversationIds.map((id, index) => [id, pages[index]?.messages[0]?.id ?? null] as const));
}

/** Ποιες ειδοποιήσεις διαβάστηκαν — `getAll`, ανάγνωση ανά κλειδί. */
async function seenNotificationIds(adminDb: AdminFirestore, ids: readonly string[]): Promise<ReadonlySet<string>> {
  if (ids.length === 0) return new Set();
  const collection = adminDb.collection(COLLECTIONS.NOTIFICATIONS);
  const snaps = await adminDb.getAll(...ids.map((id) => collection.doc(id)));
  return new Set(snaps.filter((snap) => notificationWasSeen(snap.data())).map((snap) => snap.id));
}

/**
 * **Ποια email «ο πελάτης σού έγραψε» ισχύουν ακόμη** — επιστρέφει κλειδιά `crmConversationUnreadKey`.
 * ⚠️ Αποτυχία ανάγνωσης ⇒ **ρίχνει** (ίδιο δόγμα με τους υπόλοιπους φορτωτές της πύλης).
 */
export async function crmConversationUnreadStillPending(
  adminDb: AdminFirestore,
  refs: readonly CrmConversationUnreadRef[],
): Promise<ReadonlySet<string>> {
  const unique = [...new Map(refs.map((ref) => [crmConversationUnreadKey(ref), ref])).values()];
  if (unique.length === 0) return new Set();

  const notificationIds = [...new Set(unique.flatMap((ref) => (ref.notificationId ? [ref.notificationId] : [])))];
  const [latest, seen] = await Promise.all([
    latestMessageIds([...new Set(unique.map((ref) => ref.conversationId))]),
    seenNotificationIds(adminDb, notificationIds),
  ]);

  const pending = new Set<string>();
  for (const ref of unique) {
    const truth: CrmUnreadTruth = {
      latestMessageId: latest.get(ref.conversationId) ?? null,
      notificationSeen: ref.notificationId !== undefined && seen.has(ref.notificationId),
    };
    if (isCrmUnreadStillPending(truth, ref.messageId)) pending.add(crmConversationUnreadKey(ref));
  }
  return pending;
}
