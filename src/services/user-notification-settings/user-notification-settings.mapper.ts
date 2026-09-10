/**
 * =============================================================================
 * USER NOTIFICATION SETTINGS — Ο ΜΕΤΑΦΡΑΣΤΗΣ ΣΧΗΜΑΤΟΣ
 * =============================================================================
 *
 * 🔑 **Δύο ερωτήματα ζούσαν σε ένα αρχείο** — *«ποιος διαβάζει και γράφει;»*
 * (Firestore, singleton, συνδρομές, event bus) και *«τι σχήμα έχει το έγγραφο;»*
 * (καθαρή χαρτογράφηση). Το δεύτερο εξήχθη εδώ.
 *
 * ⚠️ **Split, όχι trim** (N.7.1): καμία γραμμή δεν κόπηκε για να χωρέσει ο
 * μετρητής — μετακινήθηκε **ολόκληρη η ευθύνη**. Ίδια κίνηση με το
 * `buildPublicListing` → `projectListingShape` του ADR-777 §8.22.
 *
 * 🔗 **ADR-849 — η ανάγνωση ΔΕΝ ζει πια εδώ.** Εδώ υπήρχε η **δεύτερη** συγχώνευση με
 * τις προεπιλογές (ανά κλειδί), ενώ ο διακομιστής είχε **άλλη** (ρηχή). Και οι δύο
 * αναθέτουν πλέον στο `user-notification-settings.merge.ts`.
 *
 * @module services/user-notification-settings/user-notification-settings.mapper
 * @see ADR-849 — μοντέλο προτιμήσεων · ADR-777 §8.28 (ζώνη ώρας) · §8.29 (γλώσσα)
 */

import { Timestamp } from 'firebase/firestore';

import { nowTimestamp } from '@/lib/firestore-now';

import { mergeNotificationSettings } from './user-notification-settings.merge';
import { type UserNotificationSettings } from './user-notification-settings.types';

/**
 * Έγγραφο Firestore → `UserNotificationSettings`.
 *
 * ⚠️ **Τα defaults από κάτω, το έγγραφο από πάνω, ανά κλειδί** — μέσω της **μίας**
 * συγχώνευσης που χρησιμοποιεί και ο διακομιστής (ADR-849).
 */
export function transformSettingsFromFirestore(
  data: Record<string, unknown>,
  userId: string,
): UserNotificationSettings {
  return mergeNotificationSettings(userId, data);
}

/**
 * `UserNotificationSettings` → έγγραφο Firestore.
 *
 * ⚠️ Το `userId` **δεν** γράφεται στο σώμα: είναι το **αναγνωριστικό** του
 * εγγράφου, και μια δεύτερη αντιγραφή του θα ήταν δεύτερη αλήθεια που μπορεί
 * να αποκλίνει.
 */
export function transformSettingsToFirestore(
  settings: UserNotificationSettings,
): Record<string, unknown> {
  return {
    globalEnabled: settings.globalEnabled,
    inAppEnabled: settings.inAppEnabled,
    emailEnabled: settings.emailEnabled,
    emailFrequency: settings.emailFrequency,
    pushEnabled: settings.pushEnabled,
    categories: settings.categories,
    emailCategories: settings.emailCategories,
    quietHours: settings.quietHours,
    timezone: settings.timezone,
    language: settings.language,
    createdAt: Timestamp.fromDate(settings.createdAt),
    updatedAt: nowTimestamp(),
  };
}
