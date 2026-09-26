/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΚΟΥΠΟΝΙ ΘΕΑΣΗΣ** (ADR-884 Φ0.4 · Κ3β) — άγκυρες του κουπονιού και του κοινού πυρήνα.
 *
 * - **Κ** — ζωντανό, αυτής της περιήγησης, αυτού του σκοπού — ή τίποτα.
 * - **Δ** — 🔴 διαχωρισμός σκοπού: κουπόνι **κοινοποίησης** δεν διαβάζεται ποτέ ως κουπόνι **θέασης** (ένα μυστικό).
 * - **Μ** — χωρίς μυστικό: `null`, ποτέ πλαστό κουπόνι.
 * - **Π** — 🔴 το `Path` του cookie **φτάνει σε κάθε αναγνώστη** (μέσα + δύο πόρτες `view-session`) και σε **καμία**
 *   άλλη περιήγηση. Ζωντανή επαλήθευση 2026-09-26: `Path` = ρίζα μέσων ⇒ ο browser δεν το έστελνε στο αδελφό
 *   `…/view-session` ⇒ κάθε reload μετρούσε νέα επίσκεψη. Οι άγκυρες της συνεδρίας δεν μπορούσαν να το δουν:
 *   δίνουν το `presentedGrant` με το χέρι — ο browser είναι αυτός που αποφασίζει αν ταξιδεύει.
 */

jest.mock('server-only', () => ({}));

import { issueAccessGrant } from '@/server/access-grant/access-grant';
import { issueShareAccessGrant } from '@/server/sharing/share-access-grant';

import { API_ROUTES } from '@/config/domain-constants';

import { NextResponse } from 'next/server';

import {
  attachTourViewGrant,
  clearTourViewGrant,
  issueTourViewGrant,
  readTourViewGrant,
  TOUR_VIEW_GRANT_TTL_SECONDS,
  tourViewCookiePath,
} from '../tour-view-grant';

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

/** RFC 6265 §5.1.4 — «path-match»: ό,τι κάνει ο browser όταν αποφασίζει αν στέλνει το cookie. */
function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || requestPath.charAt(cookiePath.length) === '/';
}

describe('Π — το cookie φτάνει εκεί που διαβάζεται', () => {
  const SUBJECT = { kind: 'company-property', id: 'prop_1' } as const;
  const routes = API_ROUTES.SPATIAL_TOURS;
  const cookiePath = tourViewCookiePath(SUBJECT);

  it.each([
    ['πλακίδιο', `${routes.MEDIA_ROOT(SUBJECT.kind, SUBJECT.id)}/tcap_1/abc/0/0.jpg`],
    ['συνεδρία με λογαριασμό', routes.VIEW_SESSION(SUBJECT.kind, SUBJECT.id)],
    ['συνεδρία χωρίς ταυτότητα', routes.VIEW_SESSION_PUBLIC(SUBJECT.kind, SUBJECT.id)],
  ])('🔴 Π1 — %s: ο browser ΣΤΕΛΝΕΙ το κουπόνι', (_name, path) => {
    expect(pathMatches(path, cookiePath)).toBe(true);
  });

  it('🔴 Π3 — η διαγραφή (άρνηση συνεδρίας) έχει ΙΔΙΟ Path με την εγγραφή — αλλιώς ο browser δεν σβήνει τίποτα', () => {
    const written = NextResponse.json({});
    attachTourViewGrant(written, SUBJECT, 'stour_a', 'token');
    const cleared = NextResponse.json({});
    clearTourViewGrant(cleared, SUBJECT, 'stour_a');
    const set = written.cookies.get('nestor_tour_stour_a');
    const unset = cleared.cookies.get('nestor_tour_stour_a');
    expect(unset).toMatchObject({ value: '', maxAge: 0, path: set?.path, httpOnly: true });
  });

  it('🔴 Π2 — άλλη περιήγηση (ακόμη και με κοινό πρόθεμα id) ΔΕΝ το λαμβάνει', () => {
    expect(pathMatches(routes.VIEW_SESSION(SUBJECT.kind, 'prop_10'), cookiePath)).toBe(false);
    expect(pathMatches(routes.MEDIA_ROOT('owner-property', SUBJECT.id), cookiePath)).toBe(false);
  });
});
