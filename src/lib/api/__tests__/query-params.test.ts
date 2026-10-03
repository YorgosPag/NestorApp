/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ QUERY, ΚΡΙΜΕΝΟ ΜΕ ΤΟ ΣΧΗΜΑ ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ** (ADR-904 Κ7).
 *
 * - **Ε1** τιμές κειμένου ⇒ αριθμός μέσω του σχήματος· απόντα πεδία δεκτά·
 * - **Ε2** κακό query ⇒ 400 με σώμα που **είναι** το `MalformedQueryBody` του συμβολαίου (ίδια bytes με τον πελάτη)·
 * - **Ε3** επαναλαμβανόμενο κλειδί ⇒ η **πρώτη** τιμή (δηλωμένο, όχι σύμπτωση).
 */

jest.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';

import { CaptureTargetsQuerySchema, MalformedQueryBodySchema } from '@/contracts/capture-api/capture-api-schemas';

import { readQueryParams } from '../query-params';

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
