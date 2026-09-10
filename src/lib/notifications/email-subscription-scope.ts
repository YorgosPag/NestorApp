/**
 * =============================================================================
 * Η ΕΜΒΕΛΕΙΑ ΤΗΣ ΣΥΝΔΡΟΜΗΣ — «ποια email αφορά αυτός ο σύνδεσμος;» (ADR-849 Α2)
 * =============================================================================
 *
 * **Καθαρές συναρτήσεις, για διακομιστή ΚΑΙ πελάτη.** Η εμβέλεια ταξιδεύει **μέσα στην
 * υπογραφή** του token διαγραφής: ένα μεμονωμένο email ταιριάσματος φέρει εμβέλεια
 * `properties.demandListingMatch`, και το «Κατάργηση εγγραφής» του Gmail κόβει **μόνο** αυτά.
 *
 * 🏆 **Google FAQ (support.google.com/a/answer/14229414)**: το one-click *«removes the
 * recipient only from the mailing list associated with the message»*. Η «λίστα» εδώ είναι ο
 * **τύπος** του email — ό,τι κάνουν Zillow («this type of email, only») και LinkedIn.
 *
 * ⚠️ **Οι υποχρεωτικοί τύποι δεν μπαίνουν ΠΟΤΕ σε εμβέλεια**: ένας σύνδεσμος «σταμάτα αυτά»
 * για email ασφαλείας θα υποσχόταν κάτι που καμία ρύθμιση δεν κάνει.
 *
 * @module lib/notifications/email-subscription-scope
 * @see ADR-849
 */

import { EVENT_CATEGORY_MAP, isNotificationEventType } from '@/config/notification-events';
import {
  isMandatorySetting,
  parseSettingPath,
  settingPathOf,
  type NotificationSettingRef,
} from '@/services/user-notification-settings/notification-preference-policy';

/** Ποια email αφορά ο σύνδεσμος: **όλα**, ή συγκεκριμένοι τύποι. */
export type EmailSubscriptionScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'types'; readonly settings: readonly NotificationSettingRef[] };

/** Όλα τα email — η εμβέλεια κάθε token πριν το ADR-849 και κάθε σύνοψης. */
export const ALL_EMAILS: EmailSubscriptionScope = { kind: 'all' };

const ALL_FIELD = 'all';
/** ⚠️ Ποτέ `:` — το `encodeSignedToken` το χρησιμοποιεί ως διαχωριστή πεδίων. */
const SEPARATOR = ',';

/** Διαδρομές → διακόπτες, χωρίς διπλότυπα· `null` αν **έστω μία** δεν υπάρχει. */
function refsFrom(raw: unknown): NotificationSettingRef[] | null {
  if (!Array.isArray(raw)) return null;
  const refs: NotificationSettingRef[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const ref = parseSettingPath(value);
    if (ref === null) return null;
    const path = settingPathOf(ref);
    if (!seen.has(path)) {
      seen.add(path);
      refs.push(ref);
    }
  }
  return refs;
}

/** **Γνωστές** διαδρομές (υποχρεωτικές επιτρέπονται) — για ό,τι **διαβάζεται** από τη βάση. */
export function parseSettingPaths(raw: unknown): string[] | null {
  const refs = refsFrom(raw);
  return refs === null ? null : refs.map(settingPathOf);
}

/**
 * Διακόπτες που **επιτρέπεται να αλλάξουν** — μη κενό, όλοι γνωστοί, **κανένας
 * υποχρεωτικός**. Για ό,τι **γράφεται** (αίτημα σελίδας, εμβέλεια token).
 */
export function parseMutableSettingRefs(raw: unknown): NotificationSettingRef[] | null {
  const refs = refsFrom(raw);
  if (refs === null || refs.length === 0 || refs.some(isMandatorySetting)) return null;
  return refs;
}

/** Ίδιο με {@link parseMutableSettingRefs}, σε διαδρομές. */
export function parseMutableSettingPaths(raw: unknown): string[] | null {
  const refs = parseMutableSettingRefs(raw);
  return refs === null ? null : refs.map(settingPathOf);
}

/** Εμβέλεια → πεδίο του token: `'all'` ή `'properties.demandListingMatch,tasks.overdue'`. */
export function scopeField(scope: EmailSubscriptionScope): string {
  return scope.kind === 'all' ? ALL_FIELD : scope.settings.map(settingPathOf).join(SEPARATOR);
}

/** Πεδίο του token → εμβέλεια, ή `null` (άγνωστος/υποχρεωτικός τύπος ⇒ άκυρο token). */
export function parseScopeField(field: string): EmailSubscriptionScope | null {
  if (field === ALL_FIELD) return ALL_EMAILS;
  const settings = parseMutableSettingRefs(field.split(SEPARATOR));
  return settings === null ? null : { kind: 'types', settings };
}

/** Οι διαδρομές μιας εμβέλειας — κενό για «όλα». */
export function scopeSettingPaths(scope: EmailSubscriptionScope): string[] {
  return scope.kind === 'all' ? [] : scope.settings.map(settingPathOf);
}

/**
 * **Η εμβέλεια ενός email από τους τύπους που κουβαλά.**
 *
 * Γνωστοί, **μη υποχρεωτικοί**, μοναδικοί, με τη σειρά εμφάνισης. Κανένας (παλιό έγγραφο
 * της ουράς χωρίς `eventType`, ή μόνο υποχρεωτικοί) ⇒ `all` — ποτέ μαντεψιά.
 */
export function emailScopeOf(eventTypes: readonly (string | undefined)[]): EmailSubscriptionScope {
  const found = new Map<string, NotificationSettingRef>();
  for (const eventType of eventTypes) {
    if (!isNotificationEventType(eventType)) continue;
    const mapping = EVENT_CATEGORY_MAP[eventType];
    if (mapping.isMandatory) continue;
    const ref: NotificationSettingRef = { category: mapping.category, settingKey: mapping.settingKey };
    found.set(settingPathOf(ref), ref);
  }
  return found.size === 0 ? ALL_EMAILS : { kind: 'types', settings: [...found.values()] };
}
