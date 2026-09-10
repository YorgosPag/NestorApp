/**
 * @fileoverview **Η ΔΙΑΔΡΟΜΗ `reverse` ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ, ΜΕΣΑ ΣΕ ΜΙΑ ΠΡΟΘΕΣΜΙΑ** — ADR-332 D27 Β13.
 * @related app/api/geocoding/reverse/route.ts · lib/geocoding/overpass-housenumber.ts
 *
 * 🔴 Δύο ελαττώματα, ένα αρχείο:
 *  - «ο πάροχος δεν απάντησε» έφευγε ως **404** («εδώ δεν γράφει τίποτα») — ο διάλογος έλεγε ψέματα.
 *  - το Overpass έτρεχε με **δικά του** χρονόμετρα μετά το Nominatim — άθροισμα, όχι προθεσμία.
 *
 * Mock μόνο στα σύνορα: `fetch` (Nominatim), ο αναζητητής αριθμού (Overpass), το όριο ρυθμού.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHeavyRateLimit: <T>(handler: T) => handler,
}));
jest.mock('@/lib/geocoding/overpass-housenumber', () => ({
  findNearestHouseNumber: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import type { Deadline } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { findNearestHouseNumber } from '@/lib/geocoding/overpass-housenumber';
import { GET } from '../route';

const ORIGINAL_FETCH = global.fetch;

/** Ό,τι απάντησε ζωντανά το Nominatim για την πόρτα της Σαμοθράκης 16: ο δρόμος, χωρίς αριθμό. */
const NOMINATIM_STREET = {
  lat: '40.6643548',
  lon: '22.8975059',
  display_name: 'Σαμοθράκης, Ελευθέριο Κορδελιό',
  address: { road: 'Σαμοθράκης', suburb: 'Ελευθέριο Κορδελιό', postcode: '563 34', country: 'Ελλάδα' },
};

function nominatimAnswers(body: unknown, status = 200): jest.Mock {
  const mock = jest.fn(async () => ({ ok: status < 300, status, json: async () => body }));
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

async function call(): Promise<{ status: number; body: Record<string, unknown> }> {
  const request = { url: 'http://localhost/api/geocoding/reverse?lat=40.6641899&lon=22.8974273' } as NextRequest;
  const response = (await GET(request)) as unknown as { status: number; json: () => Promise<Record<string, unknown>> };
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.mocked(findNearestHouseNumber).mockReset();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('Β13 — τρεις εκβάσεις, όχι δύο', () => {
  it('🔴 το Nominatim ΔΕΝ απάντησε ⇒ 503 («δεν ρώτησα»), ΟΧΙ 404 («εδώ δεν γράφει τίποτα»)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('The operation was aborted due to timeout'); }) as unknown as typeof fetch;

    expect((await call()).status).toBe(503);
  });

  it('🔴 όριο ρυθμού του Nominatim (429) ⇒ 503', async () => {
    nominatimAnswers({}, 429);
    expect((await call()).status).toBe(503);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το Nominatim ΑΠΑΝΤΗΣΕ «Unable to geocode» ⇒ 404 — αυτό ΕΙΝΑΙ «εδώ δεν γράφει τίποτα»', async () => {
    nominatimAnswers({ error: 'Unable to geocode' });
    expect((await call()).status).toBe(404);
  });
});

describe('Β13 — ΜΙΑ προθεσμία για όλο το αίτημα', () => {
  it('🔴 ο αναζητητής αριθμού παίρνει την ΙΔΙΑ προθεσμία, με ό,τι απομένει από αυτήν', async () => {
    nominatimAnswers(NOMINATIM_STREET);
    jest.mocked(findNearestHouseNumber).mockResolvedValue('16');

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.number).toBe('16');
    const options = jest.mocked(findNearestHouseNumber).mock.calls[0]![3] as { deadline: Deadline };
    expect(options.deadline.remainingMs()).toBeLessThanOrEqual(GEOGRAPHIC_CONFIG.GEOCODING.REVERSE_BUDGET_MS);
    expect(options.deadline.remainingMs()).toBeGreaterThan(0);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το Nominatim έδωσε αριθμό ⇒ ΚΑΝΕΝΑ αίτημα Overpass', async () => {
    nominatimAnswers({ ...NOMINATIM_STREET, address: { ...NOMINATIM_STREET.address, house_number: '16' } });

    expect((await call()).body.number).toBe('16');
    expect(findNearestHouseNumber).not.toHaveBeenCalled();
  });

  it('ο αριθμός δεν βρέθηκε μέσα στην προθεσμία ⇒ η απάντηση φεύγει ΧΩΡΙΣ αριθμό (όχι σφάλμα)', async () => {
    nominatimAnswers(NOMINATIM_STREET);
    jest.mocked(findNearestHouseNumber).mockResolvedValue(null);

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.street).toBe('Σαμοθράκης');
    expect(body.number).toBe('');
  });
});
