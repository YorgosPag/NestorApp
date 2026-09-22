/**
 * Ο κριτής του search index — **καθαρός, χωρίς κανένα mock** (ADR-873 Φ1 Στάδιο 1).
 *
 * Η καρδιά της σημασιολογίας ελέγχεται εδώ· η μηχανική της Firestore ελέγχεται χωριστά στα
 * `functions/src/search/__tests__/search-index-writer.test.ts`. Αυτό είναι επίτηδες: ένα test
 * που χρειάζεται fake βάση για να απαντήσει «ποια έκδοση κερδίζει;» ρωτά λάθος ερώτηση.
 *
 * @module lib/search/__tests__/search-index-version
 */

import {
  SEARCH_TOMBSTONE_TTL_MS,
  compareCommitVersions,
  isoToCommitVersion,
  searchTombstoneExpiryMs,
  shouldApplySearchIndexTombstone,
  shouldApplySearchIndexWrite,
  toCommitVersion,
  type CommitVersion,
} from '../search-index-version';

const v = (seconds: number, nanoseconds = 0): CommitVersion => ({ seconds, nanoseconds });

describe('toCommitVersion', () => {
  it('διαβάζει ένα Timestamp-like αντικείμενο', () => {
    expect(toCommitVersion({ seconds: 5, nanoseconds: 7 })).toEqual({ seconds: 5, nanoseconds: 7 });
  });

  it('αγνοεί επιπλέον πεδία (ένα πραγματικό Timestamp έχει και μεθόδους)', () => {
    expect(toCommitVersion({ seconds: 1, nanoseconds: 2, toDate: () => new Date() })).toEqual(
      { seconds: 1, nanoseconds: 2 },
    );
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', '2026-09-22T10:00:00Z'],
    ['number', 1758537600],
    ['κενό αντικείμενο', {}],
    ['μισό αντικείμενο', { seconds: 5 }],
  ])('επιστρέφει null για %s', (_label, input) => {
    expect(toCommitVersion(input)).toBeNull();
  });

  it('🔴 NaN ΔΕΝ είναι χρόνος — αλλιώς κάθε σύγκριση απαντά σιωπηλά «όχι νεότερο»', () => {
    expect(toCommitVersion({ seconds: NaN, nanoseconds: 0 })).toBeNull();
    expect(toCommitVersion({ seconds: 0, nanoseconds: Infinity })).toBeNull();
  });
});

describe('isoToCommitVersion', () => {
  it('διαβάζει ISO-8601 με χιλιοστά', () => {
    expect(isoToCommitVersion('2026-09-22T10:00:00.250Z')).toEqual({
      seconds: Math.floor(Date.parse('2026-09-22T10:00:00.250Z') / 1000),
      nanoseconds: 250_000_000,
    });
  });

  it('διατηρεί τη σειρά δύο γεγονότων του ίδιου δευτερολέπτου', () => {
    const early = isoToCommitVersion('2026-09-22T10:00:00.100Z');
    const late = isoToCommitVersion('2026-09-22T10:00:00.900Z');
    expect(compareCommitVersions(late!, early!)).toBe(1);
  });

  it.each([null, undefined, '', 'όχι ημερομηνία', 42])('επιστρέφει null για %p', (input) => {
    expect(isoToCommitVersion(input as string)).toBeNull();
  });
});

describe('compareCommitVersions', () => {
  it('συγκρίνει πρώτα δευτερόλεπτα', () => {
    expect(compareCommitVersions(v(10), v(9))).toBe(1);
    expect(compareCommitVersions(v(9), v(10))).toBe(-1);
  });

  it('σπάει την ισοπαλία με τα nanoseconds — δύο commits του ίδιου δευτερολέπτου', () => {
    expect(compareCommitVersions(v(10, 500), v(10, 499))).toBe(1);
    expect(compareCommitVersions(v(10, 499), v(10, 500))).toBe(-1);
    expect(compareCommitVersions(v(10, 500), v(10, 500))).toBe(0);
  });
});

