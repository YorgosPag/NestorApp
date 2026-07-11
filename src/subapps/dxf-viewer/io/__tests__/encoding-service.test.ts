/**
 * ADR-636 Στάδιο 2 Φ2.2 — `EncodingService.encodeWindows1253` (Unicode → Windows-1253 bytes for
 * DXF export). The exact inverse of `decodeWindows1253`, reusing the SAME table (no second one).
 *
 * Covers: ASCII identity (DXF structure), Greek single-byte round-trip, out-of-codepage `\U+XXXX`
 * lossless escape, astral-plane `?` fallback.
 */

import { describe, it, expect } from '@jest/globals';
import { encodingService } from '../encoding-service';

const enc = (s: string) => Array.from(encodingService.encodeWindows1253(s));
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe('EncodingService.encodeWindows1253', () => {
  it('ASCII (DXF structure) is written 1:1', () => {
    expect(enc('0\nLINE\n')).toEqual(ascii('0\nLINE\n'));
  });

  it('Greek text → one Windows-1253 byte per char (round-trips through decode)', () => {
    const greek = 'ΚΛΙΜΑΚΑ';
    const bytes = encodingService.encodeWindows1253(greek);
    expect(bytes.length).toBe(greek.length); // single-byte codepage, not multi-byte UTF-8
    expect(encodingService.decodeWindows1253(bytes)).toBe(greek);
  });

  it('mixed ASCII + Greek round-trips exactly', () => {
    const mixed = 'LAYER: ΚΑΤΟΨΗ 1ος';
    const bytes = encodingService.encodeWindows1253(mixed);
    expect(encodingService.decodeWindows1253(bytes)).toBe(mixed);
  });

  it('Euro sign (in Windows-1253 at 0x80) encodes to a single byte, not an escape', () => {
    expect(enc('€')).toEqual([0x80]);
  });

  it('out-of-codepage BMP char → lossless \\U+XXXX escape (not a lossy ?)', () => {
    // U+4E2D (中) is not in Windows-1253 → escaped as the ASCII sequence "\U+4E2D".
    expect(enc('中')).toEqual(ascii('\\U+4E2D'));
  });

  it('astral-plane char (> 0xFFFF) falls back to ? (0x3F)', () => {
    expect(enc('😀')).toEqual([0x3f]); // U+1F600 — no 4-hex escape
  });
});
