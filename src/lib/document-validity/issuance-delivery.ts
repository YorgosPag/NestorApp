/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΠΑΡΑΔΟΣΗ των μηνυμάτων της ανάθεσης έκδοσης (ADR-915 §28 Η-Β9 · §30)
 * =============================================================================
 *
 * **«Έφτασε το email;»** — τηλεμετρία, όχι στάδιο: δεν περνά από τον μειωτή και δεν αλλάζει σε ποιον είναι η μπάλα. Δύο
 * πηγές γράφουν εδώ, με **μία** αναδίπλωση: η αναφορά του αποστολέα (`withIssuanceDelivery`) και τα γεγονότα του παρόχου
 * (`withObservedDelivery`, μέσω του webhook του ADR-841).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { withMessage, type IssuanceAssignmentRecord } from './issuance-assignment';

/**
 * Τι απέγινε ένα email. Δύο πηγές, μία λίστα:
 * - ο **αποστολέας** (`accepted` · `failed` · `unaddressable`) — ίδιες λέξεις με το `InvitationNoticeOutcome` (ο server το
 *   ελέγχει με `satisfies`)· το `accepted` σημαίνει «μπήκε σε ουρά», **ποτέ** «παραδόθηκε»·
 * - τα **γεγονότα του παρόχου** (§30, ADR-841 §7 Α21.20): `delivered` (ο διακομιστής του παραλήπτη το δέχτηκε) ·
 *   `bounced` (μόνιμη αποτυχία) · `complained` (το σήμανε ανεπιθύμητο — άρα **το έλαβε**).
 */
export const ISSUANCE_DELIVERY_OUTCOMES = ['accepted', 'failed', 'unaddressable', 'delivered', 'bounced', 'complained'] as const;
export type IssuanceDeliveryOutcome = (typeof ISSUANCE_DELIVERY_OUTCOMES)[number];

/** Ό,τι μπορεί να πει **μόνο** ο πάροχος, μετά την αποστολή. */
export type ObservedDeliveryOutcome = Extract<IssuanceDeliveryOutcome, 'delivered' | 'bounced' | 'complained'>;

/**
 * **Η τάξη της αλήθειας** (§30 Η-Δ3). Ο Mailgun **δεν** εγγυάται σειρά γεγονότων, και η αναφορά του αποστολέα μπορεί να
 * γραφτεί **μετά** το πρώτο γεγονός. Άρα η παράδοση είναι αναδίπλωση, όχι «το τελευταίο κερδίζει»:
 * - βαθμίδα 0 (αποστολέας): η νεότερη αναφορά του αποστολέα αντικαθιστά την προηγούμενη·
 * - `delivered` ξεπερνά κάθε αναφορά αποστολέα — ένα `failed` από timeout **μετά** την αποδοχή διαψεύδεται·
 * - `bounced`: τελική για τον αποστολέα και το `delivered` (μια καθυστερημένη επιστροφή ακυρώνει το «παραδόθηκε»)·
 * - `complained`: η **πράξη του ίδιου του παραλήπτη** — η ισχυρότερη απόδειξη ότι το έλαβε.
 * ⚠️ **Ολική τάξη, χωρίς ισοπαλίες πάνω από το 0**: με `bounced` = `complained` το αποτέλεσμα θα εξαρτιόταν από το ποιο ήρθε
 *    πρώτο. Έτσι η αναδίπλωση των γεγονότων του παρόχου είναι **αντιμεταθετική** (άγκυρα: όλες οι μεταθέσεις, ίδιο αποτέλεσμα).
 */
const DELIVERY_RANK: Readonly<Record<IssuanceDeliveryOutcome, 0 | 1 | 2 | 3>> = {
  accepted: 0, failed: 0, unaddressable: 0, delivered: 1, bounced: 2, complained: 3,
};

