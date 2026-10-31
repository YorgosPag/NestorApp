/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ QUERY, ΚΡΙΜΕΝΟ ΜΕ ΤΟ ΣΧΗΜΑ ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ** (ADR-904 Κ7).
 *
 * - **Ε1** τιμές κειμένου ⇒ αριθμός μέσω του σχήματος· απόντα πεδία δεκτά·
 * - **Ε2** κακό query ⇒ 400 με σώμα που **είναι** το `MalformedQueryBody` του συμβολαίου (ίδια bytes με τον πελάτη)·
 * - **Ε3** επαναλαμβανόμενο κλειδί ⇒ η **πρώτη** τιμή (δηλωμένο, όχι σύμπτωση).
 * - **Ε4** προστακτικοί αναγνώστες (`optionalQueryText` · `optionalQueryDay` · `readQueryLimit`) ⇒ άκυρο = 400, ποτέ ψαλίδισμα.
 */

jest.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';

import { CaptureTargetsQuerySchema, MalformedQueryBodySchema } from '@/contracts/capture-api/capture-api-schemas';

import {
  InvalidQueryParamError,
  optionalQueryDay,
  optionalQueryText,
  readQueryLimit,
  readQueryParams,
} from '../query-params';

const request = (query: string) => new NextRequest(`https://nestorconstruct.gr/api/spatial-tours/capture-targets${query}`);

describe('Ε1 — δεκτά', () => {
  it.each([
    ['', {}],
    ['?pageSize=20', { pageSize: 20 }],
    ['?pageSize=0&pageToken=abc', { pageSize: 0, pageToken: 'abc' }],
    ['?pageSize=5000', { pageSize: 5000 }],
  ])('%s', (query, expected) => {
    expect(readQueryParams(request(query), CaptureTargetsQuerySchema)).toEqual({ data: expected });
  });
});

describe('Ε2 — απόρριψη = το σώμα του συμβολαίου', () => {
  it.each(['?pageSize=-1', '?pageSize=abc', '?pageSize=1.5', '?pageToken='])('%s ⇒ 400 MALFORMED_QUERY', async (query) => {
    const parsed = readQueryParams(request(query), CaptureTargetsQuerySchema);
    if (!('rejected' in parsed)) throw new Error('expected rejection');
    expect(parsed.rejected.status).toBe(400);
    const body: unknown = await parsed.rejected.json();
    expect(MalformedQueryBodySchema.safeParse(body).success).toBe(true);
  });
});

describe('Ε3 — επαναλαμβανόμενο κλειδί', () => {
  it('κρατά την ΠΡΩΤΗ τιμή', () => {
    expect(readQueryParams(request('?pageSize=3&pageSize=9'), CaptureTargetsQuerySchema)).toEqual({ data: { pageSize: 3 } });
  });
});

describe('Ε4 — προστακτικοί αναγνώστες: απόρριψη, ποτέ ψαλίδισμα', () => {
  const params = (query: string) => new URLSearchParams(query);
  const BOUNDS = { defaultLimit: 20, maxLimit: 100 };

  it('απουσία και κενό ⇒ «δεν ζητήθηκε»', () => {
    expect(optionalQueryText(params(''), 'q')).toBeUndefined();
    expect(optionalQueryText(params('q='), 'q')).toBeUndefined();
    expect(optionalQueryText(params('q=x'), 'q')).toBe('x');
    expect(optionalQueryDay(params('d='), 'd')).toBeUndefined();
    expect(readQueryLimit(params('limit='), BOUNDS)).toBe(20);
  });

  it.each([['1', 1], ['100', 100], ['37', 37]])('limit=%s ⇒ %d', (raw, expected) => {
    expect(readQueryLimit(params(`limit=${raw}`), BOUNDS)).toBe(expected);
  });

  it.each(['abc', '0', '101', '-1', '2.5', '12abc', ' 5'])('limit=%j ⇒ 400 INVALID_ARGUMENT', (raw) => {
    const read = () => readQueryLimit(params(`limit=${encodeURIComponent(raw)}`), BOUNDS);
    expect(read).toThrow(InvalidQueryParamError);
    expect(read).toThrow(expect.objectContaining({ statusCode: 400, errorCode: 'INVALID_ARGUMENT' }));
  });

  it.each(['2027-02-30', '2027-13-01', '27-01-01', '2027-01-01T00:00Z'])('ημέρα %j που δεν υπάρχει ⇒ 400', (raw) => {
    expect(() => optionalQueryDay(params(`d=${encodeURIComponent(raw)}`), 'd')).toThrow(InvalidQueryParamError);
  });

  it('υπαρκτή ημέρα (και δίσεκτη) ⇒ αυτούσια', () => {
    expect(optionalQueryDay(params('d=2028-02-29'), 'd')).toBe('2028-02-29');
  });
});
