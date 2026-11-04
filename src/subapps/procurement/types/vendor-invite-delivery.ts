/**
 * =============================================================================
 * ΤΟ ΚΑΘΟΛΙΚΟ ΤΗΣ ΠΑΡΑΔΟΣΗΣ ΜΙΑΣ ΠΡΟΣΚΛΗΣΗΣ — outbox πάνω στο ίδιο το έγγραφο (ADR-923 §5.13 Τ5)
 * =============================================================================
 *
 * Η πρόσκληση που γεννά το `createRfq` γράφεται **στην ίδια συναλλαγή** με `delivery.state = 'pending'`: η πρόθεση
 * «αυτό οφείλει να σταλεί» είναι ατομική με το RFQ (transactional outbox, χωρίς δεύτερη συλλογή). Η αποστολή γίνεται
 * μετά την απάντηση (`after()`) και ό,τι αποτύχει το ξαναπιάνει το cron `rfq-invite-delivery`.
 *
 * 🔑 **Το πολύ μία φορά** (at-most-once) για κάθε πρόσκληση: η αποστολή ξεκινά μόνο αφού κερδίσει ο καλών μια
 *    συναλλαγή `pending → sending`. Αν η διεργασία πεθάνει ανάμεσα στον πάροχο και στην καταγραφή, η κατάσταση γίνεται
 *    `unknown` και **δεν** ξαναστέλνεται: δεύτερο email στον προμηθευτή είναι χειρότερο από ένα που χρειάζεται «Επαναποστολή».
 *    Επανάληψη γίνεται μόνο όταν ο πάροχος **αρνήθηκε ρητά** (κανένα μήνυμα δεν έφυγε).
 * 🔒 Κανένα μυστικό εδώ: ο σύνδεσμος δεν αποθηκεύεται (ADR-876 §5). Η επανάληψη εκδίδει **νέο** διαπιστευτήριο.
 *
 * @module subapps/procurement/types/vendor-invite-delivery
 */

export const INVITE_DELIVERY_STATES = ['pending', 'sending', 'delivered', 'failed', 'undeliverable', 'unknown'] as const;
export type InviteDeliveryState = (typeof INVITE_DELIVERY_STATES)[number];

/** Γιατί δεν θα σταλεί ποτέ — ονομασμένος λόγος, όχι σιωπή. */
export const INVITE_UNDELIVERABLE_REASONS = ['no_recipient', 'rfq_closed', 'invite_closed', 'recipient_quota'] as const;
export type InviteUndeliverableReason = (typeof INVITE_UNDELIVERABLE_REASONS)[number];

/**
 * Γιατί απέτυχε μια απόπειρα — **κωδικός**, ποτέ το κείμενο του παρόχου: το έγγραφο το διαβάζει κάθε μέλος του αγοραστή, και
 * το κείμενο ενός SMTP/API σφάλματος συχνά περιέχει τη διεύθυνση του παραλήπτη (ιδιωτική για χώρο της πλατφόρμας).
 */
export const INVITE_DELIVERY_ERROR_CODES = ['provider_rejected', 'provider_timeout', 'delivery_error', 'lease_expired'] as const;
export type InviteDeliveryErrorCode = (typeof INVITE_DELIVERY_ERROR_CODES)[number];

/** Ποιος παρέλαβε: επαφή του αγοραστή ή ο χώρος ενός προμηθευτή της πλατφόρμας (μέσω του `quoteIntake` του). */
export type InviteRecipientKind = 'contact' | 'platform';

export interface VendorInviteDelivery {
  readonly state: InviteDeliveryState;
  readonly attempts: number;
  /**
   * ISO. `pending` ⇒ πότε επιτρέπεται η επόμενη απόπειρα · `sending` ⇒ πότε λήγει η κράτηση. Ένα πεδίο για τα δύο, ώστε η
   * σάρωση να είναι **ένα** ερώτημα με **έναν** δείκτη. Κλειστή κατάσταση ⇒ `null`.
   */
  readonly dueAt: string | null;
  readonly lastError: InviteDeliveryErrorCode | null;
  readonly reason: InviteUndeliverableReason | null;
  readonly recipientKind: InviteRecipientKind | null;
  readonly settledAt: string | null;
  /**
   * Λ1β Μ3 — η μονάδα του ορίου γραμματοκιβωτίου του προμηθευτή **καταναλώθηκε** για αυτή την πρόσκληση. Γράφεται στην
   * καταγραφή κάθε απόπειρας· μια επόμενη απόπειρα δεν ξαναμετρά, αλλά και δεν στέλνει **ποτέ** αμέτρητη.
   */
  readonly supplierQuotaCounted?: boolean;
  /**
   * Λ1β Χ6 — το διαπιστευτήριο της απόπειρας που **απέτυχε ρητά** (κανένα email δεν το μετέφερε). Η επόμενη απόπειρα, που
   * εκδίδει νέο σύνδεσμο, το ανακαλεί. Κανένα μυστικό: μόνο id.
   */
  readonly unsentCredentialId?: string | null;
}

/** Οι καταστάσεις που η σάρωση ξανακοιτά. */
export const OPEN_INVITE_DELIVERY_STATES: readonly InviteDeliveryState[] = ['pending', 'sending'];

export const INVITE_DELIVERY_POLICY = {
  /** Απόπειρες συνολικά — η πρώτη στο `after()`, οι υπόλοιπες στο cron. */
  maxAttempts: 5,
  /** Πόσο κρατά μια απόπειρα την πρόσκληση. Πολύ πάνω από το όριο χρόνου της αλυσίδας παρόχων. */
  leaseMs: 10 * 60 * 1000,
  /** Αναμονή πριν από την απόπειρα `n + 1` (εκθετική, με ταβάνι). */
  backoffMs: [60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000] as readonly number[],
  /** Προσκλήσεις ανά εκτέλεση της σάρωσης. */
  sweepLimit: 50,
} as const;

