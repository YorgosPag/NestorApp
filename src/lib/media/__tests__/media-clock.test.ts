/**
 * @fileoverview **Το ρολόι ενός μέσου** — μία συνάρτηση, δύο καταναλωτές (player του χώρου · βίντεο της αγγελίας).
 *
 * Μεταλλάξεις που πρέπει να πιάσει: στρογγύλεμα προς τα πάνω (`59,9` → `1:00` ενώ δεν έχει παιχτεί), χαμένο μηδενικό
 * γέμισμα (`1:5`), ώρες που διπλομετρούν τα λεπτά, και μη πεπερασμένη είσοδος που τυπώνει `NaN:NaN`.
 */

import { formatTime } from '@/components/shared/files/media/useVideoPlayerState';

import { formatMediaClock } from '../media-clock';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('formatMediaClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59.9, '0:59'],
    [60, '1:00'],
    [105.4, '1:45'],
    [120, '2:00'],
    [3599, '59:59'],
    [3723, '1:02:03'],
  ])('%s″ → %s', (seconds, expected) => {
    expect(formatMediaClock(seconds)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('μη έγκυρη είσοδος (%s) ⇒ 0:00, ποτέ NaN', (seconds) => {
    expect(formatMediaClock(seconds)).toBe('0:00');
  });

  it('🔑 ο player του χώρου ζητά ΤΗΝ ΙΔΙΑ συνάρτηση — όχι δεύτερο σώμα', () => {
    expect(formatTime).toBe(formatMediaClock);
  });
});
