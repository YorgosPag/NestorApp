/**
 * `GET /api/market/value-zone` (ADR-898 Φ2) — σημείο → ετυμηγορία ζώνης, 400 σε άκυρο σημείο, 503 όταν τα αρχεία δεν
 * διαβάστηκαν (ποτέ `unavailable` με 200).
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return { status: init?.status ?? 200, headers: init?.headers ?? {}, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

var readValueZoneAt = jest.fn();
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneAt: (...args: unknown[]) => readValueZoneAt(...args),
}));

import { readValueZoneRequestPoint, valueZoneAtPath } from '@/lib/market/value-zone-request';

import { GET } from '../route';

interface MockResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  json(): Promise<unknown>;
}

const call = (query: string): Promise<MockResponse> =>
  (GET as unknown as (request: { nextUrl: URL }) => Promise<MockResponse>)({
    nextUrl: new URL(`http://localhost/api/market/value-zone?${query}`),
  });

const READY = {
  kind: 'ready',
  zone: { id: 'z1', name: 'ΚΣΤ', price: 3600, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

beforeEach(() => readValueZoneAt.mockReset());

describe('readValueZoneRequestPoint', () => {
  it('διαβάζει και στρογγυλεύει στα 6 δεκαδικά', () => {
    expect(readValueZoneRequestPoint(new URLSearchParams('lat=37.97581234&lng=23.7349876'))).toEqual({
      lat: 37.975812,
      lng: 23.734988,
    });
  });

  it.each(['', 'lat=37.9', 'lat=abc&lng=23.7', 'lat=91&lng=23', 'lat=37&lng=181', 'lat=&lng=23'])(
    'απορρίπτει «%s»',
    (query) => expect(readValueZoneRequestPoint(new URLSearchParams(query))).toBeNull(),
  );

  it('η διαδρομή του client διαβάζεται πίσω στο ίδιο σημείο (ένα συμβόλαιο)', () => {
    const path = valueZoneAtPath({ lat: 40.6401, lng: 22.9444 });
    expect(readValueZoneRequestPoint(new URL(`http://x${path}`).searchParams)).toEqual({ lat: 40.6401, lng: 22.9444 });
  });
});

describe('GET /api/market/value-zone', () => {
  it('400 σε άκυρο σημείο — χωρίς ανάγνωση αρχείων', async () => {
    const response = await call('lat=abc&lng=1');
    expect(response.status).toBe(400);
    expect(readValueZoneAt).not.toHaveBeenCalled();
  });

  it('200 με την ετυμηγορία, και η θέση δηλώνεται ως πινέζα του ανθρώπου (manual)', async () => {
    readValueZoneAt.mockResolvedValue(READY);
    const response = await call('lat=37.9758&lng=23.7349');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verdict: READY });
    expect(response.headers['Cache-Control']).toContain('s-maxage=900');
    expect(readValueZoneAt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'known', provenance: 'manual', point: { lat: 37.9758, lng: 23.7349 } }),
    );
  });

  it('200 και για «εκτός ζωνών» — είναι γεγονός, όχι σφάλμα', async () => {
    readValueZoneAt.mockResolvedValue({ kind: 'outside' });
    const response = await call('lat=51.5&lng=-0.12');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verdict: { kind: 'outside' } });
  });

  it('503 + Retry-After όταν τα αρχεία δεν διαβάστηκαν — ποτέ 200 σιωπής', async () => {
    readValueZoneAt.mockResolvedValue({ kind: 'unavailable' });
    const response = await call('lat=37.9758&lng=23.7349');
    expect(response.status).toBe(503);
    expect(response.headers['Retry-After']).toBe('30');
  });
});
