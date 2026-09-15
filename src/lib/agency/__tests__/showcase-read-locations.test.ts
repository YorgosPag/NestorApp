/**
 * ADR-841 §7 Α21.16 — το σύνορο ανάγνωσης της κάρτας: παλιό έγγραφο και σκουπίδι ΔΕΝ ρίχνουν τη σελίδα.
 */

import { readShowcase } from '../showcase-read';
import { readLocations, readStreetLine } from '../showcase-read-locations';
import { readLocationChannels } from '../showcase-card-channels-read';
import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import { toStoredShowcase } from '../showcase-read';

const STORED_LOCATION = {
  id: 'sloc_1',
  role: 'branch',
  label: 'Καλαμαριά',
  place: { landId: 'land_1', buildingId: null },
  position: { lat: 40.58, lng: 22.95 },
  street: { street: 'Κομνηνών', number: '4', postalCode: '55131' },
  hours: null,
  specialHours: [],
  channelKinds: ['email', 'phone', 'fax'],
  emailConfirmedAt: '2026-09-10T08:00:00.000Z',
};

describe('readLocations', () => {
  it('🔴 παλιό έγγραφο ΧΩΡΙΣ πεδίο → [] (CHECK 3.74: ποτέ λευκή σελίδα)', () => {
    const { locations: _dropped, ...legacy } = toStoredShowcase(showcaseFixture());
    const read = readShowcase(legacy, 'comp_x');
    expect(read.outcome).toBe('showcase');
    if (read.outcome === 'showcase') expect(read.showcase.locations).toEqual([]);
  });

  it('round-trip μέσω του δίσκου', () => {
    const [location] = readLocations([STORED_LOCATION]);
    expect(location).toEqual({ ...STORED_LOCATION, channelKinds: ['phone', 'email'] });
  });

  it('χαλασμένο κατάστημα παραλείπεται, τα υπόλοιπα μένουν — και η έδρα πάει πρώτη', () => {
    const read = readLocations([
      STORED_LOCATION,
      { ...STORED_LOCATION, id: 'sloc_broken', place: null },
      { ...STORED_LOCATION, id: 'sloc_hq', role: 'headquarters' },
    ]);
    expect(read.map(({ id }) => id)).toEqual(['sloc_hq', 'sloc_1']);
  });

  it('ταβάνι 10 και στην ανάγνωση', () => {
    const many = Array.from({ length: 14 }, (_, index) => ({ ...STORED_LOCATION, id: `sloc_${index}` }));
    expect(readLocations(many)).toHaveLength(10);
  });

  it('🔴 επιβεβαίωση χωρίς κανάλι email ή με άκυρη ημερομηνία → null (Α21.18)', () => {
    const [withoutEmail] = readLocations([{ ...STORED_LOCATION, channelKinds: ['phone'] }]);
    const [garbage] = readLocations([{ ...STORED_LOCATION, emailConfirmedAt: 'χθες' }]);
    const [legacy] = readLocations([{ ...STORED_LOCATION, emailConfirmedAt: undefined }]);
    expect([withoutEmail.emailConfirmedAt, garbage.emailConfirmedAt, legacy.emailConfirmedAt]).toEqual([null, null, null]);
  });

  it('μισή οδός → null («μόνο περιοχή»), ποτέ μισή διεύθυνση', () => {
    expect(readStreetLine({ street: 'Κομνηνών', number: '4', postalCode: '' })).toBeNull();
  });
});

describe('readLocationChannels', () => {
  it('απόν έγγραφο / κατάστημα → κενά κανάλια', () => {
    const empty = { phones: [], emails: [], emailConfirmations: [] };
    expect(readLocationChannels(undefined, 'sloc_1')).toEqual(empty);
    expect(readLocationChannels({ locations: {} }, 'sloc_1')).toEqual(empty);
  });

  it('🔴 επιβεβαίωση διεύθυνσης που ΔΕΝ είναι πια στα emails δεν διαβάζεται (Α21.18)', () => {
    const raw = {
      locations: {
        sloc_1: {
          phones: [],
          emails: ['a@b.gr'],
          emailConfirmations: [
            { email: 'a@b.gr', confirmedAt: '2026-09-10T08:00:00.000Z' },
            { email: 'gone@b.gr', confirmedAt: '2026-09-11T08:00:00.000Z' },
            { email: 'a@b.gr' },
          ],
        },
      },
    };
    expect(readLocationChannels(raw, 'sloc_1').emailConfirmations).toEqual([
      { email: 'a@b.gr', confirmedAt: '2026-09-10T08:00:00.000Z' },
    ]);
  });

  it('διαβάζει μόνο το ζητούμενο κατάστημα', () => {
    const raw = {
      locations: {
        sloc_1: { phones: [{ e164: '+302310123456', extension: null }], emails: ['a@b.gr'] },
        sloc_2: { phones: [{ e164: '+306900000000', extension: null }], emails: [] },
      },
    };
    expect(readLocationChannels(raw, 'sloc_1')).toEqual({
      phones: [{ e164: '+302310123456', extension: null }],
      emails: ['a@b.gr'],
      emailConfirmations: [],
    });
  });
});
