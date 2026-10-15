/**
 * ADR-915 Φ4γ — `formatDateKey`: η ημέρα-κλειδί εμφανίζεται ως η ΙΔΙΑ ημέρα, σε κάθε ζώνη ώρας.
 */

import { formatDate, formatDateKey } from '@/lib/intl-formatting';

describe('formatDateKey', () => {
  it('χτίζει την ημέρα ως ΤΟΠΙΚΗ — όχι ως μεσάνυχτα UTC (που δυτικά του Greenwich γίνονται «χθες»)', () => {
    expect(formatDateKey('2026-07-16')).toBe(formatDate(new Date(2026, 6, 16)));
  });

  it('άκυρο κλειδί ⇒ αυτούσιο, ποτέ «Invalid Date»', () => {
    expect(formatDateKey('2026-02-30')).toBe('2026-02-30');
    expect(formatDateKey('not-a-date')).toBe('not-a-date');
  });
});
