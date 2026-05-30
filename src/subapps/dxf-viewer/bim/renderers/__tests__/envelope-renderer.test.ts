/**
 * ADR-396 Phase P4 — EnvelopeRenderer pure-logic tests.
 *
 * Covers το testable boundary του P4 render: το pure plan-builder + hatch-key
 * resolver + V/G visibility gate. Το canvas draw (`EnvelopeRenderer.render`) είναι
 * thin ctx I/O — εξαιρείται (καλύπτεται με manual smoke στο /dxf/viewer).
 */

import {
  EnvelopeRenderer,
  buildEnvelopeRenderPlan,
  buildSlabHatchPlan,
  buildRevealJambPlans,
  resolveEnvelopeHatchKey,
} from '../EnvelopeRenderer';
import type { Point3D } from '../../types/bim-base';
import type { EnvelopeChain } from '../../geometry/envelope-perimeter';
import type { EnvelopeOpeningCut } from '../../geometry/envelope-opening-cuts';
import type { ViewTransform } from '../../../rendering/types/Types';
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

describe('buildSlabHatchPlan (Z2/Z3 εκτεθειμένη πλάκα)', () => {
  const footprint: Point3D[] = [
    { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1500 }, { x: 0, y: 1500 },
  ];

  it('περνά το footprint ως polygon + γεμίζει hatch (reuse SSoT)', () => {
    const plan = buildSlabHatchPlan(footprint, GRAPHITE_EPS_MATERIAL_ID);
    expect(plan).not.toBeNull();
    expect(plan!.polygon).toEqual(footprint);
    expect(plan!.hatch.lines.length).toBeGreaterThan(0);
  });

  it('επιστρέφει null για degenerate footprint (< 3 κορυφές)', () => {
    expect(buildSlabHatchPlan([{ x: 0, y: 0 }, { x: 1, y: 1 }], GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

describe('buildRevealJambPlans (Z4 περβάζια — 2 παραστάδες)', () => {
  const outline: Point3D[] = [
    { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 250 }, { x: 0, y: 250 },
  ];

  it('χτίζει 2 jamb plans (bandRing=quad + outerLoop κλειστό + hatch)', () => {
    const plans = buildRevealJambPlans(outline, 50, GRAPHITE_EPS_MATERIAL_ID);
    expect(plans).toHaveLength(2);
    for (const plan of plans) {
      expect(plan.bandRing).toHaveLength(4);   // solid jamb quad (όχι 8-vertex frame)
      expect(plan.outerLoop).toHaveLength(4);  // ίδιο quad → strokeOuterLoop ορατό
      expect(plan.outerClosed).toBe(true);
      expect(plan.hatch.lines.length).toBeGreaterThan(0);
    }
  });

  it('επιστρέφει άδειο array για insetCanvas <= 0 ή degenerate outline', () => {
    expect(buildRevealJambPlans(outline, 0, GRAPHITE_EPS_MATERIAL_ID)).toEqual([]);
    expect(buildRevealJambPlans([{ x: 0, y: 0 }, { x: 1, y: 0 }], 50, GRAPHITE_EPS_MATERIAL_ID)).toEqual([]);
  });
});

describe('resolveEnvelopeHatchKey', () => {
  it('maps insulation material → diagonal hatch family (gypsum)', () => {
    expect(resolveEnvelopeHatchKey(GRAPHITE_EPS_MATERIAL_ID)).toBe('gypsum');
    expect(resolveEnvelopeHatchKey('mat-xps')).toBe('gypsum');
  });
});

describe('EnvelopeRenderer.strokeOpeningCutCaps (Z1 cut απολήξεις)', () => {
  interface MockCtx {
    save: jest.Mock; restore: jest.Mock; beginPath: jest.Mock;
    moveTo: jest.Mock; lineTo: jest.Mock; stroke: jest.Mock; setLineDash: jest.Mock;
    strokeStyle: string; lineWidth: number;
  }
  function mockCtx(): MockCtx {
    return {
      save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(),
      moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(), setLineDash: jest.fn(),
      strokeStyle: '', lineWidth: 0,
    };
  }
  const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const viewport = { width: 800, height: 600 };
  const cut: EnvelopeOpeningCut = {
    edgeIndex: 0, tStart: 0.4, tEnd: 0.6, sillM: 0.9, headM: 2.3,
    // [O_a, O_b, F_b, F_a] με κάθετες απολήξεις: O_a→F_a και O_b→F_b.
    bandQuad: [
      { x: 2000, y: -100, z: 0 }, { x: 3000, y: -100, z: 0 },
      { x: 3000, y: 0, z: 0 }, { x: 2000, y: 0, z: 0 },
    ],
  };

  it('σχεδιάζει 2 κάθετες απολήξεις ανά cut ([O_a→F_a], [O_b→F_b])', () => {
    const ctx = mockCtx();
    new EnvelopeRenderer(ctx as unknown as CanvasRenderingContext2D)
      .strokeOpeningCutCaps([cut], transform, viewport);
    // 1 cut → 2 απολήξεις → 2 moveTo + 2 lineTo + 1 stroke.
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    // Χρώμα = θερμό insulation tint (ίδιο με τη μεγάλη γραμμή).
    expect(ctx.strokeStyle).toBe('rgba(184, 92, 28, 0.95)');
  });

  it('no-op όταν δεν υπάρχουν cuts', () => {
    const ctx = mockCtx();
    new EnvelopeRenderer(ctx as unknown as CanvasRenderingContext2D)
      .strokeOpeningCutCaps([], transform, viewport);
    expect(ctx.stroke).not.toHaveBeenCalled();
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
