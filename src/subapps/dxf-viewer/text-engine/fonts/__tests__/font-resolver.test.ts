/**
 * ADR-530 — font-resolver unit tests.
 *
 * Exercises the resolution order (direct hit → SHX/unknown substitute catch-all)
 * and the bold/italic fallbacks, using fake Font objects in the real FontCache.
 */

import { resolveEntityFont } from '../font-resolver';
import { fontCache } from '../font-cache';
import type { Font } from 'opentype.js';

const fakeFont = (id: string) => ({ __id: id } as unknown as Font);

describe('resolveEntityFont (ADR-530)', () => {
  beforeEach(() => fontCache.clear());

  it('returns null when no font is loaded', () => {
    expect(resolveEntityFont('arial')).toBeNull();
  });

  it('returns a direct hit on the exact family', () => {
    const f = fakeFont('inter');
    fontCache.set('Inter', f);
    const r = resolveEntityFont('Inter');
    expect(r?.font).toBe(f);
    expect(r?.cacheName).toBe('Inter');
  });

  it('routes an unknown family to the Liberation Sans catch-all substitute', () => {
    const f = fakeFont('libsans');
    fontCache.set('Liberation Sans', f);
    const r = resolveEntityFont('arial');
    expect(r?.font).toBe(f);
    expect(r?.cacheName).toBe('Liberation Sans');
  });

  it('maps txt.shx to Liberation Mono via the substitution table', () => {
    fontCache.set('Liberation Mono', fakeFont('libmono'));
    expect(resolveEntityFont('txt.shx')?.cacheName).toBe('Liberation Mono');
  });

  it('defaults an empty family to arial → Liberation Sans', () => {
    fontCache.set('Liberation Sans', fakeFont('libsans'));
    expect(resolveEntityFont(undefined)?.cacheName).toBe('Liberation Sans');
  });

  it('resolves italic to null so CSS keeps drawing italic', () => {
    fontCache.set('Liberation Sans', fakeFont('libsans'));
    expect(resolveEntityFont('arial', { italic: true })).toBeNull();
  });

  it('targets the Bold face for bold text', () => {
    fontCache.set('Liberation Sans Bold', fakeFont('bold'));
    expect(resolveEntityFont('arial', { bold: true })?.cacheName).toBe('Liberation Sans Bold');
  });

  it('returns null for bold when only the regular face is loaded (CSS keeps bold)', () => {
    fontCache.set('Liberation Sans', fakeFont('regular'));
    expect(resolveEntityFont('arial', { bold: true })).toBeNull();
  });
});
