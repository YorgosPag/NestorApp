/**
 * ADR-040 Φ12 — resolveGripTranslateDelta SSoT parity.
 *
 * The live synchronous grip ghost (useGripGhostPreview) and the React-path
 * buildDxfDragPreview MUST derive the translate delta identically, so the ghost
 * == the committed result. This locks the helper to the exact constraint pipeline
 * (`applyMoveConstraints` for whole-entity moves, `applyResizeConstraints` for
 * parametric resize grips — both now ORTHO-aware), regardless of the current CAD
 * toggle (ORTHO/F9/Shift) state.
 */

import { resolveGripTranslateDelta } from '../grip-projections';
import { applyMoveConstraints, applyResizeConstraints } from '../../../bim/grips/grip-move-constraints';

describe('resolveGripTranslateDelta (ADR-040 Φ12 SSoT)', () => {
  const anchor = { x: 10, y: 20 };
  const world = { x: 33, y: 57 };
  const rawDelta = { x: world.x - anchor.x, y: world.y - anchor.y };

  it('whole-entity move → applyMoveConstraints(rawDelta)', () => {
    expect(resolveGripTranslateDelta(anchor, world, true)).toEqual(applyMoveConstraints(rawDelta));
  });

  it('parametric resize → applyResizeConstraints(rawDelta)', () => {
    expect(resolveGripTranslateDelta(anchor, world, false)).toEqual(applyResizeConstraints(rawDelta));
  });

  it('zero cursor delta → zero delta in both modes', () => {
    expect(resolveGripTranslateDelta(anchor, anchor, true)).toEqual(applyMoveConstraints({ x: 0, y: 0 }));
    expect(resolveGripTranslateDelta(anchor, anchor, false)).toEqual(applyResizeConstraints({ x: 0, y: 0 }));
  });
});
