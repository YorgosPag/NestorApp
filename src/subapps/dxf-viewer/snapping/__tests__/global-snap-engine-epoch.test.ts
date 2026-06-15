/**
 * ADR-040 (Giorgio 2026-06-16) — snap-scene epoch invalidation contract.
 *
 * Regression guard for the "snap freezes at the old position after the first
 * move" bug: the scene-sync fingerprint (length + first/last ids) is blind to
 * in-place geometry edits, so `invalidateSnapScene()` provides a monotonic
 * counter that the fingerprint folds in to force a re-`initialize()`.
 */

import {
  getSnapSceneEpoch,
  invalidateSnapScene,
  __resetGlobalSnapEngineForTests,
} from '../global-snap-engine';

describe('global-snap-engine — snap-scene epoch', () => {
  afterEach(() => {
    __resetGlobalSnapEngineForTests();
  });

  it('starts at 0 after reset', () => {
    __resetGlobalSnapEngineForTests();
    expect(getSnapSceneEpoch()).toBe(0);
  });

  it('increments monotonically on every invalidation (each command → re-init)', () => {
    __resetGlobalSnapEngineForTests();
    const start = getSnapSceneEpoch();
    invalidateSnapScene();
    invalidateSnapScene();
    invalidateSnapScene();
    expect(getSnapSceneEpoch()).toBe(start + 3);
  });

  it('reset returns the epoch to 0 (test isolation)', () => {
    invalidateSnapScene();
    expect(getSnapSceneEpoch()).toBeGreaterThan(0);
    __resetGlobalSnapEngineForTests();
    expect(getSnapSceneEpoch()).toBe(0);
  });
});
