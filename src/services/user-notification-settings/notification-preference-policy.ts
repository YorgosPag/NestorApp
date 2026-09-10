/**
 * =============================================================================
 * ΠΟΛΙΤΙΚΗ ΠΡΟΤΙΜΗΣΕΩΝ — «θέλει αυτόν τον τύπο; και με email;» (ADR-849)
 * =============================================================================
 *
 * **Καθαρές συναρτήσεις, για διακομιστή ΚΑΙ πελάτη.** Τις ρωτούν: η πύλη του κουδουνιού
 * (`notification-orchestrator`), η απόφαση email (`email-delivery-window`) — **και** τη
 * στιγμή της ουράς **και** τη στιγμή της αποστολής — η οθόνη ρυθμίσεων και η σελίδα
 * προτιμήσεων email. Αν η καθεμιά διάβαζε μόνη της τα `categories`/`emailCategories`, η
 * πρώτη αλλαγή σχήματος θα έφτανε σε μία και η οθόνη θα έλεγε «κλειστό» για email που φεύγει.
 *
 * 🔑 **Δύο ερωτήματα, ΟΧΙ δύο αλήθειες** (ADR-749): ο κύριος διακόπτης (`categories`)
 * κρίνει *«θέλω αυτόν τον τύπο;»*, το `emailCategories` κρίνει *«…και με email;»* και μπορεί
 * μόνο να στενέψει.
 *
 * @module services/user-notification-settings/notification-preference-policy
 * @see ADR-849
 */

import { EVENT_CATEGORY_MAP, type EventCategoryMapping } from '@/config/notification-events';

import type { EmailTypeMode } from './user-notification-settings.email-types';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from './user-notification-settings.types';

/** Ο διακόπτης ενός τύπου: κατηγορία + κλειδί — όπως το δηλώνει το `EVENT_CATEGORY_MAP`. */
export type NotificationSettingRef = Pick<EventCategoryMapping, 'category' | 'settingKey'>;

/** Το κελί `table[κατηγορία][κλειδί]` — ή `undefined`. */
function cellOf(table: object, ref: NotificationSettingRef): unknown {
  const row: unknown = Reflect.get(table, ref.category);
  return typeof row === 'object' && row !== null ? Reflect.get(row, ref.settingKey) : undefined;
}

/**
 * **Είναι ανοιχτός ο κύριος διακόπτης του τύπου;** (κουδούνι **και** email)
 *
 * ⚠️ **Μόνο ρητό `false` κλείνει** — ίδια σημασία με τον orchestrator πριν το ADR-849: ένα
 * κλειδί που λείπει δεν σιωπά σιωπηλά έναν τύπο που ο άνθρωπος δεν έκλεισε ποτέ.
 */
export function categorySettingEnabled(
  settings: Pick<UserNotificationSettings, 'categories'>,
  ref: NotificationSettingRef,
): boolean {
  return cellOf(settings.categories, ref) !== false;
}

/**
 * **Φτάνει ο τύπος και με email;** Μόνο το ρητό `'off'` σιγάζει· απουσία ⇒ `'on'`.
 *
 * ⚠️ Δεν ρωτά τον κύριο διακόπτη — αυτό το κάνει ο καλών **πρώτα** (`emailSuppressionReason`),
 * ώστε ο λόγος σίγασης να λέει **ποιος** από τους δύο έκλεισε.
 */
export function emailModeFor(
  settings: Pick<UserNotificationSettings, 'emailCategories'>,
  ref: NotificationSettingRef,
): EmailTypeMode {
  return cellOf(settings.emailCategories, ref) === 'off' ? 'off' : 'on';
}

// ============================================================================
// Η ΔΙΑΔΡΟΜΗ ΕΝΟΣ ΔΙΑΚΟΠΤΗ — «κατηγορία.κλειδί» (ADR-849 Α2)
// ============================================================================

/**
 * Οι διακόπτες που **υπάρχουν** — από τις προεπιλογές, όχι από δεύτερη λίστα: ό,τι
 * προστεθεί στο μοντέλο γίνεται αποδεκτό εδώ χωρίς να το θυμηθεί κανείς.
 */
const KNOWN_SETTINGS = getDefaultNotificationSettings('').categories;

/** `{ category, settingKey }` → `'properties.demandListingMatch'`. */
export function settingPathOf(ref: NotificationSettingRef): string {
  return `${ref.category}.${ref.settingKey}`;
}

/**
 * **Διαδρομή από δεδομένα που δεν ελέγξαμε → διακόπτης** — ή `null` αν δεν υπάρχει.
 *
 * ⚠️ Έρχεται από **token**, **αίτημα** ή **έγγραφο**. Ένα `'properties.__proto__'` ή ένα
 * κλειδί που καταργήθηκε δεν επιτρέπεται να γίνει πεδίο εγγραφής.
 */
export function parseSettingPath(value: unknown): NotificationSettingRef | null {
  if (typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const category = value.slice(0, dot);
  const settingKey = value.slice(dot + 1);
  if (!Object.prototype.hasOwnProperty.call(KNOWN_SETTINGS, category)) return null;
  const row: unknown = Reflect.get(KNOWN_SETTINGS, category);
  if (typeof row !== 'object' || row === null || !Object.prototype.hasOwnProperty.call(row, settingKey)) {
    return null;
  }
  return { category, settingKey } as NotificationSettingRef;
}

/**
 * **Είναι ο διακόπτης υποχρεωτικού τύπου;** — τότε καμία ρύθμιση δεν τον σιγάζει, και
 * καμία επιφάνεια δεν προσφέρει «σταμάτα» (θα ήταν υπόσχεση που δεν τηρείται).
 */
export function isMandatorySetting(ref: NotificationSettingRef): boolean {
  return Object.values(EVENT_CATEGORY_MAP).some(
    (mapping) =>
      mapping.isMandatory && mapping.category === ref.category && mapping.settingKey === ref.settingKey,
  );
}

/** Οι τύποι που **δεν** φτάνουν με email — ταξινομημένες διαδρομές, για τη σελίδα και την αναίρεση. */
export function mutedEmailTypes(settings: Pick<UserNotificationSettings, 'emailCategories'>): string[] {
  const muted: string[] = [];
  for (const [category, row] of Object.entries(settings.emailCategories)) {
    for (const [settingKey, mode] of Object.entries(row ?? {})) {
      if (mode === 'off') muted.push(`${category}.${settingKey}`);
    }
  }
  return muted.sort();
}
