/**
 * @jest-environment node
 *
 * @fileoverview **ΕΥΡΟΣ BYTES (RFC 9110 §14)** — ο αναλυτής του `storage-object-stream` (ADR-884 Κ3β).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminBucket: jest.fn() }));

import { parseByteRange } from '../storage-object-stream';

describe('parseByteRange', () => {
  const SIZE = 1000;

  it('χωρίς κεφαλίδα ή με άγνωστη μορφή ⇒ ολόκληρο (null)', () => {
    expect(parseByteRange(null, SIZE)).toBeNull();
    expect(parseByteRange('items=0-1', SIZE)).toBeNull();
    expect(parseByteRange('bytes=0-1,5-9', SIZE)).toBeNull();
    expect(parseByteRange('bytes=-', SIZE)).toBeNull();
  });

  it('bytes=a-b · bytes=a- · bytes=-n', () => {
    expect(parseByteRange('bytes=0-99', SIZE)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=900-', SIZE)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-100', SIZE)).toEqual({ start: 900, end: 999 });
  });

  it('το τέλος κόβεται στο μέγεθος· επίθημα μεγαλύτερο από το αρχείο ⇒ ολόκληρο', () => {
    expect(parseByteRange('bytes=500-5000', SIZE)).toEqual({ start: 500, end: 999 });
    expect(parseByteRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 });
  });

  it('ανικανοποίητο ⇒ 416', () => {
    expect(parseByteRange('bytes=1000-', SIZE)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=10-5', SIZE)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', SIZE)).toBe('unsatisfiable');
  });
});
