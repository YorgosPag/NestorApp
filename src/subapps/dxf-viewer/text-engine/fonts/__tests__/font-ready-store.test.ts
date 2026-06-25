/**
 * ADR-530 — font-ready-store unit tests.
 */

import { subscribeFontReady, bumpFontReady, getFontReadyVersion } from '../font-ready-store';

describe('font-ready-store (ADR-530)', () => {
  it('increments the version and notifies subscribers on bump', () => {
    const before = getFontReadyVersion();
    const cb = jest.fn();
    const unsubscribe = subscribeFontReady(cb);

    bumpFontReady();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(getFontReadyVersion()).toBe(before + 1);

    unsubscribe();
    bumpFontReady();
    // No further notifications after unsubscribe.
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
