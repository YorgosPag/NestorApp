/**
 * Tests for the status SSoT mirror helpers (ADR-197/287).
 * @see src/constants/commercial-statuses.ts
 */

import {
  COMMERCIAL_STATUSES,
  DEFAULT_COMMERCIAL_STATUS,
  deriveLegacyStatusFromCommercial,
} from '../commercial-statuses';

describe('commercial-statuses · legacy mirror', () => {
  it('defaults a new unit to "unavailable" (never reserved/for-sale)', () => {
    expect(DEFAULT_COMMERCIAL_STATUS).toBe('unavailable');
  });

  it('mirrors every canonical status to itself (idempotent identity)', () => {
    for (const status of COMMERCIAL_STATUSES) {
      expect(deriveLegacyStatusFromCommercial(status)).toBe(status);
    }
  });

  it('normalizes Greek + legacy aliases before mirroring', () => {
    expect(deriveLegacyStatusFromCommercial('πωλημένο')).toBe('sold');
    expect(deriveLegacyStatusFromCommercial('κρατημένο')).toBe('reserved');
    expect(deriveLegacyStatusFromCommercial('available')).toBe('for-sale');
    expect(deriveLegacyStatusFromCommercial('  AVAILABLE  ')).toBe('for-sale');
  });

  it('falls back to the default for unknown / empty / nullish input', () => {
    expect(deriveLegacyStatusFromCommercial('κάτι τυχαίο')).toBe('unavailable');
    expect(deriveLegacyStatusFromCommercial('')).toBe('unavailable');
    expect(deriveLegacyStatusFromCommercial(null)).toBe('unavailable');
    expect(deriveLegacyStatusFromCommercial(undefined)).toBe('unavailable');
    expect(deriveLegacyStatusFromCommercial(42)).toBe('unavailable');
  });
});
