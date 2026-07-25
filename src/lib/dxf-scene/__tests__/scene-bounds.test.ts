/**
 * Regression anchors for the DXF scene bounds SSoT.
 *
 * The union behaviour is deliberate: before centralization the thumbnail
 * generator ignored `lwpolyline` / `rectangle` and the text descender, so the
 * same drawing framed differently depending on which surface rendered it.
 * These tests pin the superset so the convergence cannot be undone by accident.
 */

import { computeSceneBounds } from '../scene-bounds';

describe('computeSceneBounds', () => {
  it('falls back to a 100×100 box for an empty or missing entity list', () => {
    const fallback = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };

    expect(computeSceneBounds([])).toEqual(fallback);
    expect(computeSceneBounds(undefined)).toEqual(fallback);
  });

  it('falls back when no entity carries a measurable coordinate', () => {
    expect(computeSceneBounds([{ type: 'hatch' }, { type: 'image' }])).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 100, y: 100 },
    });
  });

  it('measures line endpoints', () => {
    const bounds = computeSceneBounds([
      { type: 'line', start: { x: 1, y: 2 }, end: { x: 9, y: 8 } },
    ]);

    expect(bounds).toEqual({ min: { x: 1, y: 2 }, max: { x: 9, y: 8 } });
  });

  it('measures lwpolyline vertices — the type the thumbnail generator used to drop', () => {
    const bounds = computeSceneBounds([
      { type: 'lwpolyline', vertices: [{ x: -5, y: 0 }, { x: 5, y: 30 }] },
    ]);

    expect(bounds).toEqual({ min: { x: -5, y: 0 }, max: { x: 5, y: 30 } });
  });

  it('measures rectangle corners — also previously dropped by the thumbnail path', () => {
    const bounds = computeSceneBounds([
      { type: 'rectangle', corner1: { x: 2, y: 3 }, corner2: { x: 20, y: 30 } },
    ]);

    expect(bounds).toEqual({ min: { x: 2, y: 3 }, max: { x: 20, y: 30 } });
  });

  it('uses the conservative full-circle AABB for circle and arc', () => {
    expect(computeSceneBounds([{ type: 'arc', center: { x: 0, y: 0 }, radius: 7 }])).toEqual({
      min: { x: -7, y: -7 },
      max: { x: 7, y: 7 },
    });
  });

  it('expands a textNode entity DOWNWARD by its height (TL attachment descender)', () => {
    const bounds = computeSceneBounds([
      {
        type: 'text',
        position: { x: 0, y: 100 },
        height: 12,
        textNode: { paragraphs: [{ runs: [{ text: 'Α' }] }] },
      },
    ]);

    expect(bounds.min.y).toBe(88);
    expect(bounds.max.y).toBe(100);
  });

  it('does NOT expand a flat DXF-imported text entity (BL anchor, no descender box)', () => {
    const bounds = computeSceneBounds([
      { type: 'text', position: { x: 0, y: 100 }, height: 12, text: 'Α' },
    ]);

    expect(bounds.min.y).toBe(100);
    expect(bounds.max.y).toBe(100);
  });

  it('accumulates across mixed entity types', () => {
    const bounds = computeSceneBounds([
      { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      { type: 'circle', center: { x: 50, y: 50 }, radius: 5 },
      { type: 'polyline', vertices: [{ x: -20, y: 3 }] },
    ]);

    expect(bounds).toEqual({ min: { x: -20, y: 0 }, max: { x: 55, y: 55 } });
  });
});