/** Η μία πράξη αναδίπλωσης — ιδεμποτής (`fold(x, x) = x`) και ανεξάρτητη από τη σειρά άφιξης των γεγονότων του παρόχου. */
export function foldDeliveryOutcome(current: IssuanceDeliveryOutcome | undefined, incoming: IssuanceDeliveryOutcome): IssuanceDeliveryOutcome {
  if (current === undefined) return incoming;
  const [now, next] = [DELIVERY_RANK[current], DELIVERY_RANK[incoming]];
  return next > now || (next === 0 && now === 0) ? incoming : current;
}

/** Η παράδοση ενός μηνύματος (§28 Η-Β9) — **τηλεμετρία**, όχι στάδιο. Συνιδιοκτήτες: μόνο στο αίτημα έγκρισης. */
export interface IssuanceDelivery {
  readonly recipient: IssuanceDeliveryOutcome;
  readonly coOwners: Readonly<Record<string, IssuanceDeliveryOutcome>>;
}

/**
 * **Η παράδοση ενός μηνύματος** (§28 Η-Β9) — γράφεται **μόνο** στο μήνυμα που τη γέννησε: αν στο μεταξύ στάλθηκε νέο
 * (άλλο `invitationId`), η παλιά αναφορά **δεν** σκεπάζει τη νέα ⇒ `null`. Τηλεμετρία, όχι στάδιο: δεν περνά από τον μειωτή.
 * §30 — **αναδίπλωση** ανά θέση (`foldDeliveryOutcome`): ένα `delivered` που πρόλαβε την αναφορά του αποστολέα δεν σβήνεται.
 */
export function withIssuanceDelivery(record: IssuanceAssignmentRecord, invitationId: string, delivery: IssuanceDelivery): IssuanceAssignmentRecord | null {
  return withMessage(record, invitationId, (message) => ({
    ...message,
    delivery: message.delivery === null ? delivery : {
      recipient: foldDeliveryOutcome(message.delivery.recipient, delivery.recipient),
      coOwners: foldCoOwners(message.delivery.coOwners, delivery.coOwners),
    },
  }));
}

/** Σε ποιον αφορά ένα γεγονός του παρόχου: τον παραλήπτη του συνδέσμου, ή έναν συνιδιοκτήτη που ενημερώθηκε. */
export type DeliverySlot = { readonly kind: 'recipient' } | { readonly kind: 'co-owner'; readonly contactId: string };

/**
 * **Ένα γεγονός του παρόχου** (§30) — αναδιπλώνεται στο μήνυμα που το γέννησε. `null` = το μήνυμα δεν είναι πια το τρέχον
 * (αντικαταστάθηκε) **ή** η αναφορά του αποστολέα δεν έχει γραφτεί ακόμη· ο καλών ξεχωρίζει τα δύο με `messageOf`.
 * ⚠️ Χωρίς αναφορά αποστολέα **δεν** επινοούμε τιμή για την άλλη θέση — ο καλών ζητά από τον πάροχο να ξαναστείλει.
 */
export function withObservedDelivery(record: IssuanceAssignmentRecord, invitationId: string, slot: DeliverySlot, outcome: ObservedDeliveryOutcome): IssuanceAssignmentRecord | null {
  return withMessage(record, invitationId, (message) => {
    const current = message.delivery;
    if (current === null) return null;
    const delivery: IssuanceDelivery = slot.kind === 'recipient'
      ? { ...current, recipient: foldDeliveryOutcome(current.recipient, outcome) }
      : { ...current, coOwners: { ...current.coOwners, [slot.contactId]: foldDeliveryOutcome(current.coOwners[slot.contactId], outcome) } };
    return { ...message, delivery };
  });
}

function foldCoOwners(current: IssuanceDelivery['coOwners'], incoming: IssuanceDelivery['coOwners']): IssuanceDelivery['coOwners'] {
  const merged: Record<string, IssuanceDeliveryOutcome> = { ...current };
  for (const [contactId, outcome] of Object.entries(incoming)) merged[contactId] = foldDeliveryOutcome(current[contactId], outcome);
  return merged;
}
