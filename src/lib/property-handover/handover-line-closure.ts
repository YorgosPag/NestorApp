/**
 * @fileoverview **«Μπορεί το γραφείο να κλείσει αυτή τη γραμμή χωρίς πλήρες αποτύπωμα;»** (ADR-916 §5.23 Φ-Δ.7γ · Ο13β (i)).
 * @related types/property-handover-line-closure.ts (λεξιλόγια) · server/property-handover-delivery/handover-delivery-probe.server.ts
 *          (η μέτρηση) · services/property-handover/property-handover-line-closure.service.ts (η πόρτα — την ξανατρέχει)
 * @module lib/property-handover/handover-line-closure
 *
 * 🔑 **Μία κρίση για κουμπί ΚΑΙ πόρτα** (πρότυπο Φ-Δ.4/Φ-Δ.5): το κουμπί εμφανίζεται μόνο όταν η πόρτα θα δεχτεί.
 * ⚖️ **Μόνο ό,τι η μηχανή μετρά ως οριστικό** (DocuSign void: πάντα με αιτιολογία — εδώ **και** με αποδεδειγμένη αιτία):
 *    ζωντανά bytes (`provable`) ή soft-deleted γενιά που ακόμη υπάρχει (`recovering`) ⇒ **όχι**· η απόδειξη έρχεται μόνη της.
 *    Γραμμή με sha256 **δεν** κλείνει ποτέ — ό,τι αποδείχτηκε μένει αποδεδειγμένο.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { PropertyHandover } from '@/types/property-handover';
import type {
  HandoverLineClosureCause,
  HandoverLineClosureOffer,
  HandoverLineClosureRefusal,
  HandoverLineEvidence,
} from '@/types/property-handover-line-closure';

import { fileDeliveryStateOf } from './handover-delivery-plan';

type HandoverOwedFacts = Pick<PropertyHandover, 'lifecycle' | 'recipient' | 'fileDelivery'>;

/** **Το κουμπί** — η μία απάντηση στο «κλείνει αυτή η γραμμή;». */
export function handoverLineClosureOfferOf(handover: HandoverOwedFacts, evidence: HandoverLineEvidence): HandoverLineClosureOffer {
  if (fileDeliveryStateOf(handover) === null) return { kind: 'blocked', reason: 'not-owed' };
  return evidence.kind === 'lost' ? { kind: 'close', cause: evidence.cause } : { kind: 'blocked', reason: evidence.kind };
}

export type HandoverLineClosureVerdict =
  | { readonly kind: 'close'; readonly cause: HandoverLineClosureCause }
  /** Ήδη κλεισμένη — διπλό κλικ ή επανάληψη με άλλο κλειδί: καμία δεύτερη εγγραφή. */
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverLineClosureRefusal };

/** **Η πόρτα** — η ΙΔΙΑ κρίση με το κουμπί, πάνω σε φρέσκια μέτρηση· `null` γραμμή ⇒ ξένη ή ανύπαρκτη. */
export function handoverLineClosureOf(handover: HandoverOwedFacts, evidence: HandoverLineEvidence | null): HandoverLineClosureVerdict {
  if (evidence === null) return { kind: 'refused', reason: 'line-unknown' };
  if (evidence.kind === 'closed') return { kind: 'unchanged' };
  const offer = handoverLineClosureOfferOf(handover, evidence);
  return offer.kind === 'close' ? offer : { kind: 'refused', reason: offer.reason };
}
