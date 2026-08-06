/**
 * @fileoverview Ο **σκελετός** μιας πρότασης σύνδεσης — ό,τι ξέρουμε για το κελί **πριν**
 *               αποφασιστεί πού πάει η τιμή του (ADR-745 §6.2).
 *
 * 🔴 **Γιατί χωριστό αρχείο για έξι γραμμές.** Το ίδιο αντικείμενο χτιζόταν **τρεις** φορές —
 * `title-block-proposals.unsupported()` · `resolve-location.baseFor()` · μέσα στο
 * `resolve-drawing-meta` — και ο Φ3γ ετοίμαζε **τέταρτη**. Είναι το κλασικό σχήμα του N.18
 * («κεντρικοποιείς το Α, γράφεις το Β δίδυμο»), και το `ssot:discover` **δεν το βλέπει**:
 * τα τρία έχουν διαφορετικά ονόματα. Το βλέπει μόνο ο token-based έλεγχος (CHECK 3.28).
 *
 * Ο κίνδυνος δεν είναι θεωρητικός: το `at` προστέθηκε στο `BindingProposal` όταν αποδείχθηκε
 * ότι το `sourceHandle` **δεν είναι μοναδικό** (`lib/title-block-binding-id`). Ένα από τα
 * τρία αντίγραφα που θα το ξεχνούσε θα παρήγαγε προτάσεις με **συγκρουόμενο κλειδί** — και
 * τίποτα στην οθόνη δεν θα φαινόταν λάθος.
 *
 * @module lib/title-block/proposal-base
 */

import type { BindingProposal, ProposalFieldKey } from '@/types/title-block-binding';

/**
 * Ό,τι χρειάζεται μια πρόταση από **το σημείο του σχεδίου** που τη γέννησε.
 *
 * 🔑 **Δομικός τύπος επίτηδες**: το `TitleBlockField` τον ικανοποιεί **αυτούσιο**, οπότε ο
 * αναγνώστης του σώματος (Φ4) έγινε τρίτος καλών **χωρίς δεύτερο κατασκευαστή** — που θα ήταν
 * ακριβώς το τέταρτο αντίγραφο που αυτό το αρχείο υπάρχει για να αποτρέψει.
 */
export interface ProposalSource {
  readonly key: ProposalFieldKey;
  readonly rawValue: string;
  readonly sourceHandle: string;
  readonly labelHandle: string;
  readonly at: { readonly x: number; readonly y: number };
}

/**
 * Τα πεδία μιας πρότασης που προκύπτουν **αποκλειστικά** από το κελί.
 *
 * Ό,τι λείπει είναι ακριβώς ό,τι εξαρτάται από την **έκβαση**: υποψήφιοι, αιτία
 * μπλοκαρίσματος, επιφύλαξη, και ποιος αναγνώστης το παρήγαγε.
 */
export type ProposalBase = Omit<
  BindingProposal,
  'candidates' | 'blockedBy' | 'caution' | 'sourceKind'
>;

/**
 * @param snapshotValue τι έγραφε το σχέδιο **για αυτή την πρόταση**. Προεπιλογή η ολόκληρη
 *   τιμή του κελιού· τα κελιά που τεμαχίζονται (ΘΕΣΗ → δήμος/Ο.Τ./οδοί) περνούν το **τμήμα**
 *   τους, ώστε η κάθε γραμμή να κουβαλά ό,τι όντως αφορά και όχι ολόκληρη την πρόταση.
 */
export function proposalBase(
  field: ProposalSource,
  titleBlockIndex: number,
  snapshotValue: string = field.rawValue,
): ProposalBase {
  return {
    fieldKey: field.key,
    titleBlockIndex,
    sourceHandle: field.sourceHandle,
    labelHandle: field.labelHandle,
    at: field.at,
    snapshotValue,
  };
}
