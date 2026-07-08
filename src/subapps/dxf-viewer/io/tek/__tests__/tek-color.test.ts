/**
 * tek-color — `tekColorToHex` SSoT (Tekton `<color>` → canonical scene hex).
 * Verify: `#` prefix + reuse `colorHex6` normalize/uppercase/strip + fallback.
 */

import { tekColorToHex } from '../tek-color';

describe('tekColorToHex', () => {
  it('προσθέτει `#` σε έγκυρο 6-hex RGB (χωρίς BGR swap)', () => {
    expect(tekColorToHex('80bcfc')).toBe('#80BCFC');
    expect(tekColorToHex('FFFF80')).toBe('#FFFF80');
  });

  it('κανονικοποιεί σε κεφαλαία μέσω του colorHex6 SSoT', () => {
    expect(tekColorToHex('ff0000')).toBe('#FF0000');
  });

  it('αφαιρεί προϋπάρχον `#` πριν το re-prefix (idempotent input)', () => {
    expect(tekColorToHex('#00ff00')).toBe('#00FF00');
  });

  it('fallback στο default τοίχου για μη-έγκυρο χρώμα', () => {
    expect(tekColorToHex('bad')).toBe('#80BCFC');
    expect(tekColorToHex('')).toBe('#80BCFC');
  });
});
