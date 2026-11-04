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
  readonly lastError: string | null;
  readonly reason: InviteUndeliverableReason | null;
  readonly recipientKind: InviteRecipientKind | null;
  readonly settledAt: string | null;
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
export function rejectedInviteDelivery(claimed: VendorInviteDelivery, error: string, nowMs: number): VendorInviteDelivery {
  const { maxAttempts, backoffMs } = INVITE_DELIVERY_POLICY;
  if (claimed.attempts >= maxAttempts) return { ...claimed, state: 'failed', dueAt: null, lastError: error, settledAt: iso(nowMs) };
  const wait = backoffMs[Math.min(claimed.attempts - 1, backoffMs.length - 1)];
  return { ...claimed, state: 'pending', dueAt: iso(nowMs + wait), lastError: error };
}

/** Η κράτηση έληξε χωρίς καταγραφή: δεν ξέρουμε αν έφυγε, άρα **δεν** ξαναστέλνουμε (το πολύ μία φορά). */
export function unknownInviteDelivery(claimed: VendorInviteDelivery, nowMs: number): VendorInviteDelivery {
  return { ...claimed, state: 'unknown', dueAt: null, lastError: 'lease expired before the outcome was recorded', settledAt: iso(nowMs) };
}
