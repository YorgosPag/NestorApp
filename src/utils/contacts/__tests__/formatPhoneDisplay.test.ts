/**
 * Unit tests for the SSoT phone display helper.
 *
 * These tests lock the output contract so consumers (contact cards, audit
 * trail, relationship summaries, share text) stay in sync when new fields
 * are added to `PhoneInfo`. The 2026-04-23 regression that introduced
 * `extension` is the canonical example: several read-sites inlined
 * `${countryCode} ${number}` and would have missed the new field without
 * this helper.
 *
 * @module utils/contacts/__tests__/formatPhoneDisplay
 */

import { formatPhoneDisplay } from '../formatPhoneDisplay';

describe('formatPhoneDisplay', () => {
  describe('empty / missing input', () => {
    it('returns empty string when phone is null', () => {
      expect(formatPhoneDisplay(null)).toBe('');
    });

    it('returns empty string when phone is undefined', () => {
      expect(formatPhoneDisplay(undefined)).toBe('');
    });

    it('returns empty string when number is missing', () => {
      expect(formatPhoneDisplay({ number: '', countryCode: '+30' })).toBe('');
    });

    it('returns empty string when number is only whitespace', () => {
      // Empty number short-circuits via truthiness — whitespace-only passes
      // through so callers can distinguish an intentional space-padded value
      // from genuinely missing data. This guards against silently dropping
      // edge-case input instead of exposing it.
      expect(formatPhoneDisplay({ number: '   ', countryCode: '+30' })).toBe('+30');
    });
  });

  describe('country code handling', () => {
    it('prepends phone.countryCode when provided', () => {
      expect(
        formatPhoneDisplay({ number: '2310123456', countryCode: '+49' }),
      ).toBe('+49 2310123456');
    });

    it('falls back to +30 when countryCode is missing', () => {
      expect(formatPhoneDisplay({ number: '2310123456' })).toBe('+30 2310123456');
    });

    it('honors defaultCountryCode override', () => {
      expect(
        formatPhoneDisplay({ number: '2310123456' }, { defaultCountryCode: '+44' }),
      ).toBe('+44 2310123456');
    });

    it('omits country code entirely when omitCountryCode is true', () => {
      expect(
        formatPhoneDisplay(
          { number: '2310123456', countryCode: '+30' },
          { omitCountryCode: true },
        ),
      ).toBe('2310123456');
    });

    it('trims whitespace in the country code', () => {
      expect(
        formatPhoneDisplay({ number: '2310123456', countryCode: '  +30  ' }),
      ).toBe('+30 2310123456');
    });
  });

  describe('number rendering', () => {
    it('trims leading/trailing whitespace in the number', () => {
      expect(
        formatPhoneDisplay({ number: '  2310123456  ', countryCode: '+30' }),
      ).toBe('+30 2310123456');
    });

    it('preserves internal spacing (human-formatted numbers)', () => {
      expect(
        formatPhoneDisplay({ number: '2310 123 456', countryCode: '+30' }),
      ).toBe('+30 2310 123 456');
    });
  });

  describe('extension rendering — the 2026-04-23 contract', () => {
    it('appends extension in parenthesis when no localized label is given', () => {
      expect(
        formatPhoneDisplay({
          number: '2310123456',
          countryCode: '+30',
          extension: '123',
        }),
      ).toBe('+30 2310123456 (123)');
    });

    it('appends localized "εσωτ." short label when provided', () => {
      expect(
        formatPhoneDisplay(
          { number: '2310123456', countryCode: '+30', extension: '123' },
          { extensionShort: 'εσωτ.' },
        ),
      ).toBe('+30 2310123456 εσωτ. 123');
    });

    it('appends localized "ext." short label when provided', () => {
      expect(
        formatPhoneDisplay(
          { number: '2310123456', countryCode: '+30', extension: '99' },
          { extensionShort: 'ext.' },
        ),
      ).toBe('+30 2310123456 ext. 99');
    });

    it('trims whitespace around the extension', () => {
      expect(
        formatPhoneDisplay({
          number: '2310123456',
          countryCode: '+30',
          extension: '  123  ',
        }),
      ).toBe('+30 2310123456 (123)');
    });

    it('drops the suffix when extension is an empty string', () => {
      expect(
        formatPhoneDisplay({
          number: '2310123456',
          countryCode: '+30',
          extension: '',
        }),
      ).toBe('+30 2310123456');
    });

    it('drops the suffix when extension is whitespace-only', () => {
      expect(
        formatPhoneDisplay({
          number: '2310123456',
          countryCode: '+30',
          extension: '   ',
        }),
      ).toBe('+30 2310123456');
    });

    it('combines extension with omitCountryCode (contact card variant)', () => {
      expect(
        formatPhoneDisplay(
          { number: '2310123456', countryCode: '+30', extension: '42' },
          { omitCountryCode: true, extensionShort: 'εσωτ.' },
        ),
      ).toBe('2310123456 εσωτ. 42');
    });

    it('renders extension even when extension is numeric-looking with leading zeros', () => {
      // PBX extensions can legitimately start with 0 — must preserve the raw
      // token instead of coercing to a Number.
      expect(
        formatPhoneDisplay({
          number: '2310123456',
          countryCode: '+30',
          extension: '007',
        }),
      ).toBe('+30 2310123456 (007)');
    });
  });

  describe('regression guards', () => {
    it('matches the legacy inline format for phones without extension', () => {
      // Equivalence check against the pre-helper template literal
      // `${countryCode || '+30'} ${number}`. Keeps existing UI output stable
      // for phones that never had an extension.
      const phone = { number: '6971234567', countryCode: '+30' };
      const legacy = `${phone.countryCode || '+30'} ${phone.number}`;
      expect(formatPhoneDisplay(phone)).toBe(legacy);
    });

    it('never returns undefined or null — always a string', () => {
      expect(typeof formatPhoneDisplay(null)).toBe('string');
      expect(typeof formatPhoneDisplay(undefined)).toBe('string');
      expect(typeof formatPhoneDisplay({ number: '' })).toBe('string');
      expect(typeof formatPhoneDisplay({ number: '2310123456' })).toBe('string');
    });
  });
});
