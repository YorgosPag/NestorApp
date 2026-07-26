/**
 * ADR-040 Phase XXIII / ADR-366 Phase 4.2 — Scene-dirty predicate SSoT tests.
 *
 * The predicate decides whether `ThreeJsSceneManager.tick()` will run this frame
 * (called by `UnifiedFrameScheduler` via its `isDirty` registration hook). Five
 * inputs OR together — each branch must independently mark the scene dirty,
 * and the all-false case must let the scheduler skip the system entirely.
 */

import { isSceneDirtyFromState, type SceneDirtyState } from '../scene-dirty-state';
import { RedrawLevel, allDirtyRedrawLevels } from '../scene-redraw-level';

const allClean: SceneDirtyState = {
  isInteracting: false,
  viewportAnimating: false,
  animationManagerActive: false,
  pathTracerActive: false,
  meshRevealActive: false,
  requestedRedraw: RedrawLevel.NONE,
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

  // ADR-693 Φ2 — η σκηνή είναι on-demand: χωρίς αυτή την είσοδο το fade αποκάλυψης θα πάγωνε
  // στο πρώτο καρέ, αφού καμία άλλη μεταβολή δεν ζητά redraw στα ~260ms που διαρκεί.
  it('returns true while a mesh reveal veil is fading (ADR-693 Φ2)', () => {
    expect(isSceneDirtyFromState({ ...allClean, meshRevealActive: true })).toBe(true);
  });

  it('returns true on an explicit FULL redraw request (mutation path)', () => {
    expect(isSceneDirtyFromState({ ...allClean, requestedRedraw: RedrawLevel.FULL })).toBe(true);
  });

  /**
   * ADR-549 Φ4 — ΤΟ ΑΓΚΙΣΤΡΟ ΤΟΥ INCIDENT (2026-07-26). Το `markHoverDirty` σήκωνε δικό του
   * boolean που το gate δεν διάβαζε ΠΟΤΕ → το `tick()` δεν καλούνταν → το κίτρινο περίγραμμα των
   * BIM στοιχείων δεν εμφανιζόταν, με ΟΛΗ την υπόλοιπη αλυσίδα υγιή. Ο έλεγχος είναι εξαντλητικός
   * πάνω στο `allDirtyRedrawLevels()`: κάθε ΝΕΟ επίπεδο που θα προστεθεί στο `RedrawLevel`
   * μπαίνει αυτόματα εδώ και οφείλει να ανοίγει το gate — δεν χρειάζεται να το θυμηθεί κανείς.
   */
  it.each(allDirtyRedrawLevels())('returns true for EVERY dirty redraw level (level %i)', (level) => {
    expect(isSceneDirtyFromState({ ...allClean, requestedRedraw: level })).toBe(true);
  });

  it('returns false ONLY for RedrawLevel.NONE (idle contract)', () => {
    expect(isSceneDirtyFromState({ ...allClean, requestedRedraw: RedrawLevel.NONE })).toBe(false);
  });

  it('returns true when multiple inputs are dirty (logical OR)', () => {
    expect(
      isSceneDirtyFromState({
        isInteracting: true,
        viewportAnimating: true,
        animationManagerActive: false,
        pathTracerActive: false,
        meshRevealActive: false,
        requestedRedraw: RedrawLevel.FULL,
      }),
    ).toBe(true);
  });

  it('is referentially pure (same input → same output)', () => {
    const input: SceneDirtyState = { ...allClean, requestedRedraw: RedrawLevel.FULL };
    const first = isSceneDirtyFromState(input);
    const second = isSceneDirtyFromState(input);
    expect(first).toBe(second);
  });
});
