/**
 * ADR-565 §12 Φ1.x — wall Draw-gallery mode registry tests.
 */

import { WALL_DRAW_MODES, activeWallDrawModeId } from '../wall-draw-mode';

describe('WALL_DRAW_MODES registry', () => {
  it('exposes the 6 Revit Draw-gallery modes with unique ids', () => {
    expect(WALL_DRAW_MODES).toHaveLength(6);
    const ids = WALL_DRAW_MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('every curved mode carries an arcVariant; straight/polyline do not', () => {
    for (const m of WALL_DRAW_MODES) {
      if (m.kind === 'curved') expect(m.arcVariant).toBeDefined();
      else expect(m.arcVariant).toBeUndefined();
    }
  });

  it('covers all 4 arc variants exactly once', () => {
    const variants = WALL_DRAW_MODES.filter((m) => m.kind === 'curved').map((m) => m.arcVariant).sort();
    expect(variants).toEqual(['3-point', 'center-ends', 'start-end-radius', 'tangent']);
  });
});

describe('activeWallDrawModeId', () => {
  it('straight → straight (arcVariant ignored)', () => {
    expect(activeWallDrawModeId('straight', '3-point')).toBe('straight');
    expect(activeWallDrawModeId('straight', 'tangent')).toBe('straight');
  });

  it('polyline → polyline', () => {
    expect(activeWallDrawModeId('polyline', '3-point')).toBe('polyline');
  });

  it('curved → the id of the matching arc variant', () => {
    expect(activeWallDrawModeId('curved', '3-point')).toBe('arc-3-point');
    expect(activeWallDrawModeId('curved', 'center-ends')).toBe('arc-center-ends');
    expect(activeWallDrawModeId('curved', 'start-end-radius')).toBe('arc-start-end-radius');
    expect(activeWallDrawModeId('curved', 'tangent')).toBe('arc-tangent');
  });
});