describe('shouldApplySearchIndexWrite', () => {
  it('γράφει όταν δεν υπάρχει τίποτα στο ευρετήριο', () => {
    expect(shouldApplySearchIndexWrite(null, v(10))).toBe(true);
  });

  it('γράφει όταν η αποθηκευμένη έκδοση είναι παλιότερη', () => {
    expect(shouldApplySearchIndexWrite({ sourceUpdateTime: v(9) }, v(10))).toBe(true);
  });

  it('🔴 ΔΕΝ γράφει όταν η αποθηκευμένη είναι νεότερη — το καθυστερημένο E1 μετά το E2', () => {
    expect(shouldApplySearchIndexWrite({ sourceUpdateTime: v(11) }, v(10))).toBe(false);
  });

  it('ΔΕΝ γράφει το ίδιο commit δεύτερη φορά — αυτό είναι το διπλότυπο', () => {
    expect(shouldApplySearchIndexWrite({ sourceUpdateTime: v(10, 42) }, v(10, 42))).toBe(false);
  });

  it('🏆 ΔΕΝ γράφει πάνω σε νεότερη ταφόπλακα — εδώ πεθαίνει το μόνιμο φάντασμα', () => {
    expect(
      shouldApplySearchIndexWrite({ sourceUpdateTime: v(11), deleted: true }, v(10)),
    ).toBe(false);
  });

  it('γράφει πάνω σε παλιότερη ταφόπλακα — η οντότητα ξαναδημιουργήθηκε', () => {
    expect(
      shouldApplySearchIndexWrite({ sourceUpdateTime: v(9), deleted: true }, v(10)),
    ).toBe(true);
  });

  it('γράφει όταν η αποθηκευμένη έκδοση λείπει (έγγραφο πριν το ADR-873)', () => {
    expect(shouldApplySearchIndexWrite({}, v(10))).toBe(true);
    expect(shouldApplySearchIndexWrite({ sourceUpdateTime: null }, v(10))).toBe(true);
  });

  it('γράφει όταν η εισερχόμενη έκδοση είναι άγνωστη — ποτέ σιωπηλή παράλειψη', () => {
    expect(shouldApplySearchIndexWrite({ sourceUpdateTime: v(99) }, null)).toBe(true);
  });
});

describe('shouldApplySearchIndexTombstone', () => {
  it('🏆 γράφει ταφόπλακα ΚΑΙ όταν δεν υπάρχει τίποτα — αυστηρότερο από την Elasticsearch', () => {
    expect(shouldApplySearchIndexTombstone(null, v(10))).toBe(true);
  });

  it('σβήνει την έκδοση που κάθεται στο ευρετήριο (ίδιο commit)', () => {
    expect(shouldApplySearchIndexTombstone({ sourceUpdateTime: v(10) }, v(10))).toBe(true);
  });

  it('σβήνει παλιότερη εγγραφή', () => {
    expect(shouldApplySearchIndexTombstone({ sourceUpdateTime: v(9) }, v(10))).toBe(true);
  });

  it('🔴 Ε-873.3: ΔΕΝ σβήνει νεότερη εγγραφή — η οντότητα ξαναδημιουργήθηκε', () => {
    expect(shouldApplySearchIndexTombstone({ sourceUpdateTime: v(11) }, v(10))).toBe(false);
  });

  it('ΔΕΝ ξαναγράφει την ίδια ταφόπλακα (διπλότυπο της ίδιας διαγραφής)', () => {
    expect(
      shouldApplySearchIndexTombstone({ sourceUpdateTime: v(10), deleted: true }, v(10)),
    ).toBe(false);
  });

  it('γράφει ταφόπλακα πάνω σε παλιότερη ταφόπλακα (δεύτερος κύκλος ζωής)', () => {
    expect(
      shouldApplySearchIndexTombstone({ sourceUpdateTime: v(9), deleted: true }, v(10)),
    ).toBe(true);
  });

  it('γράφει όταν η έκδοση είναι άγνωστη — ένα φάντασμα δεν είναι αναστρέψιμο', () => {
    expect(shouldApplySearchIndexTombstone({}, v(10))).toBe(true);
    expect(shouldApplySearchIndexTombstone({ sourceUpdateTime: v(99) }, null)).toBe(true);
  });
});

describe('searchTombstoneExpiryMs', () => {
  it('καλύπτει ΟΛΟΚΛΗΡΟ το παράθυρο επαναλήψεων 1ης γενιάς (7 ημέρες)', () => {
    expect(SEARCH_TOMBSTONE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(searchTombstoneExpiryMs(1_000)).toBe(1_000 + SEARCH_TOMBSTONE_TTL_MS);
  });

  it('είναι τάξεις μεγέθους πάνω από το gc_deletes της Elasticsearch (60s)', () => {
    expect(SEARCH_TOMBSTONE_TTL_MS).toBeGreaterThan(60_000 * 1000);
  });
});
