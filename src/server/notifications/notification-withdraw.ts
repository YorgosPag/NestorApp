/**
 * =============================================================================
 * Η ΑΠΟΣΥΡΣΗ ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ — «αυτό που σου είπα δεν ισχύει πια» (ADR-867 Β9(β) Ε10)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΚΕΝΟ**: μια ειδοποίηση γεννιόταν από γεγονός, αλλά **κανείς** δεν μπορούσε να την πάρει πίσω όταν το
 * γεγονός έπαυε να ισχύει (grep «withdraw / retract / cancel» στον τομέα ειδοποιήσεων: **0**). Μήνυμα που
 * ανακλήθηκε πριν διαβαστεί άφηνε «Νέο μήνυμα από Χ» στο κουδούνι — για κάτι που **δεν υπάρχει**.
 *
 * 🌐 **Η πρακτική των μεγάλων**: Slack, Teams και WhatsApp **δεν** αποσύρουν ό,τι ειδοποίησαν — τεκμηριωμένο
 * κενό (η προεπισκόπηση στο κλείδωμα μένει, το missed-activity email φεύγει με την αρχή του μηνύματος). Εδώ το
 * κουδούνι είναι **δικό μας** έγγραφο, άρα μπορούμε — και το email το φρουρεί ήδη η πύλη αποστολής με την ίδια
 * αλήθεια (`network-unread-email.ts`): δύο στιγμές, μία ερώτηση.
 *
 * 🔑 **Ανά ΚΛΕΙΔΙ, όχι ερώτημα**: η ταυτότητα της ειδοποίησης είναι ντετερμινιστική
 * (`generateNotificationDedupeId(eventType, recipient, eventId)` = id εγγράφου — ο ΙΔΙΟΣ γεννήτορας με τον
 * orchestrator). Ο παραγωγός που
 * ξέρει **ποιο** γεγονός έπαυσε ξέρει και **ποιο** έγγραφο — ένα `getAll`, κανένας δείκτης.
 * 🔑 **Καμία διαγραφή**: `delivery.state = 'withdrawn'` + πότε + γιατί — ίδιο δόγμα με την ταφόπλακα του μηνύματος.
 * Η απόκρυψη από τη λίστα και το σήμα είναι ο **ένας** κριτής `lib/notifications/notification-state.ts`.
 * ⚠️ **Ιδεμποτής**: ήδη αποσυρμένη ή κρυμμένη από τον άνθρωπο ⇒ δεν ξαναγράφεται. Ανύπαρκτη ⇒ τίποτα (ο
 * παραγωγός μπορεί να μην είχε ειδοποιήσει — ρυθμίσεις, σίγαση — και αυτό **δεν** είναι σφάλμα).
 *
 * @module server/notifications/notification-withdraw
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { NotificationEventType } from '@/config/notification-events';
import { isHiddenFromInbox } from '@/lib/notifications/notification-state';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';
import type { DeliveryState } from '@/types/notification';

/** Γιατί αποσύρθηκε — κλειστό σύνολο, ώστε το ίχνος να λέει **ποιο** γεγονός έπαυσε. */
export type WithdrawReason = 'source-retracted';

/** Μια ειδοποίηση, όπως την ταυτοποιεί **ο παραγωγός της**. */
export interface WithdrawTarget {
  readonly eventType: NotificationEventType;
  readonly recipientId: string;
  readonly eventId: string;
}

export interface WithdrawOutcome {
  readonly withdrawn: readonly string[];
}

/** **Απέσυρε** όσες από αυτές υπάρχουν και φαίνονται ακόμη. Ρίχνει μόνο σε βλάβη Firestore. */
export async function withdrawNotifications(
  adminDb: AdminFirestore,
  targets: readonly WithdrawTarget[],
  reason: WithdrawReason,
  nowISO: string,
): Promise<WithdrawOutcome> {
  const ids = [...new Set(targets.map((t) => generateNotificationDedupeId(t.eventType, t.recipientId, t.eventId)))];
  if (ids.length === 0) return { withdrawn: [] };

  const collection = adminDb.collection(COLLECTIONS.NOTIFICATIONS);
  const snapshots = await adminDb.getAll(...ids.map((id) => collection.doc(id)));
  const visible = snapshots.filter((snap) => {
    const state = (snap.data()?.delivery as { state?: DeliveryState } | undefined)?.state;
    return snap.exists && (state === undefined || !isHiddenFromInbox(state));
  });
  if (visible.length === 0) return { withdrawn: [] };

  const batch = adminDb.batch();
  for (const snap of visible) {
    batch.update(collection.doc(snap.id), { 'delivery.state': 'withdrawn', withdrawnAt: nowISO, withdrawnReason: reason });
  }
  await batch.commit();
  return { withdrawn: visible.map((snap) => snap.id) };
}
