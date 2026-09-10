/**
 * @fileoverview **Το συμβόλαιο της συνδρομής στα email** — τύποι + κριτές, για διακομιστή ΚΑΙ πελάτη.
 * @module lib/notifications/email-subscription-contract
 * @see ADR-848 · ADR-849 (email ανά τύπο)
 *
 * 🔑 **Γιατί ξεχωριστό αρχείο**: τρεις καταναλωτές ρωτούν τα ίδια — ο συγγραφέας
 * (διακομιστής), το endpoint (σύνορο HTTP) και η σελίδα προτιμήσεων (πελάτης). Ο
 * συγγραφέας είναι `server-only`· αν οι κριτές ζούσαν εκεί, η σελίδα θα έγραφε
 * **δεύτερο** «είναι αυτό έγκυρη κατάσταση;» — και τα δύο θα αποκλίναν την πρώτη φορά
 * που προστίθεται συχνότητα.
 */

import {
  parseMutableSettingPaths,
  parseSettingPaths,
} from '@/lib/notifications/email-subscription-scope';
import {
  isEmailTypeMode,
  type EmailTypeMode,
} from '@/services/user-notification-settings/user-notification-settings.email-types';
import {
  isEmailFrequency,
  type EmailFrequency,
} from '@/services/user-notification-settings/user-notification-settings.types';

/** Τα **καθολικά** email — αυτό που επαναφέρει η «Αναίρεση» μιας καθολικής αλλαγής. */
export interface EmailGlobalState {
  readonly emailEnabled: boolean;
  readonly emailFrequency: EmailFrequency;
}

/**
 * Ό,τι βλέπει και αλλάζει η σελίδα. ADR-849: + οι τύποι που **δεν** φτάνουν με email
 * (ταξινομημένες διαδρομές `κατηγορία.κλειδί`) — από εκεί η αναίρεση ενός τύπου ξέρει τι ήταν.
 */
export interface EmailSubscriptionState extends EmailGlobalState {
  readonly mutedTypes: readonly string[];
}

/**
 * Οι αλλαγές — κλειστό σύνολο, όλες αναστρέψιμες.
 *
 * ⚠️ **Η `restore` αγγίζει ΜΟΝΟ τα καθολικά**, και η αναίρεση ενός τύπου είναι η `type` με
 * την προηγούμενη κατάσταση: «Αναίρεση» = **μόνο ό,τι άλλαξε η πράξη**. Μια αναίρεση που
 * ξανάγραφε ολόκληρη τη λίστα τύπων θα έσβηνε ό,τι άλλαξε στο μεταξύ η οθόνη ρυθμίσεων.
 */
export type EmailSubscriptionChange =
  | { readonly kind: 'unsubscribe' }
  | { readonly kind: 'daily' }
  | { readonly kind: 'restore'; readonly state: EmailGlobalState }
  | { readonly kind: 'type'; readonly settings: readonly string[]; readonly mode: EmailTypeMode };

/** Κωδικός αποτυχίας — γίνεται **κλειδί i18n** στη σελίδα (N.11), ποτέ ωμό κείμενο. */
export type SubscriptionFailure =
  | 'link-invalid'
  | 'request-invalid'
  | 'service-unavailable'
  | 'write-failed';

/** Η απάντηση του endpoint. Το `previous` είναι το εισιτήριο της «Αναίρεσης». */
export type SubscriptionResponse =
  | {
      readonly ok: true;
      readonly previous: EmailSubscriptionState;
      readonly current: EmailSubscriptionState;
    }
  | { readonly ok: false; readonly reason: SubscriptionFailure };

// 🔗 ADR-849 — ο κριτής συχνότητας (`isEmailFrequency`) μετακόμισε στον τύπο των ρυθμίσεων:
// τον ζητά πλέον και η συγχώνευση με τις προεπιλογές. Ο πίνακας εδώ ήταν το μόνο αντίγραφο.

