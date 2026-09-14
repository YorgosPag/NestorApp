/**
 * ADR-832 §8 — **ΠΟΙΕΣ ΠΡΑΞΕΙΣ ΑΝΑΤΙΘΕΝΤΑΙ ΜΕ ΜΕΣΙΤΙΚΗ ΕΝΤΟΛΗ**.
 *
 * 🔴 Το περιστατικό: η φόρμα `/offers/mandate/new` πρόσφερε «Βραχυχρόνια μίσθωση» ως
 * πράξη εντολής, επειδή διάβαζε σκέτο το `OFFER_KINDS`. Κάθε ομάδα ξεκινά με
 * **παρονομαστή**, ώστε ένας πίνακας που απαντά πάντα «όχι» να μην περνά πράσινος.
 */

import {
  MANDATE_OFFER_KINDS,
  OFFER_KIND_ENGAGEMENT,
  OFFER_KIND_ENGAGEMENTS,
  isMandateOfferKind,
  mandateOfferKindsFor,
} from '@/constants/mandate-offer-kinds';
import { OFFER_KINDS } from '@/types/property-offers';

describe('Α — ο πίνακας απαντά για ΚΑΘΕ διάθεση', () => {
  it('🔑 Α0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε διάθεση έχει σύμβαση από το κλειστό σύνολο', () => {
    expect(Object.keys(OFFER_KIND_ENGAGEMENT).sort()).toEqual([...OFFER_KINDS].sort());
    for (const kind of OFFER_KINDS) {
      expect(OFFER_KIND_ENGAGEMENTS).toContain(OFFER_KIND_ENGAGEMENT[kind]);
    }
  });

  it('🔴 Α1 — πώληση, εκμίσθωση, αντιπαροχή ΑΝΑΤΙΘΕΝΤΑΙ· η βραχυχρόνια ΟΧΙ', () => {
    expect([...MANDATE_OFFER_KINDS]).toEqual(['sell', 'leaseOut', 'exchange']);
    expect(isMandateOfferKind('leaseShort')).toBe(false);
    expect(isMandateOfferKind('sell')).toBe(true);
  });
});

describe('Β — οι πράξεις της εντολής ανά είδος ακινήτου', () => {
  it('🔑 Β0 — άγνωστο είδος ⇒ ΟΛΕΣ οι πράξεις εντολής, ποτέ κενό', () => {
    expect(mandateOfferKindsFor(null)).toEqual(MANDATE_OFFER_KINDS);
    expect(mandateOfferKindsFor('')).toEqual(MANDATE_OFFER_KINDS);
  });

  it('🔴 Β1 — σε ΓΗ η αντιπαροχή προσφέρεται', () => {
    expect(mandateOfferKindsFor('plot')).toEqual(['sell', 'leaseOut', 'exchange']);
  });

  it('🔴 Β2 — σε ΚΑΤΟΙΚΙΑ ούτε αντιπαροχή ούτε βραχυχρόνια', () => {
    // ⚠️ Η βραχυχρόνια **έχει νόημα** σε κατοικία (`OFFER_KIND_CLASSES`) — και ΜΕΝΕΙ
    //    έξω. Αυτό αποδεικνύει ότι κόβεται από τον άξονα της ΣΥΜΒΑΣΗΣ, όχι του είδους.
    expect(mandateOfferKindsFor('apartment')).toEqual(['sell', 'leaseOut']);
  });
});
