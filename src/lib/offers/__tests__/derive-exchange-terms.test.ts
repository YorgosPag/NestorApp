/**
 * @fileoverview **Ο ΟΡΟΣ ΤΗΣ ΑΝΤΙΠΑΡΟΧΗΣ ΦΤΑΝΕΙ ΣΤΗ ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ** (ADR-777 §8.60.17) — ανάγνωση + κρίκος 12.
 *
 * 🔴 Ως τις 2026-09-18 το ποσοστό οικοπεδούχου ήταν **δηλωμένη απώλεια** της προβολής. Εδώ φυλάσσονται
 * τα δύο άκρα της διαδρομής: η **ανάγνωση** των διαθέσεων (μόνο ζωντανές, `null` ⇔ καμία αντιπαροχή)
 * και ο **κρίκος 12** που δίνει στα παλιά έγγραφα την αλήθεια τους («προς συζήτηση», όχι «δεν υπάρχει»).
 */

import type { ExchangeOffer, PropertyOffer } from '@/types/property-offers';
import { upgradeListingDocument, type StoredListingDocument } from '@/lib/listings/public-listing-schema';

import { deriveExchangeTerms } from '../derive-exchange-terms';

const AT = '2026-09-18T00:00:00.000Z';

function exchange(overrides: Partial<ExchangeOffer> = {}): PropertyOffer {
  return {
    kind: 'exchange',
    lifecycle: 'active',
    percentage: 40,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  } as PropertyOffer;
}

const SELL: PropertyOffer = {
  kind: 'sell',
  lifecycle: 'active',
  askingPrice: 200_000,
  finalPrice: null,
  createdAt: AT,
  updatedAt: AT,
} as PropertyOffer;

describe('deriveExchangeTerms — μόνο ζωντανή αντιπαροχή, `null` ⇔ καμία', () => {
  it('ζωντανή αντιπαροχή ⇒ το ποσοστό του οικοπεδούχου', () => {
    expect(deriveExchangeTerms([SELL, exchange()])).toEqual({ landownerShare: 40 });
  });

  it('χωρίς ποσοστό ⇒ `{ landownerShare: null }` — «προς συζήτηση», όχι `null`', () => {
    expect(deriveExchangeTerms([exchange({ percentage: null })])).toEqual({ landownerShare: null });
  });

  it('🔴 αποσυρμένη αντιπαροχή ⇒ `null`: το ιστορικό δεν βάφει την οθόνη', () => {
    expect(deriveExchangeTerms([exchange({ lifecycle: 'withdrawn' })])).toBeNull();
  });

  it('καμία αντιπαροχή / καμία διάθεση ⇒ `null`', () => {
    expect(deriveExchangeTerms([SELL])).toBeNull();
    expect(deriveExchangeTerms(null)).toBeNull();
  });
});

describe('κρίκος 12 — τα παλιά έγγραφα αποκτούν το κουτί με την ΑΛΗΘΕΙΑ τους', () => {
  const v11 = (fields: Record<string, unknown>): StoredListingDocument => ({ schemaVersion: 11, ...fields });

  it('αγγελία ΜΕ αντιπαροχή ⇒ `{ landownerShare: null }` (δεν προβλήθηκε ποτέ — προς συζήτηση)', () => {
    expect(upgradeListingDocument(v11({ offerKinds: ['exchange'] })).exchange).toEqual({ landownerShare: null });
  });

  it('αγγελία ΧΩΡΙΣ αντιπαροχή ⇒ `null`', () => {
    expect(upgradeListingDocument(v11({ offerKinds: ['sell'] })).exchange).toBeNull();
  });

  it('ιδιοδύναμος: έγκυρο κουτί περνά αυτούσιο', () => {
    const doc = v11({ offerKinds: ['exchange'], exchange: { landownerShare: 35 } });
    expect(upgradeListingDocument(doc).exchange).toEqual({ landownerShare: 35 });
  });
});
