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
 * Η αποθηκευμένη κατάσταση, **κανονικοποιημένη**. Οτιδήποτε άγνωστο ⇒ `revoked` (κλειστό εξ
 * ορισμού — μια πύλη που «δεν ξέρει» δεν ανοίγει). Και το `'expired'`: είναι **μόνο** παράγωγη
 * τιμή οθόνης ({@link vendorInviteDisplayStatus}), ποτέ αποθηκευμένη — αν βρεθεί στη βάση, είναι άγνωστη.
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

/** Η πρόσκληση όπως τη χρειάζονται τα κατηγορήματα εστίασης — μόνο ό,τι διαβάζουν. */
type InviteForFocus = { readonly status: string; readonly expiresAt: unknown };

/**
 * **«Χρειάζεται προσοχή»** (ADR-330 §5.1 S3.3): ζωντανή πρόσκληση που **δεν** μπορεί πια να απαντηθεί
 * εγκαίρως — έληξε ο σύνδεσμος, ή πέρασε η προθεσμία του RFQ χωρίς απάντηση.
 *
 * ⚠️ Ήταν γραμμένο **δύο** φορές με **διαφορετικό** ορισμό: η κάρτα ρωτούσε το παράγωγο `expired`, το badge
 * της καρτέλας ρωτούσε `status === 'expired'` — τιμή που **δεν αποθηκεύεται ποτέ** ⇒ το badge δεν θα άναβε.
 * Και οι δύο μετρούσαν «πέρασε η προθεσμία» μόνο για `pending`, όχι για `sent`/`opened` (εξίσου αναπάντητες).
 */
export function inviteNeedsAttention(invite: InviteForFocus, deadlineMs: number | null, nowMs: number): boolean {
  const display = vendorInviteDisplayStatus(invite, nowMs);
  if (display === 'expired') return true;
  return isLiveInviteStatus(display) && deadlineMs !== null && nowMs > deadlineMs;
}

/** **«Αναμένουν απάντηση»**: ζωντανή πρόσκληση που μπορεί ακόμη να απαντηθεί εγκαίρως. */
export function inviteAwaitingResponse(invite: InviteForFocus, deadlineMs: number | null, nowMs: number): boolean {
  return isLiveInviteStatus(normalizeInviteStatus(invite.status)) && !inviteNeedsAttention(invite, deadlineMs, nowMs);
}

/**
 * **Το λεξιλόγιο εστίασης της λίστας προσκλήσεων** (ADR-330 §5.1 S3.3) — ένα κατηγόρημα ανά τιμή, που
 * διαβάζουν **και** η κάρτα (μέτρηση) **και** η λίστα (φίλτρο) ⇒ η λίστα δείχνει ΑΚΡΙΒΩΣ ό,τι μέτρησε η κάρτα.
 * Τα κλειδιά είναι και το λεξιλόγιο του `?status=` (`useStatusDrillParam`).
 */
export const INVITE_FOCUS_PREDICATES = {
  awaiting: inviteAwaitingResponse,
  attention: inviteNeedsAttention,
} as const satisfies Record<string, (invite: InviteForFocus, deadlineMs: number | null, nowMs: number) => boolean>;

export type InviteFocus = keyof typeof INVITE_FOCUS_PREDICATES;

/** Η πρόσκληση περνά το φίλτρο εστίασης; Κενό φίλτρο ⇒ όλες. */
export function inviteMatchesFocus(
  invite: InviteForFocus,
  focus: readonly InviteFocus[],
  deadlineMs: number | null,
  nowMs: number,
): boolean {
  return focus.length === 0 || focus.some((f) => INVITE_FOCUS_PREDICATES[f](invite, deadlineMs, nowMs));
}

/** Απάντησε ο προμηθευτής (υπέβαλε **ή** αρνήθηκε) — ο αριθμητής του χωνιού «Προσκλήθηκαν → Απάντησαν». */
export function inviteResponded(invite: { readonly status: string }): boolean {
  const status = normalizeInviteStatus(invite.status);
  return status === 'submitted' || status === 'declined';
}
