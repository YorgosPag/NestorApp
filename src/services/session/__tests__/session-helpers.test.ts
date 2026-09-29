/**
 * Tests — ανάγνωση και εμφάνιση συνεδριών (ADR-894).
 *
 * Οι δύο υποσχέσεις που φυλάσσονται: (1) μια **παλιά** εγγραφή (τοποθεσία από τον browser/ipapi, σκληρό «GR»)
 * **δεν** εμφανίζεται ως γνώση· (2) «τρέχουσα συσκευή» είναι αλήθεια του **θεατή**, όχι του εγγράφου.
 */

import {
  computeSessionStatistics,
  formatSessionsForDisplay,
  mapDocToSession,
  readSessionLocation,
} from '../session-helpers';
import type { SessionLocation, UserSession } from '../session.types';

const NOW = new Date();
const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);

const THESSALONIKI: SessionLocation = {
  countryCode: 'GR', city: 'Thessaloniki', region: 'Central Macedonia', precision: 'city', basis: 'geoip',
  source: { database: 'DBIP-City-Lite', edition: '2026-09' }, ipFingerprint: 'fp-1',
};
const LAGOS: SessionLocation = { ...THESSALONIKI, countryCode: 'NG', city: 'Lagos', region: null, ipFingerprint: 'fp-2' };

function session(id: string, overrides: Partial<UserSession> = {}): UserSession {
  return {
    id,
    userId: 'u1',
    deviceInfo: { type: 'desktop', browser: 'Chrome 140', browserType: 'Chrome', os: 'Windows', osVersion: '10/11', userAgent: 'ua', language: 'el' },
    location: THESSALONIKI,
    timestamps: { createdAt: NOW, lastActiveAt: NOW, expiresAt: LATER },
    status: 'active',
    metadata: { loginMethod: 'email', rememberMe: false, twoFactorUsed: false, appVersion: 'x', source: 'web' },
    ...overrides,
  };
}

describe('readSessionLocation', () => {
  it('εγγραφή της εποχής ipapi (χωρίς precision) ⇒ legacy, ΧΩΡΙΣ χώρα/πόλη', () => {
    const legacy = { ipHash: 'abcd1234', countryCode: 'GR', countryName: 'Ελλάδα', city: 'Unknown', timezone: 'Europe/Athens', isApproximate: true };
    expect(readSessionLocation(legacy)).toEqual({
      countryCode: null, city: null, region: null, precision: 'none', basis: 'legacy', source: null, ipFingerprint: null,
    });
  });

  it('εγγραφή του server διαβάζεται όπως γράφτηκε', () => {
    expect(readSessionLocation(THESSALONIKI)).toEqual(THESSALONIKI);
  });

  it('άγνωστη ακρίβεια ⇒ legacy (fail-closed), όχι εικασία', () => {
    expect(readSessionLocation({ ...THESSALONIKI, precision: 'street' }).basis).toBe('legacy');
  });
});

describe('mapDocToSession', () => {
  it('κρατά την τελευταία θέση μόνο όταν υπάρχει', () => {
    const base = { id: 's1', userId: 'u1', location: THESSALONIKI, timestamps: {}, status: 'active' };
    expect(mapDocToSession(base).lastLocation).toBeUndefined();
    expect(mapDocToSession({ ...base, lastLocation: LAGOS }).lastLocation).toEqual(LAGOS);
  });
});

describe('formatSessionsForDisplay', () => {
  it('«τρέχουσα» είναι ΜΟΝΟ η εγγραφή αυτού του browser', () => {
    const items = formatSessionsForDisplay([session('s1'), session('s2')], 's2');
    expect(items.map((item) => [item.id, item.isCurrent])).toEqual([['s1', false], ['s2', true]]);
  });

  it('χωρίς γνωστή εγγραφή ⇒ καμία «τρέχουσα»', () => {
    expect(formatSessionsForDisplay([session('s1')], null)[0].isCurrent).toBe(false);
  });

  it('εμφανίζεται η ΤΕΛΕΥΤΑΙΑ θέση όταν η συσκευή άλλαξε δίκτυο', () => {
    expect(formatSessionsForDisplay([session('s1', { lastLocation: LAGOS })], null)[0].location.city).toBe('Lagos');
  });
});

describe('computeSessionStatistics', () => {
  it('μόνο οι ΓΝΩΣΤΕΣ τοποθεσίες μετρούν· οι ληγμένες δεν είναι ενεργές', () => {
    const unknown: SessionLocation = { ...THESSALONIKI, countryCode: null, city: null, precision: 'none', basis: 'non-public-address' };
    const stats = computeSessionStatistics([
      session('s1'),
      session('s2', { location: unknown }),
      session('s3', { location: unknown, timestamps: { createdAt: NOW, lastActiveAt: NOW, expiresAt: new Date(NOW.getTime() - 1) } }),
    ]);
    expect(stats.uniqueLocations).toBe(1);
    expect(stats.activeSessions).toBe(2);
  });
});
