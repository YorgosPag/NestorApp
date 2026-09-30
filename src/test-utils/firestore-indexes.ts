/**
 * @fileoverview **SSoT: ο κατάλογος σύνθετων δεικτών (`firestore.indexes.json`) για άγκυρες ισοτιμίας «ερώτημα ⇄ δείκτης».**
 * @module test-utils/firestore-indexes
 * @related ADR-867 Β5 · ADR-890 §17 · ADR-870 (CHECK 3.91)
 *
 * 🔑 **Γιατί υπάρχει**: οι πύλες 3.15/3.91 αναλύουν στατικά τα ερωτήματα, αλλά ένα ερώτημα με **δυναμικό** πεδίο ή
 * έξω από το SSoT τους βγαίνει «μη αναλύσιμο» — πράσινο που δεν κοίταξε. Εκεί ο δείκτης φυλάγεται από άγκυρα που
 * διαβάζει τη **δήλωση** του ερωτήματος και απαιτεί τον δείκτη της. Η ανάγνωση του καταλόγου και η μορφή του ζουν
 * **εδώ**, όχι σε κάθε άγκυρα (N.0.2: ήταν αντιγραμμένα μόλις γράφτηκε η δεύτερη).
 */

import { readRepoFile } from './read-source';

export interface IndexField {
  readonly fieldPath: string;
  readonly order?: 'ASCENDING' | 'DESCENDING';
}

export interface CompositeIndex {
  readonly collectionGroup: string;
  readonly queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly fields: readonly IndexField[];
}

/** Οι σύνθετοι δείκτες όπως είναι δηλωμένοι στο αποθετήριο (όχι όπως είναι ανεπτυγμένοι — αυτό το λέει το CHECK 3.86). */
export function readCompositeIndexes(): readonly CompositeIndex[] {
  return (JSON.parse(readRepoFile('firestore.indexes.json')) as { readonly indexes: readonly CompositeIndex[] }).indexes;
}

/** Φορά ερωτήματος → φορά πεδίου δείκτη. */
export function indexOrderOf(direction: 'asc' | 'desc'): 'ASCENDING' | 'DESCENDING' {
  return direction === 'desc' ? 'DESCENDING' : 'ASCENDING';
}

/** Οι δείκτες μιας συλλογής με **ακριβώς** αυτά τα πεδία, με αυτή τη σειρά και φορά. */
export function indexesMatching(
  indexes: readonly CompositeIndex[],
  collectionGroup: string,
  queryScope: CompositeIndex['queryScope'],
  fields: readonly IndexField[],
): readonly CompositeIndex[] {
  const wanted = JSON.stringify(fields);
  return indexes.filter(
    (index) => index.collectionGroup === collectionGroup && index.queryScope === queryScope && JSON.stringify(index.fields) === wanted,
  );
}
