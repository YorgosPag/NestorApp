/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΚΟΥΠΟΝΙ ΘΕΑΣΗΣ** (ADR-884 Φ0.4 · Κ3β) — άγκυρες του κουπονιού και του κοινού πυρήνα.
 *
 * - **Κ** — ζωντανό, αυτής της περιήγησης, αυτού του σκοπού — ή τίποτα.
 * - **Δ** — 🔴 διαχωρισμός σκοπού: κουπόνι **κοινοποίησης** δεν διαβάζεται ποτέ ως κουπόνι **θέασης** (ένα μυστικό).
 * - **Μ** — χωρίς μυστικό: `null`, ποτέ πλαστό κουπόνι.
 */

jest.mock('server-only', () => ({}));

import { issueAccessGrant } from '@/server/access-grant/access-grant';
import { issueShareAccessGrant } from '@/server/sharing/share-access-grant';

import { issueTourViewGrant, readTourViewGrant, TOUR_VIEW_GRANT_TTL_SECONDS } from '../tour-view-grant';

const SECRET_ENV = 'SHARE_ACCESS_SECRET';
const NOW = Date.parse('2026-09-26T10:00:00.000Z');
const GRANT = { tourId: 'stour_a', basis: 'request', basisId: 'tacr_1' } as const;

beforeEach(() => {
  process.env[SECRET_ENV] = 'test-secret-with-enough-entropy-0123456789abcdef';
});

afterAll(() => {
  delete process.env[SECRET_ENV];
});

describe('Κ — το κουπόνι', () => {
  it('Κ1 — εκδίδεται και διαβάζεται για την ίδια περιήγηση', () => {
    const token = issueTourViewGrant(GRANT, NOW);
    expect(token).not.toBeNull();
    expect(readTourViewGrant(token!, 'stour_a', NOW + 1000)).toEqual(GRANT);
  });

  it('Κ2 — άλλη περιήγηση ⇒ τίποτα', () => {
    const token = issueTourViewGrant(GRANT, NOW)!;
    expect(readTourViewGrant(token, 'stour_b', NOW)).toBeNull();
  });

  it('Κ3 — λήγει στα 15′ ακριβώς', () => {
    const token = issueTourViewGrant(GRANT, NOW)!;
    expect(readTourViewGrant(token, 'stour_a', NOW + TOUR_VIEW_GRANT_TTL_SECONDS * 1000 - 1000)).not.toBeNull();
    expect(readTourViewGrant(token, 'stour_a', NOW + TOUR_VIEW_GRANT_TTL_SECONDS * 1000)).toBeNull();
  });

  it('Κ4 — αλλοιωμένο κουπόνι ⇒ τίποτα', () => {
    const token = issueTourViewGrant(GRANT, NOW)!;
    const tampered = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}${token.slice(-1)}`;
    expect(readTourViewGrant(tampered, 'stour_a', NOW)).toBeNull();
  });
});

describe('Δ — ένα μυστικό, δύο σκοποί, κανένα πέρασμα', () => {
  it('Δ1 — κουπόνι κοινοποίησης με id ίδιο με της περιήγησης ΔΕΝ ανοίγει θέαση', () => {
    const shareToken = issueShareAccessGrant('stour_a', NOW)!;
    expect(readTourViewGrant(shareToken, 'stour_a', NOW)).toBeNull();
  });

  it('Δ2 — 🔴 ΙΔΙΟ πλήθος πεδίων, ΑΛΛΟΣ σκοπός ⇒ τίποτα (ο σκοπός κρίνει, όχι το σχήμα)', () => {
    const foreign = issueAccessGrant({ purpose: 'other-purpose', subjectFieldCount: 3 }, ['stour_a', 'request', 'tacr_1'], NOW)!;
    expect(readTourViewGrant(foreign, 'stour_a', NOW)).toBeNull();
  });
});

describe('Μ — χωρίς μυστικό', () => {
  it('Μ1 — η έκδοση επιστρέφει null, η ανάγνωση αρνείται', () => {
    const token = issueTourViewGrant(GRANT, NOW)!;
    delete process.env[SECRET_ENV];
    expect(issueTourViewGrant(GRANT, NOW)).toBeNull();
    expect(readTourViewGrant(token, 'stour_a', NOW)).toBeNull();
  });
});
