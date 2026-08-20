/**
 * =============================================================================
 * 🔐 ΧΑΡΤΟΓΡΑΦΗΣΗ ΣΦΑΛΜΑΤΩΝ ΓΙΑ ΤΟΥΣ ΚΩΔΙΚΟΥΣ ΕΝΕΡΓΕΙΑΣ EMAIL
 * =============================================================================
 *
 * Μεταφράζει κωδικό σφάλματος του Firebase Auth σε **i18n κλειδί** — ποτέ σε
 * κυριολεκτικό κείμενο (N.11).
 *
 * 🔶 **ΔΗΛΩΜΕΝΗ ΕΠΙΚΑΛΥΨΗ, ΟΧΙ ΣΙΩΠΗΛΗ** (ADR-785 §Boy Scout). Στο δέντρο
 * υπάρχει **δεύτερη** χαρτογράφηση, το `getAuthErrorMessage()` στο
 * `src/auth/contexts/auth-context/auth-context-errors.ts`. **ΔΕΝ ενώθηκαν, και
 * ο λόγος είναι μετρημένος**, όχι αμέλεια:
 *
 *   · εκείνη επιστρέφει **σκληρά ελληνικά** (17 κωδικοί) — άρα στα αγγλικά
 *     απαντά ελληνικά· αυτή επιστρέφει **κλειδιά**·
 *   · εκείνη **δεν έχει καθόλου** τους κωδικούς κωδικού-ενέργειας
 *     (`invalid-action-code` · `expired-action-code`) που είναι όλο το νόημα εδώ·
 *   · επικαλύπτονται σε **τρεις** κωδικούς (`user-not-found` · `weak-password` ·
 *     `network-request-failed`).
 *
 * Η **σωστή** ενοποίηση είναι να μεταναστεύσει εκείνη σε i18n κλειδιά και να
 * μείνει **μία** — αλλά αυτό αγγίζει το auth context ολόκληρης της εφαρμογής και
 * είναι **δική του** δουλειά. Το να αντιγραφούν εδώ τα 17 σκληρά ελληνικά θα
 * έφτιαχνε **τρίτη** αλήθεια, ακριβώς το σχήμα που απορρίπτει το ADR-749.
 * =============================================================================
 */

/** Το ελάχιστο υποσύνολο του `t` που χρειάζεται αυτή η χαρτογράφηση. */
export type ActionErrorTranslator = (key: string) => string;

const ACTION_ERROR_KEYS: Readonly<Record<string, string>> = Object.freeze({
  'auth/invalid-action-code': 'action.errors.invalidCode',
  'auth/expired-action-code': 'action.errors.expiredCode',
  'auth/user-not-found': 'action.errors.userNotFound',
  'auth/weak-password': 'action.errors.weakPassword',
  'auth/network-request-failed': 'action.errors.networkError',
});

const GENERIC_ERROR_KEY = 'action.errors.generic';

/**
 * @param error το σφάλμα όπως το πέταξε το Firebase SDK
 * @param t μεταφραστής δεσμευμένος στο namespace `auth`
 * @returns μεταφρασμένο μήνυμα — ποτέ ωμό κλειδί, ποτέ κενό
 */
export function mapFirebaseError(error: unknown, t: ActionErrorTranslator): string {
  if (!(error instanceof Error)) return t(GENERIC_ERROR_KEY);
  const code = (error as { code?: string }).code;
  const key = code ? ACTION_ERROR_KEYS[code] : undefined;
  return t(key ?? GENERIC_ERROR_KEY);
}

export { ACTION_ERROR_KEYS, GENERIC_ERROR_KEY };
