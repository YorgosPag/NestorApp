/**
 * ADR-396 Phase P4 — EnvelopeRenderer pure-logic tests.
 *
 * Covers το testable boundary του P4 render: το pure plan-builder + hatch-key
 * resolver + V/G visibility gate. Το canvas draw (`EnvelopeRenderer.render`) είναι
 * thin ctx I/O — εξαιρείται (καλύπτεται με manual smoke στο /dxf/viewer).
 */

import {
  buildEnvelopeRenderPlan,
  resolveEnvelopeHatchKey,
} from '../envelope-render-plan';
import type { EnvelopeChain } from '../../geometry/envelope-perimeter';
import { computeWallHatchPlan } from '../../walls/wall-hatch-patterns';
import { resolveIsEntityVisible } from '../../visibility/visibility-resolver';
import { GRAPHITE_EPS_MATERIAL_ID } from '../../types/thermal-envelope-types';
import type { BoundingBox3D } from '../../types/bim-base';

function squareChain(): EnvelopeChain {
  const exterior = [
    { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 },
  ];
  const outer = [
    { x: -100, y: -100 }, { x: 1100, y: -100 }, { x: 1100, y: 1100 }, { x: -100, y: 1100 },
  ];
  return {
    exteriorFaceLoop: { points: exterior, closed: true },
    insulationOuterLoop: { points: outer, closed: true },
    closed: true,
    perimeterM: 4.8,
    wallIds: ['w1', 'w2', 'w3', 'w4'],
  };
}

describe('buildEnvelopeRenderPlan', () => {
  it('builds a closed band ring (outer forward + exterior reversed)', () => {
    const plan = buildEnvelopeRenderPlan(squareChain(), GRAPHITE_EPS_MATERIAL_ID);
    expect(plan).not.toBeNull();
    // 4 outer + 4 inner = 8 ring vertices.
    expect(plan!.bandRing).toHaveLength(8);
    expect(plan!.outerClosed).toBe(true);
    // outerLoop = insulationOuterLoop points (continuous offset polyline).
    expect(plan!.outerLoop).toEqual(squareChain().insulationOuterLoop.points);
  });

  it('reuses computeWallHatchPlan (hatch SSoT, no duplication)', () => {
    const plan = buildEnvelopeRenderPlan(squareChain(), GRAPHITE_EPS_MATERIAL_ID);
    const bbox: BoundingBox3D = {
      min: { x: -100, y: -100, z: 0 },
      max: { x: 1100, y: 1100, z: 0 },
    };
    const expected = computeWallHatchPlan(bbox, resolveEnvelopeHatchKey(GRAPHITE_EPS_MATERIAL_ID));
    expect(plan!.hatch.lines.length).toBeGreaterThan(0);
    expect(plan!.hatch.lines.length).toBe(expected.lines.length);
  });

  it('returns null for a degenerate chain (< 2 outer points)', () => {
    const chain = squareChain();
    const degenerate: EnvelopeChain = {
      ...chain,
      insulationOuterLoop: { points: [{ x: 0, y: 0 }], closed: false },
    };
    expect(buildEnvelopeRenderPlan(degenerate, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

describe('resolveEnvelopeHatchKey', () => {
  it('maps insulation material → diagonal hatch family (gypsum)', () => {
    expect(resolveEnvelopeHatchKey(GRAPHITE_EPS_MATERIAL_ID)).toBe('gypsum');
    expect(resolveEnvelopeHatchKey('mat-xps')).toBe('gypsum');
  });
});

describe('envelope V/G visibility gate (ADR-382)', () => {
  it('hides when objectStyles.envelope.visible === false', () => {
    const visible = resolveIsEntityVisible(
      { category: 'envelope' },
      { objectStyles: { envelope: { projectionPen: 3, cutPen: 4, visible: false } } },
    );
    expect(visible).toBe(false);
  });

  it('shows when envelope visible flag is absent/true', () => {
    expect(
      resolveIsEntityVisible({ category: 'envelope' }, { objectStyles: {} }),
    ).toBe(true);
    expect(
      resolveIsEntityVisible(
        { category: 'envelope' },
        { objectStyles: { envelope: { projectionPen: 3, cutPen: 4, visible: true } } },
      ),
    ).toBe(true);
  });
});
