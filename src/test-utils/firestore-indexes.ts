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

/**
 * Οι δείκτες μιας συλλογής που εξυπηρετούν ερώτημα με αυτές τις **ισότητες** (ως σύνολο — ο Firestore δεν
 * δεσμεύει τη σειρά τους) και αυτό το **τελικό** πεδίο (εύρος + ταξινόμηση στο ίδιο πεδίο). Για ερωτήματα που
 * στήνονται σε κλάδους, όπου η σειρά των `where` εξαρτάται από τον κλάδο και όχι από τον δείκτη.
 */
export function indexesCovering(
  indexes: readonly CompositeIndex[],
  collectionGroup: string,
  queryScope: CompositeIndex['queryScope'],
  equality: readonly string[],
  last: IndexField,
): readonly CompositeIndex[] {
  const wanted = [...equality].sort().join('|');
  return indexes.filter((index) => {
    if (index.collectionGroup !== collectionGroup || index.queryScope !== queryScope) return false;
    const tail = index.fields[index.fields.length - 1];
    const head = index.fields.slice(0, -1);
    return (
      tail?.fieldPath === last.fieldPath && tail.order === last.order &&
      head.every((field) => field.order === 'ASCENDING') &&
      head.map((field) => field.fieldPath).sort().join('|') === wanted
    );
  });
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

/** Τι ζήτησε ένα ερώτημα από τον Firestore: ισότητες (`==`, `in`), πεδία εύρους, ταξινόμηση. */
export interface RecordedQueryShape {
  readonly equality: string[];
  readonly range: Set<string>;
  orderBy: { readonly field: string; readonly direction: 'asc' | 'desc' } | null;
}

/**
 * Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κατασκευαστή ενός ερωτήματος πάνω σε καταγραφέα και επιστρέφει το σχήμα του — οι
 * άγκυρες δεν ξαναγράφουν τα σχήματα με το χέρι. Το `in` είναι ισότητα για τον δείκτη (ADR-870 §6 πρότυπο).
 * Δέχεται τον καταγραφέα ως `TQuery` ώστε ο καλών να τον περάσει όπου ο κατασκευαστής περιμένει `Query`.
 */
export function recordQueryShape<TQuery>(build: (recorder: TQuery) => unknown): RecordedQueryShape {
  const shape: RecordedQueryShape = { equality: [], range: new Set(), orderBy: null };
  const recorder = {
    where(field: string, op: string) {
      if (op === '==' || op === 'in') shape.equality.push(field);
      else shape.range.add(field);
      return recorder;
    },
    orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
      shape.orderBy = { field, direction };
      return recorder;
    },
  };
  build(recorder as unknown as TQuery);
  return shape;
}

/**
 * Οι δείκτες που εξυπηρετούν ένα καταγεγραμμένο σχήμα. Απαιτεί εύρος ΜΟΝΟ στο πεδίο ταξινόμησης — αλλιώς ο
 * Firestore θα ζητούσε άλλο σχήμα δείκτη και η κάλυψη εδώ θα ήταν ψευδής· τότε επιστρέφει κενό.
 */
export function indexesForShape(
  indexes: readonly CompositeIndex[],
  collectionGroup: string,
  shape: RecordedQueryShape,
): readonly CompositeIndex[] {
  const orderBy = shape.orderBy;
  if (!orderBy || ![...shape.range].every((field) => field === orderBy.field)) return [];
  return indexesCovering(indexes, collectionGroup, 'COLLECTION', shape.equality, {
    fieldPath: orderBy.field,
    order: indexOrderOf(orderBy.direction),
  });
}
