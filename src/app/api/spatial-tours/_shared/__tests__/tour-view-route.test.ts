/**
 * @jest-environment node
 *
 * @fileoverview **Η ΣΥΝΕΔΡΙΑ ΘΕΑΣΗΣ ΣΤΟ ΣΥΡΜΑ — ΤΟ COOKIE** (ADR-884 Κ3β) — άγκυρες της διαδρομής.
 *
 * 🔴 **Γιατί υπάρχει** (ζωντανή επαλήθευση 2026-09-26): μετά από ανάκληση η συνεδρία αρνιόταν σωστά, αλλά ο browser
 * κρατούσε ζωντανό το κουπόνι θέασης ως τη λήξη του (15′) και συνέχιζε να παίρνει πλακίδια. Οι άγκυρες της κρίσης
 * (`tour-view-session.test.ts`) δεν μπορούσαν να το δουν: το cookie το γράφει/σβήνει **η διαδρομή**, όχι η κρίση.
 *
 * - **Σ1** — άρνηση + ο browser έφερε κουπόνι ⇒ η απάντηση το **σβήνει** (ίδιο όνομα, ίδιο `Path`, `Max-Age=0`).
 * - **Σ2** — άρνηση χωρίς κουπόνι ⇒ κανένα `Set-Cookie` (τίποτα να σβηστεί, κανένας θόρυβος).
 * - **Σ3** — έγκριση ⇒ γράφεται κουπόνι στη ρίζα της περιήγησης.
 */

jest.mock('server-only', () => ({}));

const openMock = jest.fn();
jest.mock('@/server/spatial-tour/tour-view-session', () => ({ openTourViewSession: (...args: unknown[]) => openMock(...args) }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { NextRequest } from 'next/server';

import { issueTourViewGrant, tourViewCookieName, tourViewCookiePath } from '@/server/spatial-tour/tour-view-grant';
import { enterpriseIdService } from '@/services/enterprise-id.service';

import { respondTourViewSession } from '../tour-view-route';

const SECRET_ENV = 'SHARE_ACCESS_SECRET';
const SUBJECT = { kind: 'company-property', id: 'prop_1' } as const;
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId(SUBJECT.kind, SUBJECT.id);
const SEGMENT = { params: Promise.resolve({ kind: SUBJECT.kind, subjectId: SUBJECT.id }) };
const COOKIE = tourViewCookieName(TOUR_ID);

function sessionRequest(cookie: string | null): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookie !== null) headers.set('Cookie', `${COOKIE}=${cookie}`);
  return new NextRequest('http://localhost/api/spatial-tours/company-property/prop_1/view-session', {
    method: 'POST', headers, body: JSON.stringify({ shareId: null }),
  });
}

beforeEach(() => {
  process.env[SECRET_ENV] = 'test-secret-with-enough-entropy-0123456789abcdef';
  openMock.mockReset();
});

afterAll(() => {
  delete process.env[SECRET_ENV];
});

describe('Σ — το cookie θέασης στη διαδρομή', () => {
  it('🔴 Σ1 — άρνηση ενώ ο browser φέρει κουπόνι ⇒ η απάντηση το ΣΒΗΝΕΙ (ίδιο Path)', async () => {
    const token = issueTourViewGrant({ tourId: TOUR_ID, basis: 'request', basisId: 'tacr_1' })!;
    openMock.mockResolvedValue({ kind: 'refused', reason: 'not-viewable' });
    const response = await respondTourViewSession(sessionRequest(token), SEGMENT, null);
    expect(response.status).toBe(403);
    expect(response.cookies.get(COOKIE)).toMatchObject({ value: '', maxAge: 0, path: tourViewCookiePath(SUBJECT) });
  });

  it('Σ2 — άρνηση χωρίς κουπόνι ⇒ κανένα Set-Cookie', async () => {
    openMock.mockResolvedValue({ kind: 'refused', reason: 'not-viewable' });
    const response = await respondTourViewSession(sessionRequest(null), SEGMENT, null);
    expect(response.cookies.get(COOKIE)).toBeUndefined();
  });

  it('Σ3 — έγκριση ⇒ κουπόνι στη ρίζα της περιήγησης', async () => {
    const grant = { tourId: TOUR_ID, basis: 'public', basisId: TOUR_ID } as const;
    openMock.mockResolvedValue({
      kind: 'granted', grant, token: issueTourViewGrant(grant),
      manifest: { tourId: TOUR_ID, label: null, nodes: [], levels: [], stops: [], ready: false },
    });
    const response = await respondTourViewSession(sessionRequest(null), SEGMENT, null);
    expect(response.status).toBe(200);
    expect(response.cookies.get(COOKIE)).toMatchObject({ path: tourViewCookiePath(SUBJECT), httpOnly: true });
  });
});
