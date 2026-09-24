/**
 * =============================================================================
 * Η ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΠΡΟΣΚΛΗΣΗΣ — αποθηκευμένη και ΠΑΡΑΓΩΓΗ, σε ένα σημείο (ADR-876 §5)
 * =============================================================================
 *
 * 🔑 **Η λήξη δεν αποθηκεύεται** (βλ. `InviteStatus`): είναι «ζωντανή πρόσκληση της οποίας
 * ο νεότερος σύνδεσμος πέρασε το `expiresAt`». Την ίδια ερώτηση κάνουν το badge, ο δείκτης
 * «χρειάζεται προσοχή» και ο αναλυτής της πύλης — γι' αυτό ζει εδώ και όχι τρεις φορές.
 *
 * ⚠️ «Ζωντανή» (`pending|sent|opened`) ήταν γραμμένη με το χέρι σε τρία σημεία
 * (`VendorInviteSection` ×2 · `resendVendorInvite`)· τώρα είναι το {@link LIVE_INVITE_STATUSES}.
 *
 * @module subapps/procurement/utils/vendor-invite-status
 */

import { normalizeToDate } from '@/lib/date-local';

import type { InviteStatus } from '../types/vendor-invite';

/**
 * **Το παράθυρο επεξεργασίας** μετά την ΠΡΩΤΗ υποβολή (ADR-327 Q8). Ήταν γραμμένο `72` σε
 * **τρία** αρχεία (route · `vendor-invite-service` · `vendor-portal-submit-service`), με τρία
 * χωριστά `Date.now()` για την ΙΔΙΑ υποβολή (ADR-876 §5 Σ17).
 */
export const VENDOR_QUOTE_EDIT_WINDOW_HOURS = 72;

/** Η ΜΙΑ στιγμή λήξης μιας υποβολής — υπολογίζεται μία φορά και μοιράζεται σε προσφορά + πρόσκληση. */
export function vendorQuoteEditWindowEnd(nowMs: number): Date {
  return new Date(nowMs + VENDOR_QUOTE_EDIT_WINDOW_HOURS * 60 * 60 * 1000);
}

/** Οι καταστάσεις όπου ο προμηθευτής **μπορεί ακόμη** να απαντήσει. */
export const LIVE_INVITE_STATUSES = ['pending', 'sent', 'opened'] as const satisfies readonly InviteStatus[];

export type LiveInviteStatus = (typeof LIVE_INVITE_STATUSES)[number];

/** Ό,τι δείχνει η οθόνη: η αποθηκευμένη κατάσταση **ή** η παράγωγη λήξη. */
export type VendorInviteDisplayStatus = InviteStatus | 'expired';

/**
 * Η αποθηκευμένη κατάσταση, **κανονικοποιημένη**. Έγγραφο προ-migration με `'expired'` =
 * ανάκληση (ήταν ο μόνος γραφέας του)· οτιδήποτε άγνωστο ⇒ `revoked` (κλειστό εξ ορισμού —
 * μια πύλη που «δεν ξέρει» δεν ανοίγει).
 */
export function normalizeInviteStatus(raw: string): InviteStatus {
  switch (raw) {
    case 'pending':
    case 'sent':
    case 'opened':
    case 'submitted':
    case 'declined':
    case 'revoked':
      return raw;
    default:
      return 'revoked';
  }
}

export function isLiveInviteStatus(status: InviteStatus): status is LiveInviteStatus {
  return (LIVE_INVITE_STATUSES as readonly InviteStatus[]).includes(status);
}

/**
 * Η κατάσταση που βλέπει ο άνθρωπος — ζωντανή πρόσκληση με περασμένο `expiresAt` = «έληξε».
 *
 * ⚠️ Το `expiresAt` φτάνει ως `Timestamp` (Admin/client SDK) **ή** ως κάτι που το query service
 * έχει ήδη μετατρέψει — γι' αυτό περνά από το SSoT `normalizeToDate` και όχι από `.toMillis()`.
 * Άγνωστη λήξη ⇒ **δεν** δηλώνεται «έληξε» (η αυθεντία είναι ο server, όχι το badge).
 */
export function vendorInviteDisplayStatus(
  invite: { readonly status: string; readonly expiresAt: unknown },
  nowMs: number,
): VendorInviteDisplayStatus {
  const status = normalizeInviteStatus(invite.status);
  const expiresAt = normalizeToDate(invite.expiresAt);
  if (isLiveInviteStatus(status) && expiresAt && expiresAt.getTime() <= nowMs) return 'expired';
  return status;
}
