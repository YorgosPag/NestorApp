/**
 * Tests — η τοποθεσία μιας συσκευής στη γλώσσα του αναγνώστη (ADR-894).
 *
 * Φυλάσσεται: (1) το όνομα χώρας έρχεται από το `Intl.DisplayNames` της γλώσσας, όχι από αποθηκευμένο κείμενο·
 * (2) ό,τι δεν ξέρουμε λέγεται «άγνωστη» — ποτέ εφεδρική χώρα.
 */

import type { IpPlace } from '@/lib/geo/ip-place.types';

import { sessionLocationLabel } from '../session-location-label';

const PLACE: IpPlace = {
  countryCode: 'GR', city: 'Thessaloniki', region: null, precision: 'city', basis: 'geoip', source: null,
};
const UNKNOWN = 'Άγνωστη τοποθεσία';

describe('sessionLocationLabel', () => {
  it('ίδια εγγραφή, δύο γλώσσες ⇒ δύο ονόματα χώρας', () => {
    expect(sessionLocationLabel(PLACE, new Intl.DisplayNames('el', { type: 'region' }), UNKNOWN)).toBe('Thessaloniki, Ελλάδα');
    expect(sessionLocationLabel(PLACE, new Intl.DisplayNames('en', { type: 'region' }), UNKNOWN)).toBe('Thessaloniki, Greece');
  });

  it('μόνο χώρα ⇒ μόνο χώρα', () => {
    const country: IpPlace = { ...PLACE, city: null, precision: 'country' };
    expect(sessionLocationLabel(country, new Intl.DisplayNames('el', { type: 'region' }), UNKNOWN)).toBe('Ελλάδα');
  });

  it.each<[string, IpPlace]>([
    ['ιδιωτική διεύθυνση', { ...PLACE, countryCode: null, city: null, precision: 'none', basis: 'non-public-address' }],
    ['παλιά εγγραφή', { ...PLACE, countryCode: null, city: null, precision: 'none', basis: 'legacy' }],
  ])('%s ⇒ «άγνωστη», ποτέ εφεδρική χώρα', (_label, place) => {
    expect(sessionLocationLabel(place, new Intl.DisplayNames('el', { type: 'region' }), UNKNOWN)).toBe(UNKNOWN);
  });

  it('ο πάροχος ονομάτων πετά ⇒ ο κωδικός, όχι σφάλμα', () => {
    const throwing = { of: () => { throw new RangeError('bad'); } };
    expect(sessionLocationLabel({ ...PLACE, precision: 'country' }, throwing, UNKNOWN)).toBe('GR');
  });
});
