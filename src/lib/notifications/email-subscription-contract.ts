/**
 * @fileoverview **Το συμβόλαιο της συνδρομής στα email** — τύποι + κριτές, για διακομιστή ΚΑΙ πελάτη.
 * @module lib/notifications/email-subscription-contract
 * @see ADR-848
 *
 * 🔑 **Γιατί ξεχωριστό αρχείο**: τρεις καταναλωτές ρωτούν τα ίδια — ο συγγραφέας
 * (διακομιστής), το endpoint (σύνορο HTTP) και η σελίδα προτιμήσεων (πελάτης). Ο
 * συγγραφέας είναι `server-only`· αν οι κριτές ζούσαν εκεί, η σελίδα θα έγραφε
 * **δεύτερο** «είναι αυτό έγκυρη κατάσταση;» — και τα δύο θα αποκλίναν την πρώτη φορά
 * που προστίθεται συχνότητα. Εδώ δεν υπάρχει καμία εξάρτηση πέρα από τύπους.
 */

import {
  isEmailFrequency,
  type EmailFrequency,
} from '@/services/user-notification-settings/user-notification-settings.types';

/** Το κομμάτι των ρυθμίσεων που αφορά τα email — ό,τι βλέπει και αλλάζει η σελίδα. */
export interface EmailSubscriptionState {
  readonly emailEnabled: boolean;
  readonly emailFrequency: EmailFrequency;
}

/** Οι τρεις αλλαγές — κλειστό σύνολο, όλες αναστρέψιμες. */
export type EmailSubscriptionChange =
  | { readonly kind: 'unsubscribe' }
  | { readonly kind: 'daily' }
  | { readonly kind: 'restore'; readonly state: EmailSubscriptionState };

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
export function emailsAreOn(state: EmailSubscriptionState): boolean {
  return state.emailEnabled && state.emailFrequency !== 'disabled';
}

/** Κατάσταση από δεδομένα που δεν ελέγξαμε — ή `null`. */
export function parseSubscriptionState(raw: unknown): EmailSubscriptionState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const emailEnabled: unknown = Reflect.get(raw, 'emailEnabled');
  const emailFrequency: unknown = Reflect.get(raw, 'emailFrequency');
  if (typeof emailEnabled !== 'boolean' || !isEmailFrequency(emailFrequency)) return null;
  return { emailEnabled, emailFrequency };
}

/**
 * **Το αίτημα → μια από τις τρεις αλλαγές**, ή `null`.
 *
 * ⚠️ Κλειστό σύνολο ελεγμένο **πριν** αγγίξουμε τη βάση: ένα αντικείμενο περασμένο
 * αυτούσιο θα έγραφε στις ρυθμίσεις ό,τι έστειλε ο αιτών.
 */
export function parseEmailSubscriptionChange(raw: unknown): EmailSubscriptionChange | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const kind: unknown = Reflect.get(raw, 'kind');
  if (kind === 'unsubscribe' || kind === 'daily') return { kind };
  if (kind !== 'restore') return null;

  const state = parseSubscriptionState(Reflect.get(raw, 'state'));
  return state === null ? null : { kind: 'restore', state };
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
