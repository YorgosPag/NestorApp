/**
 * ADR-399 — viewport-autofit-policy SSoT unit tests.
 *
 * Locks the single «when does the viewport auto-fit?» decision that replaced the
 * three scattered triggers, and the ADR-418 degenerate-restore guard.
 */

import {
  resolveAutoFitAction,
  isDegenerateRestoreScale,
  type AutoFitPolicyInput,
} from '../viewport-autofit-policy';

const input = (over: Partial<AutoFitPolicyInput>): AutoFitPolicyInput => ({
  hasContent: true,
  hasFittedOnce: true,
  levelChanged: false,
  fileChanged: false,
  freshImport: false,
  ...over,
});

describe('resolveAutoFitAction', () => {
  it('no content → skip (nothing to frame)', () => {
    expect(resolveAutoFitAction(input({ hasContent: false, hasFittedOnce: false }))).toBe('skip');
  });

  it('first content of the session → initial (restore-or-fit)', () => {
    expect(resolveAutoFitAction(input({ hasFittedOnce: false }))).toBe('initial');
  });

  it('genuine re-import (new file, SAME level) → fit', () => {
    expect(resolveAutoFitAction(input({ fileChanged: true, levelChanged: false }))).toBe('fit');
  });

  it('navigation (file changed BUT level changed) → skip — keep viewport stable', () => {
    expect(resolveAutoFitAction(input({ fileChanged: true, levelChanged: true }))).toBe('skip');
  });

  it('pure navigation to an empty floor (no file change) → skip', () => {
    expect(resolveAutoFitAction(input({ levelChanged: true, fileChanged: false }))).toBe('skip');
  });

  it('drawing / subsequent mutation (no file/level change) → skip', () => {
    expect(resolveAutoFitAction(input({}))).toBe('skip');
  });

  it('initial wins even if a file/level also changed on the very first content', () => {
    expect(resolveAutoFitAction(input({ hasFittedOnce: false, fileChanged: true, levelChanged: true }))).toBe('initial');
  });

  // Giorgio 2026-07-11 — a user-initiated file import ALWAYS fits to extents.
  it('fresh import → fit (even on first content, overriding restore/initial)', () => {
    expect(resolveAutoFitAction(input({ freshImport: true, hasFittedOnce: false }))).toBe('fit');
  });

  it('fresh import → fit (even when re-importing under the same session)', () => {
    expect(resolveAutoFitAction(input({ freshImport: true, hasFittedOnce: true }))).toBe('fit');
  });

  it('fresh import → fit (overrides what would be a navigation skip)', () => {
    expect(resolveAutoFitAction(input({ freshImport: true, fileChanged: true, levelChanged: true }))).toBe('fit');
  });

  it('fresh import with NO content → still skip (nothing to frame)', () => {
    expect(resolveAutoFitAction(input({ freshImport: true, hasContent: false }))).toBe('skip');
  });
});

describe('isDegenerateRestoreScale (ADR-418)', () => {
  const MIN = 5; // px

  it('content collapsing below the min visible px → degenerate', () => {
    // diagonal 10 units × scale 0.1 = 1px < 5px
    expect(isDegenerateRestoreScale(10, 0.1, MIN)).toBe(true);
  });

  it('content comfortably visible → not degenerate', () => {
    // 1000 units × 1 = 1000px
    expect(isDegenerateRestoreScale(1000, 1, MIN)).toBe(false);
  });

  it('non-finite / non-positive inputs → not degenerate (no opinion)', () => {
    expect(isDegenerateRestoreScale(0, 1, MIN)).toBe(false);
    expect(isDegenerateRestoreScale(10, 0, MIN)).toBe(false);
    expect(isDegenerateRestoreScale(NaN, 1, MIN)).toBe(false);
    expect(isDegenerateRestoreScale(10, Infinity, MIN)).toBe(false);
  });
});
