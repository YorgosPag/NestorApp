/**
 * @jest-environment node
 */

/**
 * Η τιμή της κεφαλίδας γραμμένη **ρητά** (ADR-923 §5.14.1 Ζ23): χωρίς `private` ένας κοινόχρηστος ενδιάμεσος μπορεί να
 * την κρατήσει· χωρίς `no-store` ο browser. Τα υπόλοιπα tests συγκρίνουν με τη σταθερά, άρα μόνο εδώ φαίνεται αλλαγή της.
 */

import { NextResponse } from 'next/server';

import {
  cacheControlFor,
  cacheControlOf,
  NO_STORE_POLICY,
  PRIVATE_NO_STORE,
  PRIVATE_NO_STORE_HEADERS,
  withPrivateNoStore,
} from '../cache-control';

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

describe('δηλωμένη πολιτική ανά route (ADR-603 §Ασπίδα)', () => {
  it('η προεπιλογή είναι `private, no-store`', () => {
    expect(cacheControlOf(NO_STORE_POLICY)).toBe('private, no-store');
  });

  it.each([
    [{ kind: 'private', maxAgeSeconds: 60 } as const, 'private, max-age=60'],
    [{ kind: 'private', maxAgeSeconds: 31536000, immutable: true } as const, 'private, max-age=31536000, immutable'],
    [{ kind: 'private', maxAgeSeconds: 0 } as const, 'private, no-cache'],
  ])('%j ⇒ %s', (policy, expected) => {
    expect(cacheControlOf(policy)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN])('άκυρη διάρκεια %p ⇒ σφάλμα στη δήλωση, όχι σιωπηλή διόρθωση', (maxAgeSeconds) => {
    expect(() => cacheControlOf({ kind: 'private', maxAgeSeconds })).toThrow(RangeError);
  });

  it.each([400, 401, 403, 404, 409, 429, 500, 503])('κατάσταση %i ⇒ πάντα `private, no-store`, ό,τι κι αν δηλώθηκε', (status) => {
    expect(cacheControlFor(status, { kind: 'private', maxAgeSeconds: 31536000, immutable: true })).toBe('private, no-store');
  });

  it.each([200, 201, 204, 304])('κατάσταση %i ⇒ η δηλωμένη πολιτική', (status) => {
    expect(cacheControlFor(status, { kind: 'private', maxAgeSeconds: 60 })).toBe('private, max-age=60');
  });
});
