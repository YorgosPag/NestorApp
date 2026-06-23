/**
 * ADR-507 Φ3 — tests για το pick-point completion (Τρόπος Β).
 * ΕΝΑ κλικ μέσα σε περιοχή → HatchEntity με auto boundary (+ νησιά).
 */

import { buildHatchFromPick } from '../hatch-pick-completion';
import { resetHatchDrawDefaults, setHatchDrawDefaults } from '../hatch-draw-defaults-store';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

/** Helper: κλειστή πολυγραμμή ως Entity (αρκετό για τα type guards του auto-area). */
function closedPolyline(id: string, verts: Point2D[]): Entity {
  return { id, type: 'polyline', closed: true, vertices: verts } as unknown as Entity;
}

const OUTER: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];
const INNER: Point2D[] = [
  { x: 250, y: 250 },
  { x: 750, y: 250 },
  { x: 750, y: 750 },
  { x: 250, y: 750 },
];

describe('buildHatchFromPick (ADR-507 Φ3)', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('returns null when the click is outside every closed region', () => {
    const h = buildHatchFromPick({
      worldPoint: { x: 5000, y: 5000 },
      entities: [closedPolyline('p1', OUTER)],
      overlays: [],
      scale: 1,
      id: 'e1',
      layerId: undefined,
    });
    expect(h).toBeNull();
  });

  it('builds a hatch from the closed polyline under the cursor', () => {
    const h = buildHatchFromPick({
      worldPoint: { x: 500, y: 500 },
      entities: [closedPolyline('p1', OUTER)],
      overlays: [],
      scale: 1,
      id: 'e1',
      layerId: 'lyr',
    })!;
    expect(h.type).toBe('hatch');
    expect(h.boundaryPaths[0]).toHaveLength(4);
    expect(h.layerId).toBe('lyr');
  });

  it('captures an inner region as a hole when clicking the annulus', () => {
    const h = buildHatchFromPick({
      // (100,100) είναι μέσα στο OUTER αλλά έξω από το INNER → best=OUTER, hole=INNER.
      worldPoint: { x: 100, y: 100 },
      entities: [closedPolyline('outer', OUTER), closedPolyline('inner', INNER)],
      overlays: [],
      scale: 1,
      id: 'e2',
      layerId: undefined,
    })!;
    expect(h.boundaryPaths.length).toBeGreaterThanOrEqual(2);
  });

  it('carries the current draw-defaults (fillType) into the picked hatch', () => {
    setHatchDrawDefaults({ fillType: 'predefined', patternName: 'ANSI31' });
    const h = buildHatchFromPick({
      worldPoint: { x: 500, y: 500 },
      entities: [closedPolyline('p1', OUTER)],
      overlays: [],
      scale: 1,
      id: 'e3',
      layerId: undefined,
    })!;
    expect(h.fillType).toBe('predefined');
    expect(h.patternName).toBe('ANSI31');
  });
});