const FAILURES: Readonly<Record<SubscriptionFailure, true>> = {
  'link-invalid': true,
  'request-invalid': true,
  'service-unavailable': true,
  'write-failed': true,
};

function hasKey<K extends string>(table: Readonly<Record<K, true>>, value: unknown): value is K {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value);
}

/** **Φτάνουν τα email στον άνθρωπο;** Το `disabled` είναι «όχι», όποιο κι αν είναι το `emailEnabled`. */
export function emailsAreOn(state: EmailGlobalState): boolean {
  return state.emailEnabled && state.emailFrequency !== 'disabled';
}

/** Καθολική κατάσταση από δεδομένα που δεν ελέγξαμε — ή `null`. Ό,τι επιπλέον **πετιέται**. */
export function parseGlobalState(raw: unknown): EmailGlobalState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const emailEnabled: unknown = Reflect.get(raw, 'emailEnabled');
  const emailFrequency: unknown = Reflect.get(raw, 'emailFrequency');
  if (typeof emailEnabled !== 'boolean' || !isEmailFrequency(emailFrequency)) return null;
  return { emailEnabled, emailFrequency };
}

/** Πλήρης κατάσταση (με τους σιγασμένους τύπους) — ή `null`. */
export function parseSubscriptionState(raw: unknown): EmailSubscriptionState | null {
  const global = parseGlobalState(raw);
  if (global === null || typeof raw !== 'object' || raw === null) return null;
  const mutedTypes = parseSettingPaths(Reflect.get(raw, 'mutedTypes'));
  return mutedTypes === null ? null : { ...global, mutedTypes };
}

/**
 * **Το αίτημα → μια από τις αλλαγές**, ή `null`.
 *
 * ⚠️ Κλειστό σύνολο ελεγμένο **πριν** αγγίξουμε τη βάση: ένα αντικείμενο περασμένο
 * αυτούσιο θα έγραφε στις ρυθμίσεις ό,τι έστειλε ο αιτών. ADR-849: οι τύποι μιας `type`
 * πρέπει να **υπάρχουν** και να **μην είναι υποχρεωτικοί**.
 */
export function parseEmailSubscriptionChange(raw: unknown): EmailSubscriptionChange | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const kind: unknown = Reflect.get(raw, 'kind');
  if (kind === 'unsubscribe' || kind === 'daily') return { kind };

  if (kind === 'restore') {
    const state = parseGlobalState(Reflect.get(raw, 'state'));
    return state === null ? null : { kind: 'restore', state };
  }

  if (kind === 'type') {
    const settings = parseMutableSettingPaths(Reflect.get(raw, 'settings'));
    const mode: unknown = Reflect.get(raw, 'mode');
    return settings !== null && isEmailTypeMode(mode) ? { kind: 'type', settings, mode } : null;
  }
  return null;
}

/**
 * Η απάντηση του endpoint, όπως τη διαβάζει ο πελάτης.
 *
 * ⚠️ Ό,τι δεν αναγνωρίζεται (σελίδα σφάλματος proxy, κομμένο JSON) γίνεται
 * `write-failed` — ποτέ «πέτυχε» επειδή το σώμα έτυχε να έχει `ok`.
 */
export function parseSubscriptionResponse(raw: unknown): SubscriptionResponse {
  const unknownFailure: SubscriptionResponse = { ok: false, reason: 'write-failed' };
  if (typeof raw !== 'object' || raw === null) return unknownFailure;

  if (Reflect.get(raw, 'ok') === true) {
    const previous = parseSubscriptionState(Reflect.get(raw, 'previous'));
    const current = parseSubscriptionState(Reflect.get(raw, 'current'));
    return previous && current ? { ok: true, previous, current } : unknownFailure;
  }

  const reason: unknown = Reflect.get(raw, 'reason');
  return hasKey(FAILURES, reason) ? { ok: false, reason } : unknownFailure;
}
