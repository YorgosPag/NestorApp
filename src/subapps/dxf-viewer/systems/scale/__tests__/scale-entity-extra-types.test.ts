/**
 * Unit tests — scale transforms added in ADR-646 Φ2 (previously silent `default:{}` no-ops)
 * + the `isScalableEntityType` SSoT gate that drives the tool's skip-with-message.
 */
import { scaleEntity, isScalableEntityType } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';

const BASE = { x: 0, y: 0 };
const asEntity = (o: object): Entity => o as unknown as Entity;

describe('scaleEntity — ADR-646 Φ2 geometric additions (uniform ×2)', () => {
  it('xline / ray: anchors scale, direction (unit vector) untouched', () => {
    const r = scaleEntity(
      asEntity({ type: 'xline', basePoint: { x: 5, y: 0 }, direction: { x: 1, y: 0 }, secondPoint: { x: 5, y: 10 } }),
      BASE, 2, 2,
    ) as { basePoint: { x: number }; secondPoint: { y: number }; direction?: unknown };
    expect(r.basePoint.x).toBe(10);
    expect(r.secondPoint.y).toBe(20);
    expect(r.direction).toBeUndefined();
  });

  it('angle-measurement: all three world points scale', () => {
    const r = scaleEntity(
      asEntity({ type: 'angle-measurement', vertex: { x: 1, y: 1 }, point1: { x: 3, y: 1 }, point2: { x: 1, y: 3 }, angle: 90 }),
      BASE, 2, 2,
    ) as { vertex: { x: number; y: number }; point1: { x: number }; point2: { y: number } };
    expect(r.vertex).toEqual({ x: 2, y: 2 });
    expect(r.point1.x).toBe(6);
    expect(r.point2.y).toBe(6);
  });

  it('center-mark / centerline: world points scale, annotative size/extension preserved', () => {
    const cm = scaleEntity(asEntity({ type: 'center-mark', center: { x: 4, y: 4 }, size: 5 }), BASE, 2, 2) as { center: { x: number }; size?: number };
    expect(cm.center.x).toBe(8);
    expect(cm.size).toBeUndefined(); // paper-mm annotative — not scaled

    const cl = scaleEntity(asEntity({ type: 'centerline', start: { x: 1, y: 0 }, end: { x: 3, y: 0 }, extension: 2 }), BASE, 2, 2) as { start: { x: number }; end: { x: number }; extension?: number };
    expect(cl.start.x).toBe(2);
    expect(cl.end.x).toBe(6);
    expect(cl.extension).toBeUndefined();
  });

  it('annotation-symbol / scale-bar: position-only (annotative + scale-invariant preserved)', () => {
    const sym = scaleEntity(asEntity({ type: 'annotation-symbol', position: { x: 4, y: 0 }, sizeMm: 15 }), BASE, 2, 2) as { position: { x: number }; sizeMm?: number };
    expect(sym.position.x).toBe(8);
    expect(sym.sizeMm).toBeUndefined();

    const bar = scaleEntity(asEntity({ type: 'scale-bar', position: { x: 4, y: 0 }, length: 10 }), BASE, 2, 2) as { position: { x: number }; length?: number };
    expect(bar.position.x).toBe(8);
    expect(bar.length).toBeUndefined(); // scale-invariant span
  });

  it('opening-info-tag: position + world-mm width scale (width NOT annotative)', () => {
    const r = scaleEntity(asEntity({ type: 'opening-info-tag', position: { x: 4, y: 0 }, widthMm: 500 }), BASE, 2, 2) as { position: { x: number }; widthMm: number };
    expect(r.position.x).toBe(8);
    expect(r.widthMm).toBe(1000);
  });

  it('array (rect): spacings, base override, and source copies all scale', () => {
    const r = scaleEntity(
      asEntity({
        type: 'array', arrayKind: 'rect',
        params: { kind: 'rect', rows: 2, cols: 2, rowSpacing: 10, colSpacing: 20, angle: 0 },
        hiddenSources: [{ type: 'line', start: { x: 1, y: 0 }, end: { x: 3, y: 0 } }],
        basePointOverride: { x: 2, y: 0 },
      }),
      BASE, 2, 2,
    ) as { params: { colSpacing: number; rowSpacing: number }; basePointOverride: { x: number }; hiddenSources: Array<{ start: { x: number } }> };
    expect(r.params.colSpacing).toBe(40);
    expect(r.params.rowSpacing).toBe(20);
    expect(r.basePointOverride.x).toBe(4);
    expect(r.hiddenSources[0].start.x).toBe(2); // recursive line scale
  });

  // ADR-647 — an imported R12 hatch preserves its AutoCAD pattern def as `inlinePattern` (absolute
  // world-unit lines). It MUST scale with the boundary or the canonical-mm import (×mmFactor) leaves
  // the pattern in source units → «very large, dense hatch» in AutoCAD (Giorgio 2026-07-13).
  it('hatch: inlinePattern (origin/delta/dashes) scales WITH the boundary (dense-hatch fix)', () => {
    const r = scaleEntity(
      asEntity({
        type: 'hatch', fillType: 'predefined', boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
        inlinePattern: {
          name: 'GRASS', labelKey: 'k', category: 'special',
          lines: [{ angle: 90, origin: [2, 3], delta: [0.09, 0.09], dashes: [0.024, -0.15] }],
        },
      }),
      BASE, 1000, 1000, // canonical-mm meters→mm factor
    ) as { boundaryPaths: Array<Array<{ x: number }>>; inlinePattern: { lines: Array<{ origin: number[]; delta: number[]; dashes: number[] }> } };
    expect(r.boundaryPaths[0][1].x).toBe(10000);          // boundary ×1000
    const l = r.inlinePattern.lines[0];
    expect(l.origin).toEqual([2000, 3000]);                // origin scales as a point
    expect(l.delta[0]).toBeCloseTo(90, 6);                 // delta ×1000 (was the bug: stayed 0.09)
    expect(l.delta[1]).toBeCloseTo(90, 6);
    expect(l.dashes).toEqual([24, -150]);                  // dashes ×1000
  });

  it('non-uniform: opening-info-tag width uses |sx|; array rect spacings split by axis', () => {
    const tag = scaleEntity(asEntity({ type: 'opening-info-tag', position: { x: 1, y: 1 }, widthMm: 100 }), BASE, 3, 5) as { widthMm: number };
    expect(tag.widthMm).toBe(300); // |sx| = 3
    const arr = scaleEntity(
      asEntity({ type: 'array', arrayKind: 'rect', params: { kind: 'rect', rows: 1, cols: 1, rowSpacing: 10, colSpacing: 10, angle: 0 }, hiddenSources: [] }),
      BASE, 3, 5,
    ) as { params: { colSpacing: number; rowSpacing: number } };
    expect(arr.params.colSpacing).toBe(30); // |sx|
    expect(arr.params.rowSpacing).toBe(50); // |sy|
  });
});

describe('isScalableEntityType — SSoT gate (ADR-646 #3)', () => {
  it('is true for CAD + newly-added geometric types', () => {
    for (const t of ['line', 'arc', 'circle', 'block', 'group', 'array', 'xline', 'ray', 'angle-measurement', 'center-mark', 'centerline', 'annotation-symbol', 'scale-bar', 'opening-info-tag']) {
      expect(isScalableEntityType(t)).toBe(true);
    }
  });

  it('is false for parametric BIM + stair (skip-with-message)', () => {
    for (const t of ['wall', 'column', 'beam', 'slab', 'foundation', 'opening', 'stair', 'roof', 'railing', 'furniture', 'mep-segment']) {
      expect(isScalableEntityType(t)).toBe(false);
    }
  });
});
