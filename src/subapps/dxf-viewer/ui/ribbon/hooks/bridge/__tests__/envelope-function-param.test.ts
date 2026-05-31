/**
 * ADR-396 v2 Φ6a — envelope-function-param SSoT tests.
 *
 * Καλύπτει το tri-state mapping value↔field που μοιράζονται οι 3 bridges:
 * `undefined` ⟷ 'auto' sentinel, έγκυρες/άκυρες τιμές, ποτέ literal 'auto' στο schema.
 */

import {
  ENVELOPE_FUNCTION_AUTO,
  ENVELOPE_FUNCTION_OPTIONS,
  readEnvelopeFunctionValue,
  parseEnvelopeFunctionValue,
} from '../envelope-function-param';

describe('envelope-function-param — read', () => {
  it('undefined (απών) → auto sentinel', () => {
    expect(readEnvelopeFunctionValue(undefined)).toBe(ENVELOPE_FUNCTION_AUTO);
  });

  it('ρητή τιμή → η ίδια', () => {
    expect(readEnvelopeFunctionValue('exterior')).toBe('exterior');
    expect(readEnvelopeFunctionValue('interior')).toBe('interior');
  });
});

describe('envelope-function-param — parse', () => {
  it("'auto' → clear (fn === undefined)", () => {
    expect(parseEnvelopeFunctionValue(ENVELOPE_FUNCTION_AUTO)).toEqual({ fn: undefined });
  });

  it('έγκυρες τιμές → { fn }', () => {
    expect(parseEnvelopeFunctionValue('exterior')).toEqual({ fn: 'exterior' });
    expect(parseEnvelopeFunctionValue('interior')).toEqual({ fn: 'interior' });
  });

  it('άκυρη τιμή → null (no-op)', () => {
    expect(parseEnvelopeFunctionValue('bogus')).toBeNull();
    expect(parseEnvelopeFunctionValue('')).toBeNull();
  });

  it('ΠΟΤΕ δεν επιστρέφει literal auto ως τιμή πεδίου', () => {
    const parsed = parseEnvelopeFunctionValue(ENVELOPE_FUNCTION_AUTO);
    expect(parsed?.fn).toBeUndefined();
  });
});

describe('envelope-function-param — options', () => {
  it('3 επιλογές (auto/exterior/interior) με i18n keys (όχι literal labels)', () => {
    expect(ENVELOPE_FUNCTION_OPTIONS.map((o) => o.value)).toEqual(['auto', 'exterior', 'interior']);
    for (const opt of ENVELOPE_FUNCTION_OPTIONS) {
      expect(opt.isLiteralLabel).toBe(false);
      expect(opt.labelKey.startsWith('ribbon.commands.envelopeFunction.')).toBe(true);
    }
  });

  it('round-trip: read(parse(v).fn) === v για κάθε option', () => {
    for (const opt of ENVELOPE_FUNCTION_OPTIONS) {
      const parsed = parseEnvelopeFunctionValue(opt.value);
      expect(parsed).not.toBeNull();
      expect(readEnvelopeFunctionValue(parsed!.fn)).toBe(opt.value);
    }
  });
});
