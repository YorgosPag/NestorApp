/**
 * @fileoverview **Κατασκευαστές σώματος ρήτρας** — ευανάγνωστη γραφή του σχήματος μπλοκ (ADR-928 §5.2).
 * @module subapps/procurement/subcontracts/clauses/clause-body-builders
 *
 * `paragraph('Παρακρατείται ', param('rate'), ' της αξίας.')` αντί για χειρόγραφο δέντρο `{kind:'text'}`/`{kind:'param'}`.
 * Δεν είναι πρότυπο συμβολοσειράς: τίποτα δεν αναλύεται, η θέση της παραμέτρου είναι **κόμβος** από την αρχή.
 * Τη χρησιμοποιούν η προεπιλεγμένη βιβλιοθήκη και τα tests· ο επεξεργαστής της Φ3 χτίζει το ίδιο σχήμα.
 */

import type { ClauseBlock, ClauseBody, ClauseInline } from '../types/clause';

/** Τμήμα: ωμό κείμενο, ή η θέση μιας παραμέτρου. */
export type ClauseInlinePart = string | { readonly param: string };

export function param(key: string): ClauseInlinePart {
  return { param: key };
}

export function inlines(...parts: readonly ClauseInlinePart[]): ClauseInline[] {
  return parts.map((part) => (typeof part === 'string' ? { kind: 'text', text: part } : { kind: 'param', key: part.param }));
}

export function paragraph(...parts: readonly ClauseInlinePart[]): ClauseBlock {
  return { kind: 'paragraph', inlines: inlines(...parts) };
}

/** Λίστα· κάθε στοιχείο είναι ένα κείμενο ή ένας πίνακας τμημάτων. */
export function list(ordered: boolean, ...items: readonly (string | readonly ClauseInlinePart[])[]): ClauseBlock {
  return { kind: 'list', ordered, items: items.map((item) => (typeof item === 'string' ? inlines(item) : inlines(...item))) };
}

export function clauseBody(heading: string, ...blocks: readonly ClauseBlock[]): ClauseBody {
  return { heading, blocks };
}
