/**
 * ADR-898 §23 — **σε ποια διάθεση έχει θέση η αντικειμενική**: μόνο πώληση, με λόγο σε κάθε κελί.
 */

import { OFFER_KINDS } from '@/types/property-offers';

import { OBJECTIVE_VALUE_OF_OFFER_KIND, offersObjectiveValue } from '../objective-value-offer-kinds';

describe('OBJECTIVE_VALUE_OF_OFFER_KIND — ένα κελί ανά διάθεση, κανένα σιωπηλό', () => {
  it('κάθε διάθεση του λεξιλογίου απαντά, με λόγο', () => {
    for (const kind of OFFER_KINDS) {
      expect(OBJECTIVE_VALUE_OF_OFFER_KIND[kind].reason.length).toBeGreaterThan(0);
    }
  });

  it('🔴 μόνο η πώληση τη δείχνει (απόφαση Giorgio 2026-11-21)', () => {
    expect(OFFER_KINDS.filter((kind) => OBJECTIVE_VALUE_OF_OFFER_KIND[kind].shown)).toEqual(['sell']);
  });
});

describe('offersObjectiveValue — ο ΕΝΑΣ κριτής', () => {
  it.each([
    [['sell'], true],
    [['leaseOut', 'sell'], true],
    [['leaseOut'], false],
    [['leaseShort'], false],
    [['exchange'], false],
    [[], false],
  ] as const)('%j ⇒ %s', (offerKinds, expected) => {
    expect(offersObjectiveValue(offerKinds)).toBe(expected);
  });
});
