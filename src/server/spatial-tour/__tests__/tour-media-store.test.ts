/**
 * Άγκυρα του ΕΝΑ επιλογέα κάδου μέσων της περιήγησης (ADR-884 Φ2ζ ζ5 · §12 Δ11) — μεταφέρθηκε αυτούσια από τη σουίτα
 * της παλιάς προμήθειας όταν αυτή γενικεύτηκε (ADR-895 Α5): ο επιλογέας δεν είναι προμήθεια.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => ({ name: 'default-bucket' }),
  getTourMediaBucket: () => ({ name: 'tour-media-bucket' }),
}));

import { tourMediaBucket } from '../tour-media-store';

describe('Ε — ο ΕΝΑΣ επιλογέας κάδου', () => {
  it('`tour-eu` ⇒ κάδος μέσων · `legacy-default` / απόν ⇒ ο κανονικός (έγγραφα πριν το ζ5)', () => {
    expect(tourMediaBucket('tour-eu')).toEqual({ name: 'tour-media-bucket' });
    expect(tourMediaBucket('legacy-default')).toEqual({ name: 'default-bucket' });
    expect(tourMediaBucket(undefined)).toEqual({ name: 'default-bucket' });
  });
});
