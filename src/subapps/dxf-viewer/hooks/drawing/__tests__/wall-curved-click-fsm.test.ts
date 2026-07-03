/**
 * ADR-565 §12 Φ1.x — per-variant curved click FSM transition tests.
 */

import { resolveCurvedClickTransition } from '../wall-curved-click-fsm';
import { INITIAL_STATE, type WallToolState } from '../wall-tool-types';
import type { WallArcVariant } from '../../../bim/types/wall-types';

function curvedState(variant: WallArcVariant, patch: Partial<WallToolState>): WallToolState {
  return { ...INITIAL_STATE, kind: 'curved', arcVariant: variant, phase: 'awaitingStart', ...patch };
}

const P = { x: 3, y: 4 };

describe('resolveCurvedClickTransition — 3-point / start-end-radius', () => {
  for (const variant of ['3-point', 'start-end-radius'] as const) {
    it(`${variant}: start → end → commit (3 clicks)`, () => {
      const s0 = curvedState(variant, { phase: 'awaitingStart' });
      const t1 = resolveCurvedClickTransition(s0, P);
      expect(t1.kind).toBe('advance');
      expect(t1.kind === 'advance' && t1.next.phase).toBe('awaitingEnd');
      expect(t1.kind === 'advance' && t1.next.startPoint).toEqual(P);

      const t2 = resolveCurvedClickTransition(curvedState(variant, { phase: 'awaitingEnd', startPoint: P }), { x: 9, y: 9 });
      expect(t2.kind === 'advance' && t2.next.phase).toBe('awaitingCurveControl');

      const t3 = resolveCurvedClickTransition(curvedState(variant, { phase: 'awaitingCurveControl', startPoint: P, endPoint: { x: 9, y: 9 } }), { x: 5, y: 5 });
      expect(t3.kind).toBe('commit');
    });
  }
});

describe('resolveCurvedClickTransition — center-ends (center first, 3 clicks)', () => {
  it('click 1 stores the center (not the start)', () => {
    const t = resolveCurvedClickTransition(curvedState('center-ends', { phase: 'awaitingStart' }), P);
    expect(t.kind === 'advance' && t.next.phase).toBe('awaitingEnd');
    expect(t.kind === 'advance' && t.next.arcCenter).toEqual(P);
    expect(t.kind === 'advance' && t.next.startPoint).toBeNull();
  });

  it('click 2 stores the start (radius) and advances to awaitingArcRadiusPoint', () => {
    const t = resolveCurvedClickTransition(curvedState('center-ends', { phase: 'awaitingEnd', arcCenter: P }), { x: 8, y: 0 });
    expect(t.kind === 'advance' && t.next.phase).toBe('awaitingArcRadiusPoint');
    expect(t.kind === 'advance' && t.next.startPoint).toEqual({ x: 8, y: 0 });
  });

  it('click 3 commits', () => {
    const s = curvedState('center-ends', { phase: 'awaitingArcRadiusPoint', arcCenter: P, startPoint: { x: 8, y: 0 } });
    expect(resolveCurvedClickTransition(s, { x: 0, y: 8 }).kind).toBe('commit');
  });
});

describe('resolveCurvedClickTransition — tangent (2 clicks)', () => {
  it('start → commit (the 2nd click is the end)', () => {
    const t1 = resolveCurvedClickTransition(curvedState('tangent', { phase: 'awaitingStart' }), P);
    expect(t1.kind === 'advance' && t1.next.phase).toBe('awaitingEnd');
    const t2 = resolveCurvedClickTransition(curvedState('tangent', { phase: 'awaitingEnd', startPoint: P }), { x: 9, y: 9 });
    expect(t2.kind).toBe('commit');
  });
});
