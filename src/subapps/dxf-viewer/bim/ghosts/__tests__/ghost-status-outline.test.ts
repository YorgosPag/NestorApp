/**
 * ADR-508 — resolveStatusGhostOutline: footprint polygon for the 🔴 status ghost from any
 * BIM entity shape (column/beam outline.vertices · wall outerEdge+innerEdge).
 */

import { resolveStatusGhostOutline } from '../ghost-status-outline';

describe('resolveStatusGhostOutline', () => {
  it('returns outline.vertices directly (column/beam)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    expect(resolveStatusGhostOutline({ geometry: { outline: { vertices: verts } } })).toBe(verts);
  });

  it('returns polygon.vertices for slab / slab-opening (ADR-574 Σ2b)', () => {
    const verts = [{ x: 0, y: 0, z: 0 }, { x: 1500, y: 0, z: 0 }, { x: 1500, y: 1500, z: 0 }, { x: 0, y: 1500, z: 0 }];
    expect(resolveStatusGhostOutline({ geometry: { polygon: { vertices: verts } } })).toBe(verts);
  });

  it('prefers outline.vertices over polygon.vertices when both present', () => {
    const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const polygon = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 8, y: 8 }];
    expect(
      resolveStatusGhostOutline({ geometry: { outline: { vertices: outline }, polygon: { vertices: polygon } } }),
    ).toBe(outline);
  });

  it('builds the wall footprint loop from outerEdge + reversed innerEdge', () => {
    const out = resolveStatusGhostOutline({
      geometry: {
        outerEdge: { points: [{ x: 0, y: 100, z: 0 }, { x: 1000, y: 100, z: 0 }] },
        innerEdge: { points: [{ x: 0, y: -100, z: 0 }, { x: 1000, y: -100, z: 0 }] },
      },
    });
    // outer forward + inner reversed → closed rectangle (z dropped)
    expect(out).toEqual([
      { x: 0, y: 100 }, { x: 1000, y: 100 }, { x: 1000, y: -100 }, { x: 0, y: -100 },
    ]);
  });

  it('null when geometry is missing or unusable', () => {
    expect(resolveStatusGhostOutline(null)).toBeNull();
    expect(resolveStatusGhostOutline({})).toBeNull();
    expect(resolveStatusGhostOutline({ geometry: { outline: { vertices: [{ x: 0, y: 0 }] } } })).toBeNull();
    expect(resolveStatusGhostOutline({ geometry: { outerEdge: { points: [{ x: 0, y: 0 }] } } })).toBeNull();
  });
});
