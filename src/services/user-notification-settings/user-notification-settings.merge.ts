/**
 * =============================================================================
 * ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ + ΠΡΟΕΠΙΛΟΓΕΣ — **ΜΙΑ** ΣΥΓΧΩΝΕΥΣΗ (ADR-849)
 * =============================================================================
 *
 * **Καθαρή συνάρτηση. Καμία Firestore, κανένα SDK** — την καλούν και ο διακομιστής
 * (`server/notifications/user-notification-settings-store.ts`) και ο πελάτης
 * (`user-notification-settings.mapper.ts`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΗΤΑΝ ΔΥΟ, ΜΕ ΔΙΑΦΟΡΕΤΙΚΟ ΒΑΘΟΣ — ΔΗΛΑΔΗ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ ΣΤΗΝ ΙΔΙΑ ΕΡΩΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πού | Πώς συγχώνευε τα `categories` |
 * |---|---|
 * | Διακομιστής (`mergeStoredSettings`) | **Ρηχά**: `{ ...defaults.categories, ...stored.categories }` |
 * | Πελάτης (`transformSettingsFromFirestore`) | **Ανά κλειδί**, μέσα σε κάθε κατηγορία |
 *
 * Ένα έγγραφο με `categories.properties` γραμμένο πριν υπάρξει το `demandListingMatch`
 * έδινε `undefined` στον διακομιστή και `true` στην οθόνη. Σήμερα κατέληγαν στο ίδιο
 * **κατά σύμπτωση** (ο orchestrator περνά το μη-boolean ως «επιτρέπεται»)· με το
 * `emailCategories` θα έδιναν δύο απαντήσεις. Η άγκυρα Μ0 εκτελεί την παλιά ρηχή εκδοχή.
 *
 * ⚠️ **Μόνο τιμή ΙΔΙΟΥ τύπου με την προεπιλογή περνά** — ένα `"true"` σε έγγραφο δεν
 * είναι `true`, και μια άγνωστη κατάσταση email δεν σιγάζει τίποτα.
 *
 * @module services/user-notification-settings/user-notification-settings.merge
 * @see ADR-849
 */

import { resolveHumanLanguage } from '@/i18n/languages';
import { normalizeToDate } from '@/lib/date-local';

import {
  isEmailTypeMode,
  type EmailCategorySettings,
  type EmailTypeMode,
} from './user-notification-settings.email-types';
import {
  getDefaultNotificationSettings,
  isEmailFrequency,
  type NotificationCategorySettingsMap,
  type UserNotificationSettings,
} from './user-notification-settings.types';

/** Αντικείμενο από δεδομένα που δεν ελέγξαμε — ή κενό. */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Κάθε **γνωστό** κλειδί από τις προεπιλογές· η αποθηκευμένη τιμή μόνο αν έχει τον
 * **ίδιο τύπο**. Άγνωστα κλειδιά του εγγράφου δεν περνούν.
 */
function overlayByType<T extends object>(defaults: T, stored: unknown): T {
  const raw = asRecord(stored);
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const value: unknown = raw[key];
    if (typeof value === typeof defaults[key]) merged[key] = value as T[keyof T & string];
  }
  return merged;
}

/** Οι διακόπτες των κατηγοριών — **ανά κλειδί**, όχι ανά κατηγορία. */
function mergeCategories(
  defaults: NotificationCategorySettingsMap,
  stored: unknown,
): NotificationCategorySettingsMap {
  const raw = asRecord(stored);
  return {
    crm: overlayByType(defaults.crm, raw.crm),
    properties: overlayByType(defaults.properties, raw.properties),
    tasks: overlayByType(defaults.tasks, raw.tasks),
    security: overlayByType(defaults.security, raw.security),
    procurement: overlayByType(defaults.procurement, raw.procurement),
    network: overlayByType(defaults.network, raw.network),
  };
}

/** Οι καταστάσεις email **μιας** κατηγορίας — μόνο για κλειδιά που υπάρχουν ως διακόπτες. */
function modesFor<T extends object>(
  known: T,
  stored: unknown,
): Partial<Record<keyof T, EmailTypeMode>> {
  const raw = asRecord(stored);
  const modes: Partial<Record<keyof T, EmailTypeMode>> = {};
  for (const key of Object.keys(known) as Array<keyof T & string>) {
    const value: unknown = raw[key];
    if (isEmailTypeMode(value)) modes[key] = value;
  }
  return modes;
}

/** Το email ανά τύπο — απουσία ⇒ κανένα κλειδί (ισοδυναμεί με `'on'`). */
function mergeEmailCategories(
  known: NotificationCategorySettingsMap,
  stored: unknown,
): EmailCategorySettings {
  const raw = asRecord(stored);
  return {
    crm: modesFor(known.crm, raw.crm),
    properties: modesFor(known.properties, raw.properties),
    tasks: modesFor(known.tasks, raw.tasks),
    security: modesFor(known.security, raw.security),
    procurement: modesFor(known.procurement, raw.procurement),
    network: modesFor(known.network, raw.network),
  };
}

function flagOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * **Αποθηκευμένο έγγραφο + προεπιλογές = ολόκληρες ρυθμίσεις.**
 *
 * `stored` = ό,τι επέστρεψε η Firestore (Admin **ή** client SDK) ή `undefined` όταν δεν
 * υπάρχει έγγραφο. Οι ημερομηνίες περνούν από το `normalizeToDate` (και τα δύο SDK).
 */
export function mergeNotificationSettings(userId: string, stored: unknown): UserNotificationSettings {
  const defaults = getDefaultNotificationSettings(userId);
  if (typeof stored !== 'object' || stored === null) return defaults;
  const raw = asRecord(stored);

  return {
    userId,
    globalEnabled: flagOr(raw.globalEnabled, defaults.globalEnabled),
    inAppEnabled: flagOr(raw.inAppEnabled, defaults.inAppEnabled),
    emailEnabled: flagOr(raw.emailEnabled, defaults.emailEnabled),
    emailFrequency: isEmailFrequency(raw.emailFrequency) ? raw.emailFrequency : defaults.emailFrequency,
    pushEnabled: flagOr(raw.pushEnabled, defaults.pushEnabled),
    categories: mergeCategories(defaults.categories, raw.categories),
    emailCategories: mergeEmailCategories(defaults.categories, raw.emailCategories),
    quietHours: overlayByType(defaults.quietHours, raw.quietHours),
    // ⚠️ Άκυρη ζώνη ΔΕΝ απορρίπτεται εδώ — την κρίνει το `resolveTimeZone` της πολιτικής
    // παράδοσης, ώστε μια κακή τιμή να μη σταματά την αλληλογραφία (§8.28).
    timezone: typeof raw.timezone === 'string' && raw.timezone.length > 0 ? raw.timezone : defaults.timezone,
    // §8.29 — `resolveHumanLanguage`, όχι `??`: το επικίνδυνο είναι το «υπάρχει και είναι λάθος».
    language: resolveHumanLanguage(raw.language),
    createdAt: normalizeToDate(raw.createdAt) ?? defaults.createdAt,
    updatedAt: normalizeToDate(raw.updatedAt) ?? defaults.updatedAt,
  };
}
