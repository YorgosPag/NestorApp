/**
 * Η σύντομη διεύθυνση του QR (ADR-923 §5.13 Δ5): 307 με `no-store`, ίδια απάντηση για κάθε μη δημόσιο προϊόν.
 * Ζωντανή δοκιμή εκκρεμεί: το αν ο φυλλομετρητής σέβεται το `no-store` στο 307 δεν φαίνεται σε jest.
 */

import type { NextRequest } from 'next/server';

import { GET } from '@/app/(light)/q/[id]/route';
import { PUBLIC_UNAVAILABLE_ROUTE, publicIdOfShortSegment, publicShortRoute } from '@/subapps/catalog/public/public-catalog-routes';

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

/** Πραγματικά προθέματα: SKU (`cprod`) και μοντέλο (`cpmod`). Το διάνυσμα base32 είναι του `compact-uuid.test.ts`. */
const PRODUCT_ID = 'cprod_3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b';
const PRODUCT_CODE = 'P1Z5AE1WYTD9T59R8AXDSZR16GV';

describe('/Q/<είδος><base32> (Ν10 α)', () => {
  it('🔑 η συμπαγής γραφή φτάνει στη βάση ως το πλήρες id, από τον ΙΔΙΟ χειριστή', async () => {
    readPublicModelTarget.mockResolvedValue('/suppliers/aries/p/x');
    const response = await open(PRODUCT_CODE);
    expect(readPublicModelTarget).toHaveBeenCalledWith(PRODUCT_ID);
    expect(response.status).toBe(307);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('🔑 το χαρτί πριν από το Ν10 α: το σκέτο id ισχύει για πάντα', async () => {
    readPublicModelTarget.mockResolvedValue('/suppliers/aries/p/x');
    await open(PRODUCT_ID);
    expect(readPublicModelTarget).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it.each([['άγνωστο γράμμα είδους', `X${PRODUCT_CODE.slice(1)}`], ['πεζά', PRODUCT_CODE.toLowerCase()], ['κομμένο', PRODUCT_CODE.slice(0, -1)]])(
    '🔒 %s ⇒ η σελίδα αδιάθετου, χωρίς ανάγνωση βάσης', async (_name, segment) => {
      const response = await open(segment);
      expect(response.headers.get('Location')).toBe(PUBLIC_UNAVAILABLE_ROUTE);
      expect(readPublicModelTarget).not.toHaveBeenCalled();
    },
  );
});

describe('ο builder', () => {
  it('🔑 SKU και μοντέλο ⇒ συμπαγής διαδρομή σε κεφαλαία, που ξαναδιαβάζεται στο ίδιο id', () => {
    expect(publicShortRoute(PRODUCT_ID)).toBe(`/Q/${PRODUCT_CODE}`);
    expect(publicShortRoute(ID)).toMatch(/^\/Q\/M[0-7][0-9A-Z]{25}$/);
    for (const id of [PRODUCT_ID, ID]) expect(publicIdOfShortSegment(publicShortRoute(id).slice('/Q/'.length))).toBe(id);
  });

  it('id χωρίς συμπαγή μορφή (ξένο πρόθεμα, όχι uuid) κρατά το `/q/<id>`', () => {
    expect(publicShortRoute('cpm_a')).toBe('/q/cpm_a');
    expect(publicShortRoute('cprod_legacy')).toBe('/q/cprod_legacy');
  });

  it('🔒 το `_` δεν είναι έγκυρο ψευδώνυμο: κανείς δεν δεσμεύει τη σελίδα αδιάθετου', async () => {
    const { judgeAliasShape } = await import('@/lib/workspace/alias-rules');
    expect(judgeAliasShape(PUBLIC_UNAVAILABLE_ROUTE.split('/').at(-1) ?? '').ok).toBe(false);
  });
});
