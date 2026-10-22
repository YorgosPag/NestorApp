/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — «οφείλεται σφραγισμένο Πρωτόκολλο τώρα, και ποια αναθεώρηση;» (ADR-916 Φ-Γ2 Σ4).
 * @related handover-delivery-plan.ts (`fileDeliveryStateOf` · αποτύπωμα v2) · property-handover-id.ts (`handoverProtocolIdOf`)
 * @module lib/property-handover/handover-protocol-plan
 *
 * 🔑 **Συμφιλίωση, όχι γεγονός** (Π5): η κρίση συγκρίνει το **σημερινό** αποτύπωμα του καθολικού με τον δείκτη στο
 *    τελευταίο πρωτόκολλο. Ίδια ⇒ `current` (τίποτα). Διαφορετικά ⇒ `due` (νέα αναθεώρηση). Έτσι ένας κώδικας καλύπτει
 *    πρώτη έκδοση · επανάληψη μετά από αποτυχία σφράγισης · συμπλήρωση (Δ5), και το νυχτερινό δίχτυ δεν χρειάζεται δικό του.
 * 🔒 **Ποτέ πιστοποίηση που δεν αποδεικνύεται** (Ο13): πρωτόκολλο εκδίδεται **μόνο** όταν **κάθε** γραμμή έχει sha256
 *    (`delivered`). Γραμμή που κανείς δεν κρατά πια ⇒ `unverifiable-rows`, ονομασμένο για το γραφείο (BagIt RFC 8493:
 *    έγκυρο = πλήρες **και** επαληθευμένο).
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import type { PropertyHandover } from '@/types/property-handover';

import { fileDeliveryStateOf } from './handover-delivery-plan';
import { handoverProtocolIdOf } from './property-handover-id';

export type HandoverProtocolNotDueReason =
  /** Η πώληση δεν ολοκληρώθηκε, ακυρώθηκε, ή ο αγοραστής δεν αποδέχτηκε — δεν υπάρχει παράδοση αρχείων. */
  | 'not-ready'
  /** Η αντιγραφή ή ο κατακερματισμός συνεχίζεται. */
  | 'not-delivered'
  /** Ο13 — γραμμές χωρίς αποδείξιμα bytes· απόφαση γραφείου, όχι αναμονή. */
  | 'unverifiable-rows'
  /** `delivered` χωρίς αποτύπωμα — αδύνατο από τον εκτελεστή· ζώνη ασφαλείας, ποτέ πρωτόκολλο χωρίς αποτύπωμα. */
  | 'digest-pending';

export type HandoverProtocolPlan =
  | { readonly kind: 'not-due'; readonly reason: HandoverProtocolNotDueReason; readonly unverifiable: number }
  /** Το τελευταίο πρωτόκολλο σφραγίζει ήδη **αυτό** το καθολικό. */
  | { readonly kind: 'current'; readonly protocolId: string }
  | {
      readonly kind: 'due';
      readonly protocolId: string;
      readonly ledgerDigest: string;
      readonly revision: number;
      readonly supersedesProtocolId: string | null;
    };

const notDue = (reason: HandoverProtocolNotDueReason, unverifiable = 0): HandoverProtocolPlan => ({ kind: 'not-due', reason, unverifiable });

/** **Οφείλεται Πρωτόκολλο;** Ίδια είσοδος ⇒ ίδια απόφαση, και ίδιο `protocolId` για το ίδιο καθολικό. */
export function planHandoverProtocol(
  handover: Pick<PropertyHandover, 'id' | 'lifecycle' | 'recipient' | 'fileDelivery' | 'protocol'>,
): HandoverProtocolPlan {
  const delivery = handover.fileDelivery;
  if (fileDeliveryStateOf(handover) === null || delivery === null) return notDue('not-ready');
  if (delivery.state !== 'delivered') {
    return delivery.unverifiable > 0 ? notDue('unverifiable-rows', delivery.unverifiable) : notDue('not-delivered');
  }
  if (delivery.digest === null) return notDue('digest-pending');
  const previous = handover.protocol;
  if (previous !== null && previous.digest === delivery.digest) return { kind: 'current', protocolId: previous.protocolId };
  return {
    kind: 'due',
    protocolId: handoverProtocolIdOf(handover.id, delivery.digest),
    ledgerDigest: delivery.digest,
    revision: (previous?.revision ?? 0) + 1,
    supersedesProtocolId: previous?.protocolId ?? null,
  };
}
