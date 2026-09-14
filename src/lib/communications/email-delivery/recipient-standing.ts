/**
 * @fileoverview **ΖΕΙ ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ;** — η κατάσταση μιας διεύθυνσης ως αναδίπλωση των συμβάντων
 *   της (ADR-841 §7 Α21.20).
 * @related types/email-delivery.ts · server/comms/email-delivery/email-delivery-ledger.ts (ο γραφέας) ·
 *   lib/agency/showcase-email-confirmation-rules.ts (ο πρώτος καταναλωτής)
 * @module lib/communications/email-delivery/recipient-standing
 *
 * 🔑 **ΕΚΤΟΣ ΣΕΙΡΑΣ ΑΣΦΑΛΕΣ**: ο πάροχος ξαναστέλνει για ώρες, οπότε ένα `delivered` μπορεί να φτάσει
 * **μετά** από νεότερο bounce. Κάθε πεδίο κρατά το **μέγιστο** της χρονοσφραγίδας του συμβάντος —
 * ποτέ «το τελευταίο που ήρθε». Η αναδίπλωση είναι αντιμεταθετική και ιδεμποτενής.
 *
 * 🏆 **ΑΥΤΟΘΕΡΑΠΕΙΑ**: μια παράδοση **νεότερη** από την απόδειξη ακυρώνει το «νεκρό» — καμία κολλημένη
 * σημαία που θέλει χειροκίνητο καθάρισμα (το πρόβλημα του Salesforce «Remove Bounce Alert»).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα I/O, κανένα ρολόι.
 */

import type { EmailDeliveryEvent, RecipientStanding } from '@/types/email-delivery';

function instantOf(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Είναι το `candidate` αυστηρά νεότερο από το `current`; Μη αναγνώσιμο `current` ⇒ ναι. */
function isLater(candidate: string, current: string | null): boolean {
  const next = instantOf(candidate);
  if (next === null) return false;
  const previous = instantOf(current);
  return previous === null || next > previous;
}

const later = (candidate: string, current: string | null): string | null =>
  isLater(candidate, current) ? candidate : current;

export function emptyStanding(email: string): RecipientStanding {
  return {
    email, mailboxAbsentAt: null, evidenceEventId: null, lastDeliveredAt: null, lastComplainedAt: null, lastEventAt: null,
  };
}

/** **Ένα συμβάν ακόμη.** Το ίδιο συμβάν δύο φορές ⇒ ίδια κατάσταση. */
export function foldStanding(previous: RecipientStanding, event: EmailDeliveryEvent): RecipientStanding {
  const at = event.occurredAt;
  const base: RecipientStanding = { ...previous, lastEventAt: later(at, previous.lastEventAt) };

  if (event.kind === 'delivered') return { ...base, lastDeliveredAt: later(at, previous.lastDeliveredAt) };
  if (event.kind === 'complained') return { ...base, lastComplainedAt: later(at, previous.lastComplainedAt) };
  if (event.kind === 'failed' && event.evidence === 'mailbox-absent' && isLater(at, previous.mailboxAbsentAt)) {
    return { ...base, mailboxAbsentAt: at, evidenceEventId: event.providerEventId };
  }
  return base;
}

/**
 * **Από πότε είναι αποδεδειγμένα νεκρό** — ή `null`.
 *
 * 🔴 Παράδοση **νεότερη** από την απόδειξη ⇒ `null`: το γραμματοκιβώτιο ξαναζεί (διορθώθηκε, ή η
 * απόδειξη αφορούσε προσωρινή βλάβη που ο διακομιστής ανέφερε λάθος).
 */
export function mailboxAbsentSince(standing: RecipientStanding | null): string | null {
  if (standing === null || standing.mailboxAbsentAt === null) return null;
  if (standing.lastDeliveredAt !== null && !isLater(standing.mailboxAbsentAt, standing.lastDeliveredAt)) return null;
  return standing.mailboxAbsentAt;
}

/**
 * **Είναι ΑΥΤΟ το συμβάν η απόδειξη που ισχύει τώρα;** — ό,τι ρωτά το webhook για να ξυπνήσει τους
 * καταναλωτές.
 *
 * 🔑 **Γιατί όχι μόνο «μόλις πέθανε»**: αν ο καταναλωτής αποτύχει, το route απαντά 5xx και ο πάροχος
 * ξαναστέλνει. Η δεύτερη παράδοση είναι `duplicate` — ένα «μόλις πέθανε» θα ήταν `false` και η ακύρωση
 * **δεν θα ξανατρέχε ποτέ**. Η ερώτηση «είμαι η ισχύουσα απόδειξη;» απαντά το ίδιο σε κάθε επανάληψη,
 * και οι καταναλωτές είναι ιδεμποτενείς.
 */
export function isStandingEvidence(standing: RecipientStanding, providerEventId: string): boolean {
  return mailboxAbsentSince(standing) !== null && standing.evidenceEventId === providerEventId;
}

/** **Μόλις πέθανε;** — η μετάβαση (για καταγραφή). Ιδεμποτενές: ίδια απόδειξη ⇒ `false`. */
export function becameAbsent(previous: RecipientStanding, next: RecipientStanding): boolean {
  const now = mailboxAbsentSince(next);
  return now !== null && now !== mailboxAbsentSince(previous);
}
