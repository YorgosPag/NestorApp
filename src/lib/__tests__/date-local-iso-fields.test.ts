/**
 * `withIsoDateFields` — μετατροπή στιγμών ΜΟΝΟ στα δηλωμένα πεδία (ADR-218).
 *
 * Άγκυρα του σφάλματος «NaN €»: το πέρασμα κάθε πεδίου από `normalizeToISO`
 * έκανε το ποσό ημερομηνία του 1970 και το κείμενο ημερομηνία του 2001.
 */

import { normalizeToISO, withIsoDateFields } from '../date-local';

describe('withIsoDateFields', () => {
  const instant = '2026-11-03T08:00:00.000Z';

  it('αφήνει ανέγγιχτους τους αριθμούς', () => {
    const result = withIsoDateFields({ estimatedValue: 170000, probability: 40 }, ['createdAt']);
    expect(result).toEqual({ estimatedValue: 170000, probability: 40 });
  });

  it('αφήνει ανέγγιχτο κείμενο που το normalizeToISO θα έκανε ημερομηνία', () => {
    const title = 'Επίσκεψη στο T-D-2.02';
    expect(normalizeToISO(title)).not.toBeNull();
    expect(withIsoDateFields({ title }, ['createdAt'])).toEqual({ title });
  });

  it('μετατρέπει Date και Firestore Timestamp στα δηλωμένα πεδία', () => {
    const result = withIsoDateFields(
      { createdAt: new Date(instant), updatedAt: { toDate: () => new Date(instant) } },
      ['createdAt', 'updatedAt'],
    );
    expect(result).toEqual({ createdAt: instant, updatedAt: instant });
  });

  it('κρατά την τιμή δηλωμένου πεδίου που δεν λύνεται σε στιγμή', () => {
    expect(withIsoDateFields({ createdAt: 'άγνωστο' }, ['createdAt'])).toEqual({ createdAt: 'άγνωστο' });
  });

  it('δεν προσθέτει πεδία που λείπουν και δεν αλλάζει το αρχικό αντικείμενο', () => {
    const raw = { title: 'x', createdAt: new Date(instant) };
    const result = withIsoDateFields(raw, ['createdAt', 'wonDate']);
    expect(result).not.toHaveProperty('wonDate');
    expect(raw.createdAt).toBeInstanceOf(Date);
  });
});
