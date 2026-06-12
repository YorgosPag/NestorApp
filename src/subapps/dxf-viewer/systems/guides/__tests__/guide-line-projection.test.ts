/**
 * ADR-189 (2026-06-12) — guide line projection + edit-tool predicate.
 * SSoT used by the crosshair hover-lock («ο σταυρός κολλάει στο σώμα της γραμμής
 * όταν έχει φωτιστεί») and the click guide snapping.
 */
import { projectPointOntoGuide, isGuideEditTool } from '../guide-types';
import type { Guide } from '../guide-types';

function guide(partial: Partial<Guide>): Guide {
  return {
    id: 'g1', axis: 'X', offset: 0, label: null, style: null, visible: true,
    locked: false, createdAt: '', parentId: null, groupId: null, ...partial,
  } as Guide;
}

describe('projectPointOntoGuide', () => {
  it('vertical (X) guide: locks X to offset, keeps Y (slides vertically)', () => {
    const p = projectPointOntoGuide(guide({ axis: 'X', offset: 500 }), { x: 480, y: 1234 });
    expect(p).toEqual({ x: 500, y: 1234 });
  });

  it('horizontal (Y) guide: locks Y to offset, keeps X (slides horizontally)', () => {
    const p = projectPointOntoGuide(guide({ axis: 'Y', offset: 300 }), { x: 999, y: 280 });
    expect(p).toEqual({ x: 999, y: 300 });
  });

  it('diagonal (XZ) guide: perpendicular projection onto the segment', () => {
    const g = guide({ axis: 'XZ', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 } });
    const p = projectPointOntoGuide(g, { x: 40, y: 25 });
    expect(p.x).toBeCloseTo(40, 5);
    expect(p.y).toBeCloseTo(0, 5); // dropped onto the horizontal segment
  });

  it('XZ without endpoints: returns the point unchanged (defensive)', () => {
    const p = projectPointOntoGuide(guide({ axis: 'XZ' }), { x: 7, y: 9 });
    expect(p).toEqual({ x: 7, y: 9 });
  });
});

describe('isGuideEditTool', () => {
  it('true for tools that act on an existing guide', () => {
    expect(isGuideEditTool('guide-move')).toBe(true);
    expect(isGuideEditTool('guide-delete')).toBe(true);
    expect(isGuideEditTool('guide-parallel')).toBe(true);
    expect(isGuideEditTool('guide-mirror')).toBe(true);
  });

  it('false for placement / non-guide tools and nullish', () => {
    expect(isGuideEditTool('guide-x')).toBe(false); // places a NEW guide
    expect(isGuideEditTool('line')).toBe(false);
    expect(isGuideEditTool('select')).toBe(false);
    expect(isGuideEditTool(null)).toBe(false);
    expect(isGuideEditTool(undefined)).toBe(false);
  });
});
