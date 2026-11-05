/**
 * **Τι βλέπει ο αγοραστής για την παράδοση μιας πρόσκλησης** (ADR-923 §5.13 Τ5): σε αναμονή · στάλθηκε · απέτυχε, θα
 * ξαναδοκιμαστεί · απέτυχε · δεν στάλθηκε (με λόγο) · άγνωστο. Όπως η κατάσταση παράδοσης του Ariba ή του Gmail.
 *
 * 🔑 Καθαρή συνάρτηση πάνω στο καθολικό `delivery`: ο πίνακας δεν ξανακρίνει τίποτα, μόνο ονομάζει.
 * 🔑 Κάθε κατάσταση έχει **κείμενο και εικονίδιο**, όχι μόνο χρώμα (WCAG 1.4.1, ίδιο δόγμα με το CHECK 3.41).
 * 🔒 Δεν διαβάζει ούτε δείχνει παραλήπτη: η διεύθυνση `quoteIntake` δεν υπάρχει στο έγγραφο, και ο κωδικός σφάλματος
 *    (`lastError`) είναι κλειστό λεξιλόγιο, όχι κείμενο παρόχου.
 *
 * @module subapps/procurement/utils/invite-delivery-display
 */

import type { InviteUndeliverableReason, VendorInviteDelivery } from '../types/vendor-invite-delivery';

export const INVITE_DELIVERY_DISPLAY_STATUSES = ['queued', 'sent', 'retrying', 'deferred', 'failed', 'notSent', 'unknown'] as const;
export type InviteDeliveryDisplayStatus = (typeof INVITE_DELIVERY_DISPLAY_STATUSES)[number];

export interface InviteDeliveryDisplay {
  readonly status: InviteDeliveryDisplayStatus;
  /** Μόνο για `notSent` και `deferred`: γιατί δεν στάλθηκε (ακόμη). */
  readonly reason: InviteUndeliverableReason | null;
}

/** `null` ⇒ η πρόσκληση δεν έχει καθολικό παράδοσης (χειρόγραφη ή παλιά): ο πίνακας δεν δείχνει τίποτα για την παράδοση. */
export function inviteDeliveryDisplay(delivery: VendorInviteDelivery | undefined): InviteDeliveryDisplay | null {
  if (!delivery) return null;
  switch (delivery.state) {
    case 'pending':
      // Γεμάτο ημερήσιο όριο ⇒ αναβολή ως αύριο (ανασκόπηση Ε2), όχι αποτυχία.
      if (delivery.reason === 'recipient_quota') return { status: 'deferred', reason: 'recipient_quota' };
      return { status: delivery.attempts > 0 ? 'retrying' : 'queued', reason: null };
    case 'sending':
      return { status: delivery.attempts > 1 ? 'retrying' : 'queued', reason: null };
    case 'delivered':
      return { status: 'sent', reason: null };
    case 'failed':
      return { status: 'failed', reason: null };
    case 'undeliverable':
      return { status: 'notSent', reason: delivery.reason };
    case 'unknown':
      return { status: 'unknown', reason: null };
  }
}
