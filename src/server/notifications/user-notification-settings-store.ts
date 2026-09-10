/**
 * =============================================================================
 * ΟΙ ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ (ADR-848 · ADR-849)
 * =============================================================================
 *
 * Ζούσε ιδιωτικά μέσα στον `notification-orchestrator`. Η σελίδα προτιμήσεων email,
 * ο συγγραφέας της διαγραφής (RFC 8058) και —από το ADR-849— η πύλη της **αποστολής**
 * (`email-send-gate.ts`) κάνουν **την ίδια** ερώτηση: «ποιες είναι οι ρυθμίσεις αυτού
 * του ανθρώπου, **με** τις προεπιλογές από κάτω;».
 *
 * @module server/notifications/user-notification-settings-store
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { mergeNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.merge';
import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

/**
 * **Αποθηκευμένο έγγραφο + προεπιλογές = ολόκληρες ρυθμίσεις.** Καθαρή συνάρτηση.
 *
 * 🔗 **ADR-849 — αναθέτει στη ΜΙΑ συγχώνευση** (`user-notification-settings.merge.ts`).
 * Εδώ ζούσε δεύτερη εκδοχή, με **ρηχό** merge των `categories`, ενώ ο πελάτης έκανε
 * merge **ανά κλειδί**: το ίδιο έγγραφο έδινε `undefined` εδώ και `true` στην οθόνη.
 *
 * 🔴 (ADR-777 §8.28) Το ωμό `doc.data() as UserNotificationSettings` υποσχόταν ότι **κάθε**
 * πεδίο υπάρχει· έγγραφο χωρίς `quietHours` θα έριχνε `TypeError` μέσα στον αγωγό που
 * παραδίδει αλληλογραφία για όλους. Η συγχώνευση το αποκλείει δομικά.
 */
export function mergeStoredSettings(userId: string, stored: unknown): UserNotificationSettings {
  return mergeNotificationSettings(userId, stored);
}

/** Οι ρυθμίσεις του χρήστη, από τη βάση, με τις προεπιλογές από κάτω. */
export async function loadUserNotificationSettings(
  userId: string,
): Promise<UserNotificationSettings> {
  const doc = await getAdminFirestore()
    .collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS)
    .doc(userId)
    .get();

  return mergeStoredSettings(userId, doc.exists ? doc.data() : undefined);
}

/**
 * **Οι ρυθμίσεις ΠΟΛΛΩΝ χρηστών, με ΜΙΑ ανάγνωση** — ADR-849, για την πύλη της αποστολής.
 *
 * ⚠️ **`getAll` ανά κλειδί, ΠΟΤΕ ερώτημα `in`** (ίδιο μάθημα με το `notification-read.ts`):
 * το `in` κόβει σιωπηλά μετά τη δέκατη ταυτότητα. Χρήστης χωρίς έγγραφο ⇒ οι
 * **προεπιλογές**, όχι «λείπει» — κάθε ταυτότητα της εισόδου έχει απάντηση.
 */
export async function loadUserNotificationSettingsMany(
  userIds: readonly string[],
): Promise<ReadonlyMap<string, UserNotificationSettings>> {
  const unique = [...new Set(userIds)].filter((id) => id.length > 0);
  if (unique.length === 0) return new Map();

  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS);
  const snapshots = await db.getAll(...unique.map((id) => collection.doc(id)));

  return new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      mergeStoredSettings(snapshot.id, snapshot.exists ? snapshot.data() : undefined),
    ]),
  );
}
