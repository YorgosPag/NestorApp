/**
 * =============================================================================
 * EMAIL ΑΝΑ ΤΥΠΟ — ο τύπος και οι κριτές του (ADR-849 Δ1)
 * =============================================================================
 *
 * Χωριστό από το `user-notification-settings.types.ts` **κατά ευθύνη** (N.7.1): εκείνο
 * περιγράφει *«ποιους τύπους θέλω;»*, αυτό *«…και με email;»*. Καμία εξάρτηση χρόνου
 * εκτέλεσης πέρα από τον εαυτό του — ο τύπος των ρυθμίσεων το εισάγει, όχι το αντίστροφο.
 *
 * @module services/user-notification-settings/user-notification-settings.email-types
 * @see ADR-849
 */

import type {
  NotificationCategory,
  NotificationCategorySettingsMap,
} from './user-notification-settings.types';

/**
 * **Φτάνει αυτός ο τύπος και με email;**
 *
 * ⚠️ **Κατάσταση, ΟΧΙ boolean, και είναι απόφαση**: αύριο θα θέλουμε «μία σύνοψη την ημέρα
 * μόνο για αυτόν τον τύπο» (LinkedIn: συχνότητα ανά κατηγορία). Με boolean αυτό θα ήταν
 * migration· με ένωση είναι μία ακόμη τιμή.
 */
export type EmailTypeMode = 'on' | 'off';

const EMAIL_TYPE_MODES: Readonly<Record<EmailTypeMode, true>> = { on: true, off: true };

/** **Είναι αυτή η τιμή κατάσταση email τύπου;** Ό,τι άλλο ⇒ αγνοείται (ισοδυναμεί με `'on'`). */
export function isEmailTypeMode(value: unknown): value is EmailTypeMode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_TYPE_MODES, value);
}

/**
 * 📧 **Το email ανά τύπο, με ΤΟ ΙΔΙΟ σχήμα με το `categories`.**
 *
 * 🔑 **Δεν είναι δεύτερη αλήθεια δίπλα στο `categories` (ADR-749)** — απαντά **άλλο**
 * ερώτημα. Το `categories.properties.demandListingMatch` απαντά *«θέλω να μαθαίνω για
 * ταιριάσματα;»* (κουδούνι **και** email)· το `emailCategories.properties.demandListingMatch`
 * απαντά *«…και με email;»*. Μπορεί μόνο να **στενέψει**: κανένας συνδυασμός δεν στέλνει email
 * για τύπο που ο άνθρωπος έκλεισε ολόκληρο. Και τα δύο τα διαβάζει **μία** συνάρτηση
 * (`notification-preference-policy.ts`).
 *
 * ⚠️ **Απουσία = `'on'`**, άρα κανένα υπάρχον έγγραφο δεν χρειάζεται migration. Τα κλειδιά
 * δένονται από τον μεταγλωττιστή στα **ίδια** κλειδιά των διακοπτών της κατηγορίας.
 */
export type EmailCategorySettings = {
  [C in NotificationCategory]: Partial<Record<keyof NotificationCategorySettingsMap[C], EmailTypeMode>>;
};

/** Κανένας τύπος σιγασμένος — νέο αντικείμενο κάθε φορά (οι ρυθμίσεις είναι μεταβλητές). */
export function emptyEmailCategories(): EmailCategorySettings {
  return { crm: {}, properties: {}, tasks: {}, security: {}, procurement: {} };
}
