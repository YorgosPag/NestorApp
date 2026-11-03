/**
 * Η σύντομη διεύθυνση του QR (ADR-923 §5.13 Δ5): 307 με `no-store`, ίδια απάντηση για κάθε μη δημόσιο προϊόν.
 * Ζωντανή δοκιμή εκκρεμεί: το αν ο φυλλομετρητής σέβεται το `no-store` στο 307 δεν φαίνεται σε jest.
 */

import type { NextRequest } from 'next/server';

import { GET } from '@/app/(light)/q/[id]/route';
import { PUBLIC_UNAVAILABLE_ROUTE, publicShortRoute } from '@/subapps/catalog/public/public-catalog-routes';

const readPublicModelTarget = jest.fn<Promise<string | null>, [string]>();
jest.mock('../public-catalog.reader', () => ({ readPublicModelTarget: (id: string) => readPublicModelTarget(id) }));

const ID = 'cpmod_0f3a2b1c-1234-4abc-8def-001122334455';
const REQUEST = {} as NextRequest;
const open = (id: string) => GET(REQUEST, { params: Promise.resolve({ id }) });

beforeEach(() => readPublicModelTarget.mockReset());

describe('/q/<id>', () => {
  it('🔴 δημόσιο προϊόν ⇒ 307 με no-store και σχετικό Location, ποτέ 308', async () => {
    readPublicModelTarget.mockResolvedValue('/suppliers/aries/p/x');
    const response = await open(ID);
    expect(response.status).toBe(307);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Location')).toBe('/suppliers/aries/p/x');
  });

  it('🔒 κρυφό, αποσυρμένο ή ανύπαρκτο ⇒ η ίδια απάντηση, επίσης χωρίς μνήμη', async () => {
    readPublicModelTarget.mockResolvedValue(null);
    const response = await open(ID);
    expect(response.status).toBe(307);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Location')).toBe(PUBLIC_UNAVAILABLE_ROUTE);
  });

  it('🔒 τιμή που δεν μπορεί να είναι id δεν φτάνει στη βάση', async () => {
    const response = await open('../secrets');
    expect(response.headers.get('Location')).toBe(PUBLIC_UNAVAILABLE_ROUTE);
    expect(readPublicModelTarget).not.toHaveBeenCalled();
  });

  it('🔑 βλάβη ανάγνωσης ⇒ 503 χωρίς μνήμη, ποτέ «δεν υπάρχει»', async () => {
    readPublicModelTarget.mockRejectedValue(new Error('5xx'));
    const response = await open(ID);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Location')).toBeNull();
  });
});

describe('ο builder', () => {
  it('το QR κρατά μόνο το id, και ξαναδιαβάζεται από τη διαδρομή', () => {
    expect(publicShortRoute(ID)).toBe(`/q/${ID}`);
  });

  it('🔒 το `_` δεν είναι έγκυρο ψευδώνυμο: κανείς δεν δεσμεύει τη σελίδα αδιάθετου', async () => {
    const { judgeAliasShape } = await import('@/lib/workspace/alias-rules');
    expect(judgeAliasShape(PUBLIC_UNAVAILABLE_ROUTE.split('/').at(-1) ?? '').ok).toBe(false);
  });
});
