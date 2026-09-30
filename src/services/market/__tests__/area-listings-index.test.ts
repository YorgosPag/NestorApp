/**
 * @jest-environment node
 *
 * ADR-890 §17 — ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» της προεπισκόπησης αγγελιών στη σελίδα περιοχής.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: το ερώτημα φιλτράρει σε `adminArea.${πεδίο}` — **δυναμικό** πεδίο, άρα η CHECK 3.91 το
 * κατατάσσει «μη αναλύσιμο» και δεν απαιτεί κανέναν δείκτη. Λάθος ή σβησμένος δείκτης θα φαινόταν μόνο στην παραγωγή
 * (`FAILED_PRECONDITION` ⇒ η σελίδα περιοχής σε 5xx).
 *
 *   Δ-1  Για ΚΑΘΕ βαθμίδα με σελίδα: ακριβώς ένας δείκτης `adminArea.<πεδίο> ↑` + `listedAt.at ↓`
 *   Δ-2  Καμία βαθμίδα με σελίδα χωρίς πεδίο απόδοσης (αλλιώς η σελίδα της δεν θα είχε ποτέ αγγελίες)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { adminAreaFieldOfLevel } from '@/lib/geo/admin-area-of-point';
import { AREA_LISTINGS_INDEX } from '@/services/market/area-market-page.service';
import { indexesMatching, indexOrderOf, readCompositeIndexes } from '@/test-utils/firestore-indexes';
import { AREA_MARKET_LEVELS } from '@/types/area-market';

jest.mock('server-only', () => ({}));

const INDEXES = readCompositeIndexes();

describe('Δ — η προεπισκόπηση αγγελιών έχει τον δείκτη της σε κάθε βαθμίδα', () => {
  it.each(AREA_MARKET_LEVELS)('Δ-1 βαθμίδα %i: ακριβώς ένας δείκτης με τα πεδία και τη φορά του ερωτήματος', (level) => {
    const field = adminAreaFieldOfLevel(level);
    if (field === null) throw new Error(`βαθμίδα ${level} χωρίς πεδίο`);
    const expected = [
      { fieldPath: `adminArea.${field}`, order: 'ASCENDING' as const },
      { fieldPath: AREA_LISTINGS_INDEX.orderBy.field, order: indexOrderOf(AREA_LISTINGS_INDEX.orderBy.direction) },
    ];

    expect(indexesMatching(INDEXES, COLLECTIONS.PUBLIC_LISTINGS, 'COLLECTION', expected)).toHaveLength(1);
  });

  it('Δ-2 κάθε βαθμίδα με σελίδα έχει πεδίο απόδοσης', () => {
    expect(AREA_MARKET_LEVELS.map(adminAreaFieldOfLevel)).not.toContain(null);
  });
});
