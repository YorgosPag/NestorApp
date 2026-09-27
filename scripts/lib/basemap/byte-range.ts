/**
 * @fileoverview Ανάλυση της κεφαλίδας `Range: bytes=…` (RFC 9110 §14) — **ένα** εύρος, όσο ζητά το PMTiles.
 * @related ADR-891 §9 · `scripts/serve-basemap.ts`
 *
 * Ο πελάτης `pmtiles` ζητά πάντα **ένα** εύρος ανά αίτημα. Πολλαπλά εύρη (`multipart/byteranges`) δεν τα ζητά
 * κανείς εδώ ⇒ απαντώνται ολόκληρα (`200`), που είναι επιτρεπτή απάντηση κατά το RFC.
 */

export type ByteRange =
  | { readonly kind: 'full' }
  | { readonly kind: 'partial'; readonly start: number; readonly end: number }
  | { readonly kind: 'unsatisfiable' };

/** `header` = η τιμή του `Range` (ή `undefined`), `size` = μέγεθος αρχείου. Το `end` είναι **συμπεριληπτικό**. */
export function parseByteRange(header: string | undefined, size: number): ByteRange {
  if (header === undefined) return { kind: 'full' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null || (match[1] === '' && match[2] === '')) return { kind: 'full' };

  if (match[1] === '') {
    // Επίθημα: `bytes=-N` = τα τελευταία N bytes.
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return { kind: 'unsatisfiable' };
    return { kind: 'partial', start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  if (start >= size) return { kind: 'unsatisfiable' };
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (end < start) return { kind: 'full' };
  return { kind: 'partial', start, end };
}
