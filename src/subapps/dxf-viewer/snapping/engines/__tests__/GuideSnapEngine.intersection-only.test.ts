/**
 * ADR-189 (2026-06-12) — GuideSnapEngine intersection-only drawing policy.
 *
 * Giorgio: while DRAWING, guides attract ONLY at their intersections (✕). The
 * single-guide "slide along the line" snaps are suppressed; outside drawing mode
 * the full guide snapping (line slides) stays active. The ✕ crossing is emitted in
 * BOTH modes.
 */

import { GuideSnapEngine } from '../GuideSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import { setSnapDrawingMode } from '../../../systems/cursor/SnapDrawingModeStore';

function makeContext(): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10 };
}

describe('GuideSnapEngine — intersection-only while drawing', () => {
  let engine: GuideSnapEngine;
  const store = getGlobalGuideStore();

  beforeEach(() => {
    engine = new GuideSnapEngine();
    store.clear();
    store.setVisible(true);
    setSnapDrawingMode(false);
  });
  afterEach(() => {
    engine.dispose();
    store.clear();
    setSnapDrawingMode(false);
  });

  it('drawing OFF: a single vertical guide produces a line slide snap', () => {
    store.addGuide({ axis: 'X', offset: 0, label: null, group_id: null });
    const { candidates } = engine.findSnapCandidates({ x: 5, y: 100 }, makeContext());
    const line = candidates.find((c) => c.type === ExtendedSnapType.GUIDE);
    expect(line).toBeDefined();
    expect(line!.point.x).toBeCloseTo(0, 5); // snapped X to the guide offset
    expect(line!.point.y).toBeCloseTo(100, 5); // Y tracks cursor (slides along line)
  });

  it('drawing ON: a single guide produces NO line snap (suppressed)', () => {
    store.addGuide({ axis: 'X', offset: 0, label: null, group_id: null });
    setSnapDrawingMode(true);
    const { candidates } = engine.findSnapCandidates({ x: 5, y: 100 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('drawing ON: a vertical+horizontal crossing still emits the ✕ INTERSECTION', () => {
    store.addGuide({ axis: 'X', offset: 0, label: null, group_id: null });
    store.addGuide({ axis: 'Y', offset: 0, label: null, group_id: null });
    setSnapDrawingMode(true);
    const { candidates } = engine.findSnapCandidates({ x: 5, y: 5 }, makeContext());
    const cross = candidates.find((c) => c.type === ExtendedSnapType.INTERSECTION);
    expect(cross).toBeDefined();
    expect(cross!.point.x).toBeCloseTo(0, 5);
    expect(cross!.point.y).toBeCloseTo(0, 5);
    // No silent single-line slide candidates leak through in intersection-only mode.
    expect(candidates.some((c) => c.type === ExtendedSnapType.GUIDE)).toBe(false);
  });

  it('drawing OFF: the crossing still emits the ✕ INTERSECTION (unchanged in both modes)', () => {
    store.addGuide({ axis: 'X', offset: 0, label: null, group_id: null });
    store.addGuide({ axis: 'Y', offset: 0, label: null, group_id: null });
    const { candidates } = engine.findSnapCandidates({ x: 5, y: 5 }, makeContext());
    expect(candidates.some((c) => c.type === ExtendedSnapType.INTERSECTION)).toBe(true);
  });

  it('drawing ON: a single diagonal (XZ) guide produces no slide snap', () => {
    store.addGuide({ axis: 'XZ', offset: 0, label: null, group_id: null });
    // XZ guides need endpoints; the store may not set them via addGuide — guard by
    // asserting the intersection-only path never emits a GUIDE candidate regardless.
    setSnapDrawingMode(true);
    const { candidates } = engine.findSnapCandidates({ x: 50, y: 50 }, makeContext());
    expect(candidates.some((c) => c.type === ExtendedSnapType.GUIDE)).toBe(false);
  });
});
