/**
 * ADR-189 (2026-06-12) — guide-drag OSNAP resolution.
 *
 * Dragging a guide near an entity endpoint shows the snap (✛) marker; releasing must
 * put the line THROUGH that point. resolveGuideDrag returns the snapped offset (live +
 * commit share it) or, with no snap, free delta tracking.
 */
import { resolveGuideDrag, getGuideDragSnapPoint } from '../guide-drag-snap';
import { setImmediateSnap, clearImmediateSnap } from '../../cursor/ImmediateSnapStore';

describe('guide-drag-snap', () => {
  afterEach(() => clearImmediateSnap());

  it('no snap → free delta tracking (X)', () => {
    clearImmediateSnap();
    const r = resolveGuideDrag('X', { x: 250, y: 40 }, { x: 200, y: 0 }, 1000);
    // delta = 250 - 200 = 50 → 1000 + 50
    expect(r.offset).toBe(1050);
    expect(r.snapPoint).toBeNull();
  });

  it('no snap → free delta tracking (Y)', () => {
    clearImmediateSnap();
    const r = resolveGuideDrag('Y', { x: 10, y: 330 }, { x: 0, y: 300 }, 500);
    expect(r.offset).toBe(530); // 500 + (330-300)
    expect(r.snapPoint).toBeNull();
  });

  it('snap engaged → X guide passes through snap.x (ignores delta)', () => {
    setImmediateSnap({ found: true, point: { x: 777, y: 123 }, mode: 'endpoint' });
    const r = resolveGuideDrag('X', { x: 250, y: 40 }, { x: 200, y: 0 }, 1000);
    expect(r.offset).toBe(777);
    expect(r.snapPoint).toEqual({ x: 777, y: 123 });
  });

  it('snap engaged → Y guide passes through snap.y', () => {
    setImmediateSnap({ found: true, point: { x: 50, y: 888 }, mode: 'endpoint' });
    const r = resolveGuideDrag('Y', { x: 10, y: 330 }, { x: 0, y: 300 }, 500);
    expect(r.offset).toBe(888);
    expect(r.snapPoint).toEqual({ x: 50, y: 888 });
  });

  it('snap with found=false is ignored (free tracking)', () => {
    setImmediateSnap({ found: false, point: { x: 777, y: 0 }, mode: '' });
    const r = resolveGuideDrag('X', { x: 250, y: 0 }, { x: 200, y: 0 }, 1000);
    expect(r.offset).toBe(1050);
    expect(r.snapPoint).toBeNull();
  });

  it('getGuideDragSnapPoint returns the active snap point or null', () => {
    clearImmediateSnap();
    expect(getGuideDragSnapPoint()).toBeNull();
    setImmediateSnap({ found: true, point: { x: 12, y: 34 }, mode: 'endpoint' });
    expect(getGuideDragSnapPoint()).toEqual({ x: 12, y: 34 });
  });
});
