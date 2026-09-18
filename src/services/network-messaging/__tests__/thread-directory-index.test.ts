/**
 * @jest-environment node
 *
 * ADR-867 Β5 — ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» του καταλόγου νημάτων.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: η CHECK 3.15 αναλύει **μόνο** το `firestoreQueryService` και πάνω στο
 * `thread-directory.ts` απαντά *«analysed 0 composite query shape(s)»* (μετρημένο 2026-09-18) —
 * πράσινο που **δεν κοίταξε**. Ο εξομοιωτής **δεν** επιβάλλει δείκτες. Χωρίς αυτή την άγκυρα, ένας
 * λάθος ή σβησμένος δείκτης θα φαινόταν **μόνο στην παραγωγή** (`FAILED_PRECONDITION`).
 *
 *   Ι-1  Ο δείκτης υπάρχει: `network_audience` · COLLECTION_GROUP · ισότητες ↑ · δραστηριότητα ↓
 *   Ι-2  Το όνομα της υποσυλλογής στον δείκτη είναι **το ίδιο** με το SSoT των συλλογών
 */

import fs from 'fs';
import path from 'path';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { THREAD_DIRECTORY_INDEX } from '@/services/network-messaging/thread-directory';

interface IndexField {
  readonly fieldPath: string;
  readonly order?: 'ASCENDING' | 'DESCENDING';
}
interface CompositeIndex {
  readonly collectionGroup: string;
  readonly queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly fields: readonly IndexField[];
}

const INDEXES = (
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../firestore.indexes.json'), 'utf8')) as {
    readonly indexes: readonly CompositeIndex[];
  }
).indexes;

/** Τα πεδία που ΠΡΕΠΕΙ να έχει ο δείκτης — παραγόμενα από τη δήλωση του ερωτήματος, όχι γραμμένα εδώ. */
const EXPECTED: readonly IndexField[] = [
  ...THREAD_DIRECTORY_INDEX.equality.map((fieldPath) => ({ fieldPath, order: 'ASCENDING' as const })),
  {
    fieldPath: THREAD_DIRECTORY_INDEX.orderBy.field,
    order: THREAD_DIRECTORY_INDEX.orderBy.direction === 'desc' ? 'DESCENDING' : 'ASCENDING',
  },
];

describe('Ι — ο κατάλογος νημάτων έχει τον δείκτη του', () => {
  it('Ι-1 ο δείκτης υπάρχει, με ΑΚΡΙΒΩΣ τα πεδία και τη φορά του ερωτήματος', () => {
    const matches = INDEXES.filter(
      (index) =>
        index.collectionGroup === SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE &&
        index.queryScope === 'COLLECTION_GROUP' &&
        JSON.stringify(index.fields) === JSON.stringify(EXPECTED),
    );

    expect(matches).toHaveLength(1);
  });

  it('Ι-2 κανένας ΔΕΥΤΕΡΟΣ δείκτης για την ίδια υποσυλλογή με άλλη μορφή (δείκτης-φάντασμα)', () => {
    const forAudience = INDEXES.filter((index) => index.collectionGroup === SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE);

    expect(forAudience).toHaveLength(1);
  });
});
