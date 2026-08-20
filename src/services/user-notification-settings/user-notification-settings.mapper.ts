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
 * 🔑 **Και οι δύο συναρτήσεις είναι ΚΑΘΑΡΕΣ**: καμία Firestore κλήση, κανένα
 * `this`, καμία κατάσταση. Γι' αυτό μπορούν να δοκιμαστούν **χωρίς** emulator —
 * κάτι που, όσο ζούσαν ως `private` μέθοδοι singleton, ήταν αδύνατο.
 *
 * @module services/user-notification-settings/user-notification-settings.mapper
 * @see ADR-025 — Notification Settings Centralization
 * @see ADR-777 §8.28 (ζώνη ώρας) · §8.29 (γλώσσα παραλήπτη)
 */

import { Timestamp } from 'firebase/firestore';

import { resolveHumanLanguage } from '@/i18n/languages';
import { normalizeToDate } from '@/lib/date-local';
import { nowTimestamp } from '@/lib/firestore-now';

import {
  type UserNotificationSettings,
  getDefaultNotificationSettings,
} from './user-notification-settings.types';

/**
 * Έγγραφο Firestore → `UserNotificationSettings`.
 *
 * ⚠️ **Τα defaults από κάτω, το έγγραφο από πάνω** — και τα ένθετα αντικείμενα
 * θέλουν **δικό τους** merge: ένα σκέτο spread θα αντικαθιστούσε ολόκληρο το
 * `quietHours`, οπότε έγγραφο με μόνο `{ enabled: true }` θα έχανε τις ώρες του.
 */
export function transformSettingsFromFirestore(
  data: Record<string, unknown>,
  userId: string,
): UserNotificationSettings {
  const defaults = getDefaultNotificationSettings(userId);
  const categories = data.categories as Record<string, unknown> | undefined;

  return {
    userId,
    globalEnabled: (data.globalEnabled as boolean) ?? defaults.globalEnabled,
    inAppEnabled: (data.inAppEnabled as boolean) ?? defaults.inAppEnabled,
    emailEnabled: (data.emailEnabled as boolean) ?? defaults.emailEnabled,
    emailFrequency:
      (data.emailFrequency as UserNotificationSettings['emailFrequency']) ??
      defaults.emailFrequency,
    pushEnabled: (data.pushEnabled as boolean) ?? defaults.pushEnabled,
    categories: {
      crm: { ...defaults.categories.crm, ...(categories?.crm as Record<string, boolean>) },
      properties: {
        ...defaults.categories.properties,
        ...(categories?.properties as Record<string, boolean>),
      },
      tasks: { ...defaults.categories.tasks, ...(categories?.tasks as Record<string, boolean>) },
      security: {
        ...defaults.categories.security,
        ...(categories?.security as Record<string, boolean>),
      },
      procurement: {
        ...defaults.categories.procurement,
        ...(categories?.procurement as Record<string, boolean>),
      },
    },
    quietHours: {
      ...defaults.quietHours,
      ...((data.quietHours as Record<string, unknown>) ?? {}),
    },
    // ⚠️ Τα υπάρχοντα έγγραφα **δεν έχουν** το πεδίο (προστέθηκε στο §8.28). Το
    // `??` τους δίνει την προεπιλογή χωρίς migration: κανένας δεν χάνει ρύθμιση
    // και κανένας δεν αποκτά `undefined` που θα έριχνε το `Intl`.
    timezone: (data.timezone as string) ?? defaults.timezone,
    // 🌐 §8.29 — **`resolveHumanLanguage`, ΟΧΙ `?? defaults.language`.** Το `??`
    // πιάνει μόνο το «λείπει»· εδώ το επικίνδυνο είναι το «υπάρχει και είναι
    // λάθος»: `'pseudo'` από επιλογέα ανάπτυξης, ή `'el-GR'` από κάποιον που
    // μπέρδεψε αυτό το πεδίο με το φάντασμα `notificationPreferences.locale`.
    // Και τα δύο θα περνούσαν αυτούσια και θα κατέληγαν σε email.
    language: resolveHumanLanguage(data.language),
    createdAt: normalizeToDate(data.createdAt) ?? defaults.createdAt,
    updatedAt: normalizeToDate(data.updatedAt) ?? defaults.updatedAt,
  };
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
    quietHours: settings.quietHours,
    timezone: settings.timezone,
    language: settings.language,
    createdAt: Timestamp.fromDate(settings.createdAt),
    updatedAt: nowTimestamp(),
  };
}
