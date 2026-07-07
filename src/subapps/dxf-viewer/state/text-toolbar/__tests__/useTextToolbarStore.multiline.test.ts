/**
 * ADR-557 — `isMultiLine` derived-flag plumbing on the text toolbar store.
 *
 * The flag drives the MTEXT-only visibility of the ribbon «Διάστιχο» widget. It is
 * DERIVED (set at populate time from the `textLineCount` SSoT in
 * `useTextToolbarSelectionSync`), NOT a committable `TextToolbarValues` field — so it
 * must ride the SAME atomic populate write (under the `isPopulating` guard) and reset
 * to `false` on `reset()`.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { useTextToolbarStore } from '../useTextToolbarStore';

describe('useTextToolbarStore — isMultiLine', () => {
  beforeEach(() => {
    useTextToolbarStore.getState().reset();
  });

  it('defaults to false', () => {
    expect(useTextToolbarStore.getState().isMultiLine).toBe(false);
  });

  it('populate sets isMultiLine from meta and raises isPopulating in the same write', () => {
    useTextToolbarStore.getState().populate({ lineSpacingFactor: 2 }, { isMultiLine: true });
    const s = useTextToolbarStore.getState();
    expect(s.isMultiLine).toBe(true);
    expect(s.lineSpacingFactor).toBe(2);
    // The flag is written atomically while the populate guard is up, so the command
    // bridge never treats it as a user edit.
    expect(s.isPopulating).toBe(true);
  });

  it('populate without meta leaves isMultiLine unchanged', () => {
    useTextToolbarStore.getState().populate({}, { isMultiLine: true });
    useTextToolbarStore.getState().populate({ lineSpacingFactor: 1.5 });
    expect(useTextToolbarStore.getState().isMultiLine).toBe(true);
  });

  it('populate can turn isMultiLine back off (single-line selection)', () => {
    useTextToolbarStore.getState().populate({}, { isMultiLine: true });
    useTextToolbarStore.getState().populate({}, { isMultiLine: false });
    expect(useTextToolbarStore.getState().isMultiLine).toBe(false);
  });

  it('reset clears isMultiLine', () => {
    useTextToolbarStore.getState().populate({}, { isMultiLine: true });
    useTextToolbarStore.getState().reset();
    expect(useTextToolbarStore.getState().isMultiLine).toBe(false);
  });
});
