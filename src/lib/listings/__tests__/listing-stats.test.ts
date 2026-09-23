/**
 * ADR-777 §8.72 — η καθαρή λογική των στατιστικών αγγελίας.
 *
 * Κάθε άγκυρα ρωτά κάτι που θα έλεγε **ψέμα στον κάτοχο** αν χαλούσε: λάθος μέρα (UTC αντί Αθήνας),
 * «0» αντί «δεν ξέρουμε», σύνολο που **μειώνεται**, τάση από το μηδέν.
 */

import {
  LISTING_VIEWS_TRACKING_EPOCH,
  contactsPerThousandViews,
  countingSinceOf,
  daysOnMarket,
  ephemeralExpiryOf,
  listingTrend,
  listingViewPath,
  marketDayOf,
  marketDaysBetween,
  mergeDaily,
  shiftMarketDay,
  trimDaily,
  windowSum,
} from '../listing-stats';

describe('marketDayOf — η ημέρα είναι ΑΘΗΝΑΣ, όχι UTC', () => {
  it('23:30 UTC το καλοκαίρι είναι ΗΔΗ η επόμενη μέρα στην Αθήνα (UTC+3)', () => {
    expect(marketDayOf(Date.parse('2026-09-23T21:30:00Z'))).toBe('2026-09-24');
  });

  it('21:30 UTC τον χειμώνα είναι ακόμη η ίδια μέρα; όχι — 23:30 Αθήνας (UTC+2)', () => {
    expect(marketDayOf(Date.parse('2026-12-01T21:30:00Z'))).toBe('2026-12-01');
    expect(marketDayOf(Date.parse('2026-12-01T22:30:00Z'))).toBe('2026-12-02');
  });
});

describe('shiftMarketDay — αριθμητική πάνω στην ημερομηνία, όχι σε ώρες', () => {
  it('δεν χάνει/διπλασιάζει μέρα στην αλλαγή ώρας (25/10/2026)', () => {
    expect(shiftMarketDay('2026-10-24', 1)).toBe('2026-10-25');
    expect(shiftMarketDay('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftMarketDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('άκυρη ημέρα ⇒ ρητό σφάλμα, ποτέ «Invalid Date» που ταξιδεύει', () => {
    expect(() => shiftMarketDay('not-a-day', 1)).toThrow();
  });

  it('marketDaysBetween — συμπεριλαμβανομένων των άκρων, κενό αν ανάποδα', () => {
    expect(marketDaysBetween('2026-09-29', '2026-10-01')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(marketDaysBetween('2026-10-02', '2026-10-01')).toEqual([]);
  });
});

describe('daysOnMarket — άγνωστο ΔΕΝ είναι 0', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');

  it('γνωστή σφραγίδα ⇒ συμπληρωμένες μέρες', () => {
    expect(daysOnMarket({ kind: 'known', at: '2026-10-01T09:00:00Z' }, now)).toBe(9);
  });

  it('άγνωστη ή απούσα σφραγίδα ⇒ null, όχι «μόλις μπήκε»', () => {
    expect(daysOnMarket({ kind: 'unknown', reason: 'predates-record' }, now)).toBeNull();
    expect(daysOnMarket(undefined, now)).toBeNull();
  });
});

describe('σειρές και παράθυρα', () => {
  const daily = { '2026-10-01': 2, '2026-10-05': 3, '2026-10-09': 4 };

  it('windowSum — μόνο ημέρες μέσα στο [from, to]', () => {
    expect(windowSum(daily, '2026-10-05', '2026-10-09')).toBe(7);
    expect(windowSum(daily, '2026-10-06', '2026-10-08')).toBe(0);
  });

  it('trimDaily — κόβει ό,τι είναι παλαιότερο', () => {
    expect(trimDaily(daily, '2026-10-05')).toEqual({ '2026-10-05': 3, '2026-10-09': 4 });
  });

  it('mergeDaily — ίδια μέρα ⇒ άθροισμα (σύνοψη + ζωντανή σημερινή)', () => {
    expect(mergeDaily({ '2026-10-09': 4 }, { '2026-10-09': 1, '2026-10-10': 2 })).toEqual({ '2026-10-09': 5, '2026-10-10': 2 });
  });
});

describe('countingSinceOf — από πότε ΜΕΤΡΑΜΕ αυτή την αγγελία', () => {
  it('πριν από την εποχή καταγραφής ⇒ η εποχή (δεν «είχε 0» τότε)', () => {
    expect(countingSinceOf({ kind: 'known', at: '2025-01-01T00:00:00Z' })).toBe(LISTING_VIEWS_TRACKING_EPOCH);
    expect(countingSinceOf(undefined)).toBe(LISTING_VIEWS_TRACKING_EPOCH);
  });

  it('μετά την εποχή ⇒ η ημέρα αγοράς της δημοσίευσης', () => {
    expect(countingSinceOf({ kind: 'known', at: '2026-11-03T22:30:00Z' })).toBe('2026-11-04');
  });
});

describe('listingTrend — ποτέ ποσοστό από το μηδέν', () => {
  it.each([
    [0, 0, 'none'],
    [5, 0, 'new'],
    [12, 10, 'up'],
    [8, 10, 'down'],
    [10, 10, 'flat'],
    [105, 100, 'flat'],
  ] as const)('%i vs %i ⇒ %s', (current, previous, kind) => {
    expect(listingTrend(current, previous).kind).toBe(kind);
  });
});

describe('contactsPerThousandViews — ο δείκτης του idealista', () => {
  it('ορίζεται μόνο με προβολές', () => {
    expect(contactsPerThousandViews(500, 2)).toBe(4);
    expect(contactsPerThousandViews(0, 2)).toBeNull();
  });
});

describe('συμβόλαιο σύρματος και λήξεις', () => {
  it('η διαδρομή του beacon κωδικοποιεί την ταυτότητα', () => {
    expect(listingViewPath('ownp_a/b')).toBe('/api/public-listings/ownp_a%2Fb/view');
  });

  it('ephemeralExpiryOf — μεσάνυχτα UTC, N μέρες μετά', () => {
    expect(ephemeralExpiryOf('2026-10-10', 2).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});
