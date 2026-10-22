/**
 * @jest-environment node
 *
 * @fileoverview **Η σειρά κατά bytes** (ADR-916 §5.11 · ADR-918) — ίδια με `Buffer.compare`, όχι με `.sort()` ή `localeCompare`.
 */

import { compareBytes, compareUtf8 } from '@/lib/string/byte-order';

const sign = (n: number): number => Math.sign(n);

describe('compareBytes / compareUtf8 — η σημασιολογία του Buffer.compare', () => {
  it.each<[string, string]>([
    ['a', 'b'], ['ab', 'a'], ['', 'a'], ['Z', 'a'], ['α', 'ω'],
    ['｡', '\u{1F600}'], // UTF-16 λέει «emoji πρώτο»· τα bytes λένε το αντίθετο
    ['\u{1F600}', '￿'],
  ])('%j vs %j', (a, b) => {
    expect(sign(compareUtf8(a, b))).toBe(sign(Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))));
  });

  it('μάρτυρας: για χαρακτήρα εκτός BMP η σειρά UTF-16 ΔΙΑΦΕΡΕΙ', () => {
    expect(['｡', '\u{1F600}'].sort()).toEqual(['\u{1F600}', '｡']);
    expect(['｡', '\u{1F600}'].sort(compareUtf8)).toEqual(['｡', '\u{1F600}']);
  });

  it('πρόθεμα πριν από το μακρύτερο · ίσα ⇒ 0', () => {
    expect(compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBeLessThan(0);
    expect(compareBytes(new Uint8Array([7]), new Uint8Array([7]))).toBe(0);
  });
});
