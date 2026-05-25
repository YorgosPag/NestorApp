/**
 * ADR-376 Phase A — OpeningTagRenderer pure-helpers tests.
 *
 * Targets:
 *   - `shouldRenderTag()` matrix (layer ON/OFF, tagVisible override,
 *     zoom threshold, mark presence)
 *   - `computeTagCenter()` centroid + normal-outward offset semantics
 *   - `drawPillTag()` smoke (no throw, calls canvas API)
 */

import {
  shouldRenderTag,
  computeTagCenter,
  drawPillTag,
  OPENING_TAG_MIN_ZOOM,
} from '../OpeningTagRenderer';
import type { OpeningEntity, OpeningKind } from '../../types/opening-types';

function makeOpening(overrides: {
  kind?: OpeningKind;
  mark?: string;
  tagVisible?: boolean;
  outline?: Array<{ x: number; y: number }>;
}): OpeningEntity {
  const outline = overrides.outline ?? [
    { x: 0, y: 100 },   // start-outer
    { x: 100, y: 100 }, // end-outer
    { x: 100, y: 0 },   // end-inner
    { x: 0, y: 0 },     // start-inner
  ];
  return {
    id: 'op_test',
    type: 'opening',
    kind: overrides.kind ?? 'door',
    layerId: '0',
    ifcType: 'IfcDoor',
    params: {
      kind: overrides.kind ?? 'door',
      wallId: 'w1',
      offsetFromStart: 0,
      width: 100,
      height: 200,
      sillHeight: 0,
      mark: overrides.mark,
      tagVisible: overrides.tagVisible,
    },
    geometry: {
      position: { x: 50, y: 50, z: 0 },
      rotation: 0,
      outline: { vertices: outline.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 0 } },
      area: 0.02,
      perimeter: 0.6,
    },
    validation: { isValid: true, errors: [], warnings: [], hasCodeViolations: false },
    visible: true,
  } as unknown as OpeningEntity;
}

// ---------------------------------------------------------------------------
// shouldRenderTag matrix
// ---------------------------------------------------------------------------

describe('shouldRenderTag', () => {
  it('layer OFF → false', () => {
    const o = makeOpening({ mark: 'Θ.001' });
    expect(shouldRenderTag(o, false, 1)).toBe(false);
  });
  it('per-opening tagVisible=false → false', () => {
    const o = makeOpening({ mark: 'Θ.001', tagVisible: false });
    expect(shouldRenderTag(o, true, 1)).toBe(false);
  });
  it('missing mark → false', () => {
    const o = makeOpening({});
    expect(shouldRenderTag(o, true, 1)).toBe(false);
  });
  it('zoom below threshold → false', () => {
    const o = makeOpening({ mark: 'Θ.001' });
    expect(shouldRenderTag(o, true, OPENING_TAG_MIN_ZOOM - 0.01)).toBe(false);
  });
  it('zoom exactly at threshold → true', () => {
    const o = makeOpening({ mark: 'Θ.001' });
    expect(shouldRenderTag(o, true, OPENING_TAG_MIN_ZOOM)).toBe(true);
  });
  it('all conditions met → true', () => {
    const o = makeOpening({ mark: 'Θ.001' });
    expect(shouldRenderTag(o, true, 1.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeTagCenter
// ---------------------------------------------------------------------------

describe('computeTagCenter', () => {
  it('returns centroid + outward-normal offset', () => {
    // Outline: outer top edge (y=100), inner bottom edge (y=0).
    // Normal points from inner → outer = (0, +1).
    // Centroid: (50, 50). Offset 500mm outward → (50, 550).
    const o = makeOpening({});
    const c = computeTagCenter(o);
    expect(c.x).toBe(50);
    expect(c.y).toBe(550);
  });
  it('handles degenerate (zero-length normal) → returns centroid', () => {
    // All 4 verts the same point — normal = 0.
    const o = makeOpening({
      outline: [
        { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 },
      ],
    });
    const c = computeTagCenter(o);
    expect(c.x).toBe(10);
    expect(c.y).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// drawPillTag smoke
// ---------------------------------------------------------------------------

describe('drawPillTag', () => {
  it('does not throw and exercises canvas API', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      quadraticCurveTo: () => calls.push('quadraticCurveTo'),
      closePath: () => calls.push('closePath'),
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
      setLineDash: () => calls.push('setLineDash'),
      fillText: () => calls.push('fillText'),
      measureText: () => ({ width: 30 }),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textBaseline: '',
      textAlign: '',
    } as unknown as CanvasRenderingContext2D;

    expect(() => drawPillTag(ctx, { x: 100, y: 100 }, 'Θ.001', '#c97c2f')).not.toThrow();
    expect(calls).toContain('save');
    expect(calls).toContain('fill');
    expect(calls).toContain('stroke');
    expect(calls).toContain('fillText');
    expect(calls).toContain('restore');
  });
});
