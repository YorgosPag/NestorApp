/**
 * Tests — τοπική επίλυση GeoIP (ADR-894).
 *
 * Κάθε άγκυρα εδώ φυλά μια υπόσχεση του ADR: (1) ιδιωτική διεύθυνση **δεν** παίρνει τοποθεσία,
 * (2) βάση που λείπει **υποβαθμίζει**, δεν ρίχνει, (3) η βάση **δεν** ανοίγει για διεύθυνση που δεν
 * θα ρωτηθεί ποτέ, (4) η προέλευση βγαίνει από το ίδιο το αρχείο.
 */

jest.mock('maxmind', () => ({ open: jest.fn() }));

import { open } from 'maxmind';
import type { CityResponse } from 'maxmind';

import {
  geoIpSourceOf,
  placeFromRecord,
  resetGeoIpReaderForTests,
  resolveIpPlace,
  resolveIpPlaceWith,
  type GeoIpReader,
} from '../ip-geolocation';

const openMock = open as jest.MockedFunction<typeof open>;

const PUBLIC_IP = '8.8.8.8';
const SOURCE = { database: 'DBIP-City-Lite', edition: '2026-09' };

const THESSALONIKI = {
  country: { iso_code: 'GR', geoname_id: 390903, names: { en: 'Greece' } },
  city: { geoname_id: 734077, names: { en: 'Thessaloniki' } },
  subdivisions: [{ iso_code: 'B', geoname_id: 1, names: { en: 'Central Macedonia' } }],
} as unknown as CityResponse;

function fakeReader(record: CityResponse | null, fail = false): GeoIpReader {
  return {
    get: jest.fn(() => {
      if (fail) throw new Error('bad address');
      return record;
    }),
    metadata: {
      databaseType: 'DBIP-City-Lite',
      buildEpoch: new Date('2026-09-01T00:00:00Z'),
    } as GeoIpReader['metadata'],
  };
}

describe('placeFromRecord', () => {
  it('πόλη + χώρα + περιφέρεια ⇒ precision city', () => {
    expect(placeFromRecord(THESSALONIKI, SOURCE)).toEqual({
      countryCode: 'GR', city: 'Thessaloniki', region: 'Central Macedonia',
      precision: 'city', basis: 'geoip', source: SOURCE,
    });
  });

  it('μόνο χώρα ⇒ precision country, χωρίς επινοημένη πόλη', () => {
    const onlyCountry = { country: { iso_code: 'cy', geoname_id: 1, names: { en: 'Cyprus' } } } as unknown as CityResponse;
    expect(placeFromRecord(onlyCountry, SOURCE)).toMatchObject({ countryCode: 'CY', city: null, precision: 'country' });
  });

  it('καμία εγγραφή ή άκυρος κωδικός ⇒ no-match, ποτέ εφεδρική «Ελλάδα»', () => {
    expect(placeFromRecord(null, SOURCE)).toMatchObject({ countryCode: null, precision: 'none', basis: 'no-match' });
    const junk = { country: { iso_code: 'ZZZ', geoname_id: 1, names: { en: '?' } } } as unknown as CityResponse;
    expect(placeFromRecord(junk, SOURCE).countryCode).toBeNull();
  });
});

describe('resolveIpPlaceWith', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['192.168.1.20', 'ιδιωτικό LAN'],
    ['100.64.3.9', 'CGNAT'],
    ['::1', 'IPv6 loopback'],
    ['fd12:3456::1', 'IPv6 ULA'],
  ])('%s (%s) ⇒ non-public-address, χωρίς να ρωτηθεί η βάση', (ip) => {
    const reader = fakeReader(THESSALONIKI);
    expect(resolveIpPlaceWith(reader, ip)).toMatchObject({ precision: 'none', basis: 'non-public-address', source: null });
    expect(reader.get).not.toHaveBeenCalled();
  });

  it('χωρίς διεύθυνση ⇒ no-address', () => {
    expect(resolveIpPlaceWith(fakeReader(THESSALONIKI), 'unknown').basis).toBe('no-address');
    expect(resolveIpPlaceWith(fakeReader(THESSALONIKI), '').basis).toBe('no-address');
  });

  it('δημόσια διεύθυνση χωρίς βάση ⇒ database-unavailable', () => {
    expect(resolveIpPlaceWith(null, PUBLIC_IP)).toMatchObject({ precision: 'none', basis: 'database-unavailable' });
  });

  it('δημόσια διεύθυνση με βάση ⇒ πόλη, με την προέλευση του αρχείου', () => {
    expect(resolveIpPlaceWith(fakeReader(THESSALONIKI), PUBLIC_IP)).toMatchObject({
      countryCode: 'GR', city: 'Thessaloniki', source: SOURCE,
    });
  });

  it('ο αναγνώστης ρίχνει ⇒ no-match, όχι εξαίρεση', () => {
    expect(resolveIpPlaceWith(fakeReader(null, true), PUBLIC_IP)).toMatchObject({ basis: 'no-match', source: SOURCE });
  });
});

describe('geoIpSourceOf', () => {
  it('η έκδοση είναι ο μήνας του buildEpoch', () => {
    expect(geoIpSourceOf(fakeReader(null))).toEqual(SOURCE);
  });
});

describe('resolveIpPlace — ο αναγνώστης της διεργασίας', () => {
  beforeEach(() => {
    resetGeoIpReaderForTests();
    openMock.mockReset();
  });

  it('η βάση λείπει ⇒ υποβάθμιση, και καμία νέα απόπειρα ανοίγματος σε κάθε αίτημα', async () => {
    openMock.mockRejectedValue(new Error('ENOENT'));
    await expect(resolveIpPlace(PUBLIC_IP)).resolves.toMatchObject({ basis: 'database-unavailable' });
    await expect(resolveIpPlace(PUBLIC_IP)).resolves.toMatchObject({ basis: 'database-unavailable' });
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('ιδιωτική διεύθυνση δεν ανοίγει καν τη βάση', async () => {
    await expect(resolveIpPlace('10.0.0.5')).resolves.toMatchObject({ basis: 'non-public-address' });
    expect(openMock).not.toHaveBeenCalled();
  });

  it('η βάση ανοίγει μία φορά, με παρακολούθηση ενημερώσεων, και απαντά', async () => {
    openMock.mockResolvedValue(fakeReader(THESSALONIKI) as unknown as Awaited<ReturnType<typeof open>>);
    await resolveIpPlace(PUBLIC_IP);
    await expect(resolveIpPlace('1.1.1.1')).resolves.toMatchObject({ city: 'Thessaloniki' });
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock.mock.calls[0][1]).toMatchObject({ watchForUpdates: true });
  });
});
