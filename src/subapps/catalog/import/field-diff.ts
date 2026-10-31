/**
 * Η **διαφορά ανά πεδίο** (ADR-923 §5.5): νέο · αλλαγή · αμετάβλητο · σύγκρουση, και η προεπιλεγμένη απόφαση.
 *
 * 🔑 **Σύγκριση τριών σημείων** (git merge, όχι δύο): η `base` είναι ό,τι είχε φέρει η προηγούμενη εισαγωγή.
 *
 * | ζωντανή | εισερχόμενη | Τι έγινε | Κατάσταση |
 * |---|---|---|---|
 * | καμία | x | πρώτη φορά | `new` |
 * | x | x | ίδια | `unchanged` |
 * | βάση | x | άλλαξε μόνο η πηγή | `changed` |
 * | y | βάση | άλλαξε μόνο ο άνθρωπος· η πηγή δεν λέει κάτι νέο | `unchanged` (η δουλειά του μένει) |
 * | y | x | άλλαξαν **και οι δύο** | `conflict` |
 *
 * Χωρίς βάση (πρώτη εισαγωγή πάνω σε χειρόγραφα δεδομένα) δεν ξέρουμε ποιος άλλαξε ⇒ `changed`.
 * Η ισότητα τη δίνει ο καλών (μετράει η μονάδα: 1,8 kW ≡ 1800 W).
 *
 * @module subapps/catalog/import/field-diff
 */

import type { ExtractedCell, ImportFieldValue, ImportIssue, ImportProposalField } from '../types/catalog-import';
import { IMPORT_REVIEW_CONFIDENCE, type ImportFieldDecision, type ImportFieldStatus } from '../vocabulary/catalog-import';

export type ImportValueEquality = (left: ImportFieldValue, right: ImportFieldValue) => boolean;

export function fieldStatusOf(
  incoming: ImportFieldValue,
  live: ImportFieldValue | null,
  base: ImportFieldValue | null,
  same: ImportValueEquality,
): ImportFieldStatus {
  if (live === null) return 'new';
  if (same(incoming, live)) return 'unchanged';
  if (base === null || same(base, live)) return 'changed';
  return same(base, incoming) ? 'unchanged' : 'conflict';
}

export interface ProposalFieldInput {
  readonly cell: ExtractedCell & { readonly text: string };
  readonly incoming: ImportFieldValue | null;
  readonly issues: readonly ImportIssue[];
  readonly live: ImportFieldValue | null;
  readonly base: ImportFieldValue | null;
  /** `null` = ο στόχος δεν κρίνεται (άγνωστη ιδιότητα). */
  readonly same: ImportValueEquality | null;
}

/**
 * Το πεδίο πρότασης: **μία** συναρμολόγηση για ιδιότητες και τιμές. Τιμή που δεν διαβάστηκε απέναντι σε ζωντανή είναι
 * σύγκρουση: κάτι λέει η πηγή, και δεν ξέρουμε τι.
 */
export function proposalFieldOf({ cell, incoming, issues, live, base, same }: ProposalFieldInput): ImportProposalField {
  const unreadStatus: ImportFieldStatus = live === null ? 'new' : 'conflict';
  const status = incoming === null || same === null ? unreadStatus : fieldStatusOf(incoming, live, base, same);
  const facts = { status, confidence: cell.confidence, issues: [...cell.flags, ...issues], anchor: cell.anchor, incoming };
  return { ...facts, target: cell.target, sourceText: cell.text, live, base, decision: defaultDecisionOf(facts) };
}

type DecisionFacts = Pick<ImportProposalField, 'status' | 'confidence' | 'issues' | 'anchor' | 'incoming'>;

/** Η άγκυρα λέει «η AI έδειξε αλλού»: η τιμή δεν στηρίζεται στο κείμενο της σελίδας που το έχει. */
const contradictsPage = (field: DecisionFacts): boolean => field.anchor?.kind === 'page' && field.anchor.verified === false;

/**
 * Τι χρειάζεται ρητή απόφαση ανθρώπου. Αμετάβλητο ⇒ τίποτα να εφαρμοστεί. Άκυρο ⇒ απόρριψη (δεν υπάρχει τιμή να γραφτεί).
 * Σύγκρουση, εύρημα, χαμηλή βεβαιότητα ή διάψευση από το κείμενο ⇒ `pending`, και η έγκριση αρνείται όσο μένει.
 */
export function defaultDecisionOf(field: DecisionFacts): ImportFieldDecision {
  if (field.status === 'unchanged' || field.incoming === null) return 'reject';
  const needsHuman =
    field.status === 'conflict' ||
    field.issues.length > 0 ||
    field.confidence < IMPORT_REVIEW_CONFIDENCE ||
    contradictsPage(field);
  return needsHuman ? 'pending' : 'accept';
}
