/**
 * @jest-environment node
 *
 * ADR-835 §22 (Στάδιο Γ) — **η δημόσια διαδρομή του feed.**
 *
 * 🔴 Η άγκυρα που μετράει είναι η **Ρ4**: ημερολόγιο που δεν διαβάζεται φεύγει ως
 * **503 με κενό σώμα** — ποτέ ως άδειο `VCALENDAR`, που το κανάλι θα διάβαζε
 * «όλες οι νύχτες ελεύθερες» (§6.4). Οι υπόλοιπες φυλάνε το **ενιαίο 404**: ο σύνδεσμος
 * δεν αποκαλύπτει τι υπάρχει.
 */

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T>(handler: T) => handler,
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  stayExportToken,
  STAY_EXPORT_SCOPE_ALL,
  STAY_ICAL_SECRET_ENV,
} from '@/services/stay-calendar/stay-channel-export.service';

const db = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => db as unknown as AdminFirestore,
}));

const PROPERTY = 'ownp_a';
const OWNER_UID = 'user-1';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- μετά τα mocks, επίτηδες.
const { GET } = require('../[feed]/route') as {
  GET: (request: Request, context: { params: Promise<{ feed: string }> }) => Promise<Response>;
};

const call = (feed: string, headers: Record<string, string> = {}): Promise<Response> =>
  GET(new Request('https://nestorconstruct.gr/api/stay-ical/x', { headers }), {
    params: Promise.resolve({ feed }),
  });

function givenStay(offers = [offerOf('leaseShort', 65)]): void {
  db.seed(COLLECTIONS.OWNER_PROPERTIES, PROPERTY, { ...validOwnerProperty({ offers }) });
  db.seed(COLLECTIONS.STAY_CALENDARS, PROPERTY, {
    propertyId: PROPERTY, authorUserId: OWNER_UID, declaredAt: '2027-01-01T00:00:00.000Z',
    version: 1, timezone: 'Europe/Athens',
    createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
  });
  db.seed(COLLECTIONS.STAY_BLOCKS, 'sblk_1', {
    propertyId: PROPERTY, authorUserId: OWNER_UID, covers: [{ propertyId: PROPERTY, spaceId: null }],
    from: '2027-10-10', to: '2027-10-14', source: 'owner', channel: null, note: 'ιδιωτικό',
    createdBy: OWNER_UID, createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
  });
}

function givenChannels(exportGeneration: number): void {
  db.seed(COLLECTIONS.STAY_CHANNELS, PROPERTY, {
    propertyId: PROPERTY, authorUserId: OWNER_UID, exportGeneration, feeds: [],
    nextPollAt: '9999-12-31T00:00:00.000Z',
    createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
  });
}

const tokenFor = (generation: number): string =>
  `${stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, generation) ?? ''}.ics`;

beforeAll(() => {
  process.env[STAY_ICAL_SECRET_ENV] = 'test-secret';
});
beforeEach(() => {
  db.reset();
});

describe('Ρ — η δημόσια διαδρομή του feed', () => {
  it('Ρ1. έγκυρος σύνδεσμος ⇒ 200 `text/calendar`, με ETag και ΧΩΡΙΣ τη σημείωση', async () => {
    givenStay();
    const response = await call(tokenFor(0));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect(body).toContain('DTSTART;VALUE=DATE:20271010');
    expect(body).toContain('DTEND;VALUE=DATE:20271014');
    expect(body).not.toContain('ιδιωτικό');
  });

  it('Ρ2. `If-None-Match` με το ίδιο ETag ⇒ 304 χωρίς σώμα', async () => {
    givenStay();
    const first = await call(tokenFor(0));
    const etag = first.headers.get('etag') ?? '';

    const second = await call(tokenFor(0), { 'if-none-match': etag });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('🔑 Ρ3. ΑΝΑΚΛΗΣΗ: σύνδεσμος παλιάς γενιάς ⇒ 404 (ίδιο με πλαστό)', async () => {
    givenStay();
    givenChannels(2);
    expect((await call(tokenFor(1))).status).toBe(404);
    expect((await call(tokenFor(2))).status).toBe(200);
  });

  it('🔴 Ρ4. αδιάβαστο ημερολόγιο ⇒ 503 ΜΕ ΚΕΝΟ ΣΩΜΑ, ποτέ άδειο VCALENDAR', async () => {
    givenStay();
    db.seed(COLLECTIONS.STAY_BLOCKS, 'sblk_broken', { propertyId: PROPERTY, from: 'κάποτε' });

    const response = await call(tokenFor(0));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
  });

  it('Ρ5. πλαστή υπογραφή · χωρίς `.ics` · ακίνητο χωρίς βραχυχρόνια ⇒ ΕΝΙΑΙΟ 404', async () => {
    givenStay();
    expect((await call('πλαστό.ics')).status).toBe(404);
    expect((await call(tokenFor(0).replace('.ics', ''))).status).toBe(404);

    db.reset();
    givenStay([offerOf('sell', 210_000)]);
    expect((await call(tokenFor(0))).status).toBe(404);
  });

  it('Ρ6. ακίνητο που δεν υπάρχει ⇒ 404, χωρίς να μαρτυρήσει ότι το ψάξαμε', async () => {
    expect((await call(tokenFor(0))).status).toBe(404);
  });
});
