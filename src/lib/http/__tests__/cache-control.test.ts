/**
 * @jest-environment node
 */

/**
 * Η τιμή της κεφαλίδας γραμμένη **ρητά** (ADR-923 §5.14.1 Ζ23): χωρίς `private` ένας κοινόχρηστος ενδιάμεσος μπορεί να
 * την κρατήσει· χωρίς `no-store` ο browser. Τα υπόλοιπα tests συγκρίνουν με τη σταθερά, άρα μόνο εδώ φαίνεται αλλαγή της.
 */

import { NextResponse } from 'next/server';

import { PRIVATE_NO_STORE, PRIVATE_NO_STORE_HEADERS, withPrivateNoStore } from '../cache-control';

describe('cache-control', () => {
  it('η τιμή είναι ακριβώς `private, no-store` (RFC 9111 §5.2.2.5 · §5.2.2.7)', () => {
    expect(PRIVATE_NO_STORE).toBe('private, no-store');
    expect(PRIVATE_NO_STORE_HEADERS).toEqual({ 'Cache-Control': 'private, no-store' });
  });

  it('απόκριση χωρίς πολιτική ⇒ παίρνει την κεφαλίδα', () => {
    expect(withPrivateNoStore(NextResponse.json({})).headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('απόκριση με δική της πολιτική ⇒ μένει αυτή', () => {
    const own = NextResponse.json({}, { headers: { 'Cache-Control': 'private, max-age=60' } });
    expect(withPrivateNoStore(own).headers.get('Cache-Control')).toBe('private, max-age=60');
  });
});
