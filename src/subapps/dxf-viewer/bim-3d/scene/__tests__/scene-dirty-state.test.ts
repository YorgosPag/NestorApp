/**
 * ADR-040 Phase XXIII / ADR-366 Phase 4.2 — Scene-dirty predicate SSoT tests.
 *
 * The predicate decides whether `ThreeJsSceneManager.tick()` will run this frame
 * (called by `UnifiedFrameScheduler` via its `isDirty` registration hook). Five
 * inputs OR together — each branch must independently mark the scene dirty,
 * and the all-false case must let the scheduler skip the system entirely.
 */

import { isSceneDirtyFromState, type SceneDirtyState } from '../scene-dirty-state';

const allClean: SceneDirtyState = {
  isInteracting: false,
  viewportAnimating: false,
  animationManagerActive: false,
  pathTracerActive: false,
  explicitDirty: false,
};

describe('isSceneDirtyFromState — ADR-040 Phase XXIII', () => {
  it('returns false when every input is clean (idle case → scheduler skips)', () => {
    expect(isSceneDirtyFromState(allClean)).toBe(false);
  });

  it('returns true while user interacts (orbit/pan/dolly)', () => {
    expect(isSceneDirtyFromState({ ...allClean, isInteracting: true })).toBe(true);
  });

  it('returns true during viewport animations (canonical view transitions)', () => {
    expect(isSceneDirtyFromState({ ...allClean, viewportAnimating: true })).toBe(true);
  });

  it('returns true during animation-manager (turntable / Bezier / render queue)', () => {
    expect(isSceneDirtyFromState({ ...allClean, animationManagerActive: true })).toBe(true);
  });

  it('returns true while path tracer renders progressive samples', () => {
    expect(isSceneDirtyFromState({ ...allClean, pathTracerActive: true })).toBe(true);
  });

  it('returns true on explicit dirty flag (mutation path)', () => {
    expect(isSceneDirtyFromState({ ...allClean, explicitDirty: true })).toBe(true);
  });

  it('returns true when multiple inputs are dirty (logical OR)', () => {
    expect(
      isSceneDirtyFromState({
        isInteracting: true,
        viewportAnimating: true,
        animationManagerActive: false,
        pathTracerActive: false,
        explicitDirty: true,
      }),
    ).toBe(true);
  });

  it('is referentially pure (same input → same output)', () => {
    const input: SceneDirtyState = { ...allClean, explicitDirty: true };
    const first = isSceneDirtyFromState(input);
    const second = isSceneDirtyFromState(input);
    expect(first).toBe(second);
  });
});
