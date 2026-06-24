/**
 * ADR-362 Round 26 — `buildDimensionBlockPrimitives` (pure block-geometry SSoT).
 *
 * Verifies the world-space primitives of a dimension's anonymous block are built
 * entirely from the on-screen SSoT (`buildDimensionGeometry` + `getArrowheadBlock`
 * + `resolveDimensionText`): extension lines, dim line/arc/leader, arrowheads
 * (solid → fill, stroked → lines, none → nothing), and the measured text.
 */

import {
  buildDimensionBlockPrimitives,
  type DimBlockPrimitive,
} from '../dim-block-primitives';
import { ISO_129_TEMPLATE, ASME_Y14_5_TEMPLATE } from '../dim-style-templates';
import type { DimensionEntity, DimStyle } from '../../../types/dimension';

function linearDim(styleId: string): DimensionEntity {
  return {
    id: 'd', type: 'dimension', dimensionType: 'linear', layerId: 'L',
    styleId,
    defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
    rotation: 0, measurementValue: 100,
  } as unknown as DimensionEntity;
}
function radiusDim(styleId: string): DimensionEntity {
  return {
    id: 'r', type: 'dimension', dimensionType: 'radius', layerId: 'L',
    styleId,
    defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    measurementValue: 50,
  } as unknown as DimensionEntity;
}
function angular3PDim(styleId: string): DimensionEntity {
  return {
    id: 'a', type: 'dimension', dimensionType: 'angular3P', layerId: 'L',
    styleId,
    defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 5, y: 5 }],
  } as unknown as DimensionEntity;
}

const count = (prims: DimBlockPrimitive[], kind: DimBlockPrimitive['kind']): number =>
  prims.filter((p) => p.kind === kind).length;

describe('buildDimensionBlockPrimitives — linear', () => {
  it('ISO (oblique tick) → 2 ext + 1 dim + 2 arrow lines, 1 text, no fill', () => {
    const prims = buildDimensionBlockPrimitives(linearDim(ISO_129_TEMPLATE.id), ISO_129_TEMPLATE);
    // oblique arrowhead = a single line each → 5 lines total.
    expect(count(prims, 'line')).toBe(5);
    expect(count(prims, 'fill')).toBe(0);
    expect(count(prims, 'text')).toBe(1);
  });

  it('the dim line uses the foot points from the geometry SSoT (0,20)→(100,20)', () => {
    const prims = buildDimensionBlockPrimitives(linearDim(ISO_129_TEMPLATE.id), ISO_129_TEMPLATE);
    const lines = prims.filter((p): p is Extract<DimBlockPrimitive, { kind: 'line' }> => p.kind === 'line');
    const dimLine = lines.find((l) => l.a.y === 20 && l.b.y === 20 && l.a.x === 0 && l.b.x === 100);
    expect(dimLine).toBeDefined();
  });

  it('text is centered on the geometry textAnchor, horizontal (rot 0), height = dimtxt×dimscale', () => {
    const prims = buildDimensionBlockPrimitives(linearDim(ISO_129_TEMPLATE.id), ISO_129_TEMPLATE);
    const text = prims.find((p): p is Extract<DimBlockPrimitive, { kind: 'text' }> => p.kind === 'text');
    expect(text).toBeDefined();
    expect(text!.rotationDeg).toBe(0);
    expect(text!.heightWorld).toBe(ISO_129_TEMPLATE.dimtxt * ISO_129_TEMPLATE.dimscale);
    expect(text!.text.length).toBeGreaterThan(0);
  });

  it('closedFilled arrow (ASME) → 2 solid fills, apex sits on the dim-line foot', () => {
    const prims = buildDimensionBlockPrimitives(linearDim(ASME_Y14_5_TEMPLATE.id), ASME_Y14_5_TEMPLATE);
    expect(count(prims, 'fill')).toBe(2);
    const fills = prims.filter((p): p is Extract<DimBlockPrimitive, { kind: 'fill' }> => p.kind === 'fill');
    // The triangle apex (unit [0,0]) maps to the anchor = a foot point (y=20).
    const apexOnFoot = fills.some((f) => Math.abs(f.points[0].y - 20) < 1e-9);
    expect(apexOnFoot).toBe(true);
  });

  it('dimblk "none" → no arrowhead primitives at all', () => {
    const noArrow: DimStyle = { ...ISO_129_TEMPLATE, dimblk: 'none', dimblk1: '', dimblk2: '' };
    const prims = buildDimensionBlockPrimitives(linearDim(noArrow.id), noArrow);
    // only 2 ext + 1 dim line + text.
    expect(count(prims, 'line')).toBe(3);
    expect(count(prims, 'fill')).toBe(0);
  });

  it('suppressExtLine1 drops one extension line', () => {
    const style: DimStyle = { ...ISO_129_TEMPLATE, suppressExtLine1: true };
    const prims = buildDimensionBlockPrimitives(linearDim(style.id), style);
    expect(count(prims, 'line')).toBe(4); // 1 ext + 1 dim + 2 arrows
  });
});

describe('buildDimensionBlockPrimitives — radial', () => {
  it('radius → leader line + single arrow (no 2nd arrow), text prefixed "R "', () => {
    const prims = buildDimensionBlockPrimitives(radiusDim(ISO_129_TEMPLATE.id), ISO_129_TEMPLATE);
    // 1 leader + 1 oblique arrow line. Second arrow has zero direction → skipped.
    expect(count(prims, 'line')).toBe(2);
    const text = prims.find((p): p is Extract<DimBlockPrimitive, { kind: 'text' }> => p.kind === 'text');
    expect(text!.text.startsWith('R ')).toBe(true);
  });
});

describe('buildDimensionBlockPrimitives — angular', () => {
  it('angular3P → an arc primitive with positive radius + normalized degrees', () => {
    const prims = buildDimensionBlockPrimitives(angular3PDim(ISO_129_TEMPLATE.id), ISO_129_TEMPLATE);
    const arc = prims.find((p): p is Extract<DimBlockPrimitive, { kind: 'arc' }> => p.kind === 'arc');
    expect(arc).toBeDefined();
    expect(arc!.radius).toBeGreaterThan(0);
    expect(arc!.startDeg).toBeGreaterThanOrEqual(0);
    expect(arc!.startDeg).toBeLessThan(360);
    expect(arc!.endDeg).toBeGreaterThanOrEqual(0);
    expect(arc!.endDeg).toBeLessThan(360);
  });
});
