/**
 * =============================================================================
 * ΟΙ ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ (ADR-848)
 * =============================================================================
 *
 * Ζούσε ιδιωτικά μέσα στον `notification-orchestrator`. Η σελίδα προτιμήσεων email
 * και ο συγγραφέας της διαγραφής (RFC 8058) κάνουν **την ίδια** ερώτηση — «ποιες είναι
 * οι ρυθμίσεις αυτού του ανθρώπου, **με** τις προεπιλογές από κάτω;». Δεύτερη
 * υλοποίηση θα ήταν δεύτερη απάντηση, και η πρώτη που θα ξεχνούσε το ένθετο merge θα
 * έβλεπε `quietHours: undefined`.
 *
 * @module server/notifications/user-notification-settings-store
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

/**
 * **Αποθηκευμένο έγγραφο + προεπιλογές = ολόκληρες ρυθμίσεις.** Καθαρή συνάρτηση.
 *
 * 🔴 **ΤΟ ΩΜΟ `as` ΗΤΑΝ ΨΕΜΑ ΠΡΟΣ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ** (ADR-777 §8.28). Το
 * `doc.data() as UserNotificationSettings` υπόσχεται ότι **κάθε** πεδίο υπάρχει. Δεν
 * υπάρχει: τα έγγραφα γράφτηκαν σε διαφορετικές εποχές του σχήματος, και κάθε νέο
 * πεδίο έρχεται ως `undefined` **με τον τύπο να λέει ότι δεν γίνεται**. Το
 * `insideQuietHours` διαβάζει `quietHours.enabled` — έγγραφο χωρίς `quietHours` θα
 * έριχνε `TypeError` **μέσα στον αγωγό που παραδίδει αλληλογραφία για όλους**.
 *
 * ⚠️ Τα ένθετα αντικείμενα θέλουν **δικό τους** merge: ένα `...stored` από πάνω
 * αντικαθιστά ολόκληρο το `quietHours`, οπότε ένα έγγραφο που έχει μόνο
 * `{ enabled: true }` θα έχανε τις ώρες του.
 */
export function mergeStoredSettings(
  userId: string,
  stored: Partial<UserNotificationSettings> | undefined,
): UserNotificationSettings {
  const defaults = getDefaultNotificationSettings(userId);
  if (!stored) return defaults;

  return {
    ...defaults,
    ...stored,
    quietHours: { ...defaults.quietHours, ...(stored.quietHours ?? {}) },
    categories: { ...defaults.categories, ...(stored.categories ?? {}) },
    userId,
  };
}

/** Οι ρυθμίσεις του χρήστη, από τη βάση, με τις προεπιλογές από κάτω. */
export async function loadUserNotificationSettings(
  userId: string,
): Promise<UserNotificationSettings> {
  const doc = await getAdminFirestore()
    .collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS)
    .doc(userId)
    .get();

  return mergeStoredSettings(
    userId,
    doc.exists ? ((doc.data() ?? {}) as Partial<UserNotificationSettings>) : undefined,
  );
}
