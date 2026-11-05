/**
 * @fileoverview **Γιατί η «Αποθήκευση» δεν προσφέρεται τώρα** — ο ένας κανόνας για κάθε επεξεργαστή πρόχειρου της
 *   υπεργολαβίας (συμφωνητικό · συγγραφή ρήτρας · πρότυπο, ADR-928 Φ3γ · §5.22). Καθαρό.
 * @module components/procurement/subcontracts/editor/save-block
 *
 * 🔑 Μία σειρά προτεραιότητας για όλους: στέλνεται · καμία αλλαγή · ελέγχεται · χωρίς δικαίωμα · ανοιχτή πρόταση ·
 *    σύγκρουση · ευρήματα. Ό,τι λείπει λέγεται (`EditorToolbar`), ποτέ σιωπηλά ανενεργό κουμπί.
 * 🔑 Εξήχθη όταν ο τρίτος επεξεργαστής θα έγραφε τρίτο αντίγραφο (CHECK 3.28): η ίδια ερώτηση, μία απάντηση.
 */

import type { DraftStatus } from '@/hooks/drafts/useRevisionedDraft';

export type EditorSaveBlock =
  | { readonly kind: 'clean' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'conflict' }
  /** Συγγραφή βιβλιοθήκης (ADR-928 §5.22): λείπει το δικαίωμα, ή η ρήτρα έχει ήδη ανοιχτή πρόταση (μία ανά ρήτρα). */
  | { readonly kind: 'notAuthorized' }
  | { readonly kind: 'proposalPending'; readonly version: number }
  | { readonly kind: 'issues'; readonly count: number };

export interface SaveBlockFacts {
  readonly status: DraftStatus;
  readonly dirty: boolean;
  /** Βιβλιοθήκη ή κρίση δικαιώματος σε αναμονή. */
  readonly checking: boolean;
  /** `false` = λείπει το δικαίωμα (μόνο όπου υπάρχει φύλακας δικαιώματος στην οθόνη). */
  readonly allowed: boolean;
  /** Η ανοιχτή πρόταση της ρήτρας (μόνο στη συγγραφή ρήτρας). */
  readonly openProposal: number | null;
  readonly behind: boolean;
  readonly issueCount: number;
}

export function saveBlockOf(facts: SaveBlockFacts): EditorSaveBlock | null {
  if (facts.status === 'saving') return { kind: 'saving' };
  if (!facts.dirty) return { kind: 'clean' };
  if (facts.checking) return { kind: 'checking' };
  if (!facts.allowed) return { kind: 'notAuthorized' };
  if (facts.openProposal !== null) return { kind: 'proposalPending', version: facts.openProposal };
  if (facts.behind) return { kind: 'conflict' };
  return facts.issueCount > 0 ? { kind: 'issues', count: facts.issueCount } : null;
}
