/**
 * ADR-366 Phase 9 / C.3 — FSM unit tests.
 */

import {
  activateTool,
  buildAnchorFromContext,
  cancelTool,
  continueTool,
  cycleMode,
  placeFirstPoint,
  placeSecondPoint,
  placeTextAnchor,
} from '../dimensions/Dim3DToolStateMachine';

const POINT_A = { x: 1, y: 0, z: 0 };
const POINT_B = { x: 5, y: 0, z: 0 };
const POINT_C = { x: 5, y: 5, z: 0 };

describe('activateTool', () => {
  it('returns placing1 state for given mode', () => {
    const r = activateTool('aligned');
    expect(r.state).toBe('placing1');
    expect(r.context.mode).toBe('aligned');
  });
});

describe('placeFirstPoint', () => {
  it('captures endpoint A and transitions to placing2', () => {
    const after = placeFirstPoint({ mode: 'aligned' }, POINT_A);
    expect(after.state).toBe('placing2');
    expect(after.context.endpointA).toEqual(POINT_A);
  });
});

describe('placeSecondPoint — non-angular', () => {
  it('captures endpoint B and transitions to placingText', () => {
    const after = placeSecondPoint({ mode: 'aligned', endpointA: POINT_A }, POINT_B);
    expect(after.state).toBe('placingText');
    expect(after.context.endpointB).toEqual(POINT_B);
  });
});

describe('placeSecondPoint — angular requires 3 points', () => {
  it('stays in placing2 after 1 additional point', () => {
    const after = placeSecondPoint({ mode: 'angular', endpointA: POINT_A }, POINT_B);
    expect(after.state).toBe('placing2');
    expect(after.context.additionalPoints).toEqual([POINT_B]);
  });

  it('transitions to placingText after 2 additional points', () => {
    const intermediate = placeSecondPoint(
      { mode: 'angular', endpointA: POINT_A },
      POINT_B,
    );
    const final = placeSecondPoint(intermediate.context, POINT_C);
    expect(final.state).toBe('placingText');
    expect(final.context.additionalPoints).toHaveLength(2);
  });
});

describe('cycleMode', () => {
  it('rotates aligned → linear → radial → angular → aligned', () => {
    const m1 = cycleMode({ mode: 'aligned' });
    expect(m1.mode).toBe('linear');
    const m2 = cycleMode(m1);
    expect(m2.mode).toBe('radial');
    const m3 = cycleMode(m2);
    expect(m3.mode).toBe('angular');
    const m4 = cycleMode(m3);
    expect(m4.mode).toBe('aligned');
  });
});

describe('cancelTool', () => {
  it('returns idle state with empty context', () => {
    const after = cancelTool();
    expect(after.state).toBe('idle');
    expect(after.context.endpointA).toBeUndefined();
    expect(after.context.endpointB).toBeUndefined();
  });
});

describe('continueTool', () => {
  it('preserves mode but resets to placing1', () => {
    const after = continueTool({ mode: 'radial', endpointA: POINT_A, endpointB: POINT_B });
    expect(after.state).toBe('placing1');
    expect(after.context.mode).toBe('radial');
    expect(after.context.endpointA).toBeUndefined();
  });
});

describe('placeTextAnchor → committed', () => {
  it('transitions to committed without mutating context', () => {
    const ctx = { mode: 'aligned' as const, endpointA: POINT_A, endpointB: POINT_B };
    const after = placeTextAnchor(ctx);
    expect(after.state).toBe('committed');
    expect(after.context).toBe(ctx);
  });
});

describe('buildAnchorFromContext', () => {
  it('builds a valid anchor from committed context', () => {
    const anchor = buildAnchorFromContext({ mode: 'aligned', endpointA: POINT_A, endpointB: POINT_B });
    expect(anchor.endpointA).toEqual(POINT_A);
    expect(anchor.endpointB).toEqual(POINT_B);
  });

  it('throws when endpoints missing', () => {
    expect(() => buildAnchorFromContext({ mode: 'aligned' })).toThrow();
  });
});
