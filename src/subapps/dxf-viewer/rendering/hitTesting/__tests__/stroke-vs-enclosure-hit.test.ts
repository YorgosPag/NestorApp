/**
 * Big-player selection model (Revit / ArchiCAD / Figma / AutoCAD):
 *  - a wireframe CLOSED polyline is hit by its OUTLINE only (stroke), never by its fill body,
 *    so concentric rings (e.g. contours) don't get swallowed by the outermost ring;
 *  - «click INSIDE a closed area» is an EXPLICIT, opt-in capability (`pickTopEntityAt … includeEnclosure`)
 *    used only by tools that want it (e.g. the site-boundary pick), never by general hover/select.
 */

import type { Entity } from '../../../types/entities';
import { performDetailedHitTest } from '../hit-test-entity-tests';
import { pickTopEntityAt } from '../pick-top-entity-at';
import { isPointInsideClosedEntity } from '../enclosure-hit';

function ring(id: string, half: { x0: number; y0: number; x1: number; y1: number }): Entity {
  return {
    id, type: 'lwpolyline', layerId: 'L', closed: true,
    vertices: [
      { x: half.x0, y: half.y0 }, { x: half.x1, y: half.y0 },
      { x: half.x1, y: half.y1 }, { x: half.x0, y: half.y1 },
    ],
  } as unknown as Entity;
}

// Two concentric closed rings; the inner is drawn last (topmost).
const outer = ring('outer', { x0: 0, y0: 0, x1: 100, y1: 100 });
const inner = ring('inner', { x0: 40, y0: 40, x1: 60, y1: 60 });
const scene = [outer, inner];
const all = () => true;

describe('hitTestPolyline is stroke-only (closed polylines)', () => {
  it('hits ON the outline', () => {
    expect(performDetailedHitTest(inner, { x: 50, y: 40 }, 1)).not.toBeNull(); // on inner top edge
  });

  it('does NOT hit inside the body (no fill fallback)', () => {
    expect(performDetailedHitTest(outer, { x: 50, y: 50 }, 1)).toBeNull(); // deep inside, off every edge
  });

  it('the outer ring no longer swallows a point on the inner ring', () => {
    // (50,40) is on the inner stroke but 40 units from any outer edge → outer must miss.
    expect(performDetailedHitTest(outer, { x: 50, y: 40 }, 1)).toBeNull();
  });
});

describe('pickTopEntityAt — general selection stays stroke-only', () => {
  it('picks the inner ring when hovering its stroke (not the enclosing outer)', () => {
    expect(pickTopEntityAt({ x: 50, y: 40 }, scene, all, 1)).toBe('inner');
  });

  it('picks nothing when clicking empty space inside the rings', () => {
    expect(pickTopEntityAt({ x: 50, y: 50 }, scene, all, 1)).toBeNull();
  });
});

describe('pickTopEntityAt { includeEnclosure } — explicit opt-in inside pick (boundary tool)', () => {
  const enclose = { includeEnclosure: true };

  it('picks the topmost ring that ENCLOSES an interior click', () => {
    expect(pickTopEntityAt({ x: 50, y: 50 }, scene, all, 1, enclose)).toBe('inner');
  });

  it('falls through to the outer ring when inside it but outside the inner', () => {
    expect(pickTopEntityAt({ x: 10, y: 10 }, scene, all, 1, enclose)).toBe('outer');
  });

  it('still picks by the outline (stroke OR enclosure)', () => {
    expect(pickTopEntityAt({ x: 0, y: 50 }, scene, all, 1, enclose)).toBe('outer'); // on outer edge
  });

  it('picks nothing fully outside every ring', () => {
    expect(pickTopEntityAt({ x: 500, y: 500 }, scene, all, 1, enclose)).toBeNull();
  });
});

describe('isPointInsideClosedEntity SSoT', () => {
  it('true only for a closed ring that actually contains the point', () => {
    expect(isPointInsideClosedEntity(inner, { x: 50, y: 50 })).toBe(true);
    expect(isPointInsideClosedEntity(inner, { x: 5, y: 5 })).toBe(false);
  });

  it('false for an open polyline (no inside)', () => {
    const open = { ...ring('o', { x0: 0, y0: 0, x1: 10, y1: 10 }), closed: false } as unknown as Entity;
    expect(isPointInsideClosedEntity(open, { x: 5, y: 5 })).toBe(false);
  });
});