const iso = (ms: number): string => new Date(ms).toISOString();

/** Η αρχική εγγραφή, μέσα στη συναλλαγή του `createRfq`: «οφείλεται, τώρα». */
export function pendingInviteDelivery(nowMs: number): VendorInviteDelivery {
  return { state: 'pending', attempts: 0, dueAt: iso(nowMs), lastError: null, reason: null, recipientKind: null, settledAt: null };
}

/** Μπορεί αυτή η απόπειρα να κρατήσει την πρόσκληση; Μόνο `pending` που ωρίμασε. */
export function isInviteDeliveryClaimable(delivery: VendorInviteDelivery | undefined, nowMs: number): boolean {
  if (delivery?.state !== 'pending') return false;
  return delivery.dueAt === null || Date.parse(delivery.dueAt) <= nowMs;
}

export function claimedInviteDelivery(delivery: VendorInviteDelivery, nowMs: number): VendorInviteDelivery {
  return { ...delivery, state: 'sending', attempts: delivery.attempts + 1, dueAt: iso(nowMs + INVITE_DELIVERY_POLICY.leaseMs) };
}

export function deliveredInviteDelivery(claimed: VendorInviteDelivery, kind: InviteRecipientKind, nowMs: number): VendorInviteDelivery {
  return { ...claimed, state: 'delivered', dueAt: null, lastError: null, recipientKind: kind, settledAt: iso(nowMs) };
}

export function undeliverableInviteDelivery(claimed: VendorInviteDelivery, reason: InviteUndeliverableReason, nowMs: number): VendorInviteDelivery {
  return { ...claimed, state: 'undeliverable', dueAt: null, reason, settledAt: iso(nowMs) };
}

/** Ο πάροχος αρνήθηκε ρητά: νέα απόπειρα αργότερα, ή οριστική αποτυχία όταν τελειώσουν οι απόπειρες. */
export function rejectedInviteDelivery(claimed: VendorInviteDelivery, error: InviteDeliveryErrorCode, nowMs: number): VendorInviteDelivery {
  const { maxAttempts, backoffMs } = INVITE_DELIVERY_POLICY;
  if (claimed.attempts >= maxAttempts) return { ...claimed, state: 'failed', dueAt: null, lastError: error, settledAt: iso(nowMs) };
  const wait = backoffMs[Math.min(claimed.attempts - 1, backoffMs.length - 1)];
  return { ...claimed, state: 'pending', dueAt: iso(nowMs + wait), lastError: error };
}

/**
 * Λ1β Μ1 — ο πάροχος **δεν απάντησε** (λήξη χρόνου): μπορεί να το δέχτηκε. Όπως η ληγμένη κράτηση: `unknown`, **χωρίς** νέα
 * απόπειρα — διπλό email σε τρίτον είναι χειρότερο από ένα που αποφασίζει άνθρωπος να ξαναστείλει.
 */
export function uncertainInviteDelivery(claimed: VendorInviteDelivery, nowMs: number): VendorInviteDelivery {
  return { ...claimed, state: 'unknown', dueAt: null, lastError: 'provider_timeout', settledAt: iso(nowMs) };
}

/** Η κράτηση έληξε χωρίς καταγραφή: δεν ξέρουμε αν έφυγε, άρα **δεν** ξαναστέλνουμε (το πολύ μία φορά). */
export function unknownInviteDelivery(claimed: VendorInviteDelivery, nowMs: number): VendorInviteDelivery {
  return { ...claimed, state: 'unknown', dueAt: null, lastError: 'lease_expired', settledAt: iso(nowMs) };
}

/**
 * Το γραφείο ξανάστειλε με επιτυχία («Επαναποστολή») μια πρόσκληση που είχε μείνει `failed`/`unknown`/`undeliverable`: το
 * καθολικό λέει πλέον την αλήθεια. `null` ⇒ τίποτα να αλλάξει (ήδη `delivered`, ή ανοιχτή — που η επαναποστολή αρνείται).
 */
export function redeliveredInviteDelivery(
  delivery: VendorInviteDelivery | undefined, kind: InviteRecipientKind, nowMs: number,
): VendorInviteDelivery | null {
  if (delivery === undefined || delivery.state === 'delivered' || OPEN_INVITE_DELIVERY_STATES.includes(delivery.state)) return null;
  return { ...delivery, state: 'delivered', dueAt: null, lastError: null, reason: null, recipientKind: kind, settledAt: iso(nowMs) };
}

/**
 * Τι βλέπει ο αγοραστής: τέσσερις καταστάσεις, όχι έξι. `uncertain` (= `unknown`) **δεν** είναι αποτυχία (Λ1β Χ3): ίσως έφτασε,
 * και ένα «απέτυχε» θα έσπρωχνε σε δεύτερο email. `null` ⇒ πρόσκληση χωρίς καθολικό (χειρόγραφη ή παλιά).
 */
export type InviteDeliveryDisplay = 'pending' | 'delivered' | 'uncertain' | 'failed';

export function inviteDeliveryDisplay(delivery: Pick<VendorInviteDelivery, 'state'> | undefined): InviteDeliveryDisplay | null {
  if (delivery === undefined) return null;
  if (OPEN_INVITE_DELIVERY_STATES.includes(delivery.state)) return 'pending';
  if (delivery.state === 'unknown') return 'uncertain';
  return delivery.state === 'delivered' ? 'delivered' : 'failed';
}
