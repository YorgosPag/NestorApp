/** ADR-835 §21 — δημόσια πόρτα ⇒ κλειστά όρια σε κάθε διάσταση. */

import {
  STAY_PUBLIC_MAX_LISTINGS,
  stayAnswersRequestFrom,
  stayNightsRequestFrom,
} from '@/lib/stay/stay-public-request';

describe('stayNightsRequestFrom', () => {
  it('δέχεται μήνα και 1..3 μήνες (προεπιλογή 1)', () => {
    expect(stayNightsRequestFrom('2027-09', null)).toEqual({ ok: true, value: { fromMonth: '2027-09', months: 1 } });
    expect(stayNightsRequestFrom('2027-09', '3').ok).toBe(true);
  });

  it.each([['2027-13', '1'], ['2027-09', '4'], ['2027-09', '0'], [null, '1'], ['2027-09', '1.5']])(
    '🔴 from=%s months=%s ⇒ malformed',
    (from, months) => {
      expect(stayNightsRequestFrom(from, months).ok).toBe(false);
    },
  );
});

describe('stayAnswersRequestFrom', () => {
  const body = { listingIds: ['ownp_a'], checkIn: '2027-09-10', checkOut: '2027-09-12', guests: null };

  it('έγκυρο σώμα', () => {
    expect(stayAnswersRequestFrom(body)).toEqual({
      ok: true,
      value: { listingIds: ['ownp_a'], query: { checkIn: '2027-09-10', checkOut: '2027-09-12', guests: null } },
    });
  });

  it.each([
    ['πάρα πολλές αγγελίες', { listingIds: Array.from({ length: STAY_PUBLIC_MAX_LISTINGS + 1 }, (_, i) => `ownp_${i}`) }],
    ['διπλή αγγελία', { listingIds: ['ownp_a', 'ownp_a'] }],
    ['ταυτότητα με κάθετο', { listingIds: ['../x'] }],
    ['ανάποδο διάστημα', { checkIn: '2027-09-12', checkOut: '2027-09-10' }],
    ['0 άτομα', { guests: 0 }],
  ])('🔴 %s ⇒ malformed', (_, patch) => {
    expect(stayAnswersRequestFrom({ ...body, ...patch }).ok).toBe(false);
  });
});
