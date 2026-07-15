/**
 * ADR-658 M1 — «Μολύβι» freehand: FSM factory + screen throttle + store emit.
 */
import { createFreehandTraceStore } from '../../freehand/createFreehandTraceStore';
import { passesTraceThrottle } from '../../freehand/pointer-trace-throttle';
import { SketchFreehandStore } from '../SketchFreehandStore';
import { EventBus } from '../../events/EventBus';
import {
  getSketchFidelityPx,
  setSketchFidelityLevel,
  getSketchFidelityState,
  SKETCH_FIDELITY_PX,
} from '../sketch-fidelity-store';
import {
  getSketchOutputType,
  getSketchOutputState,
  setSketchOutputType,
} from '../sketch-output-store';
import { createEntityFromTool } from '../../../hooks/drawing/drawing-entity-builders';

describe('createFreehandTraceStore (ADR-658 SSoT factory)', () => {
  it('startAt activates and seeds the first point', () => {
    const store = createFreehandTraceStore({ minPoints: 2, onFinish: jest.fn() });
    expect(store.isActive()).toBe(false);
    store.startAt(1, 2);
    expect(store.isActive()).toBe(true);
    expect(store.getPoints()).toEqual([[1, 2]]);
  });

  it('addPoint appends only while active', () => {
    const store = createFreehandTraceStore({ minPoints: 2, onFinish: jest.fn() });
    store.addPoint(9, 9); // ignored — not active yet
    expect(store.getPoints()).toEqual([]);
    store.startAt(0, 0);
    store.addPoint(1, 1);
    store.addPoint(2, 2);
    expect(store.getPoints()).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('finish runs onFinish with the trace + nearClose flag, then clears', () => {
    const onFinish = jest.fn();
    const store = createFreehandTraceStore({ minPoints: 2, onFinish });
    store.startAt(0, 0);
    store.addPoint(1, 1);
    store.finish();
    expect(onFinish).toHaveBeenCalledWith([[0, 0], [1, 1]], false);
    expect(store.isActive()).toBe(false);
    expect(store.getPoints()).toEqual([]);
  });

  it('setNearClose toggles the flag + is passed to onFinish', () => {
    const onFinish = jest.fn();
    const store = createFreehandTraceStore({ minPoints: 2, onFinish });
    store.startAt(0, 0);
    store.addPoint(1, 1);
    store.addPoint(2, 0);
    store.setNearClose(true);
    expect(store.isNearClose()).toBe(true);
    expect(store.getSnapshot().nearClose).toBe(true);
    store.finish();
    expect(onFinish).toHaveBeenCalledWith([[0, 0], [1, 1], [2, 0]], true);
    // cleared after finish
    expect(store.isNearClose()).toBe(false);
  });

  it('finish below minPoints clears without calling onFinish', () => {
    const onFinish = jest.fn();
    const store = createFreehandTraceStore({ minPoints: 3, onFinish });
    store.startAt(0, 0);
    store.addPoint(1, 1);
    store.finish();
    expect(onFinish).not.toHaveBeenCalled();
    expect(store.getPoints()).toEqual([]);
  });

  it('cancel clears silently (no onFinish)', () => {
    const onFinish = jest.fn();
    const store = createFreehandTraceStore({ minPoints: 2, onFinish });
    store.startAt(0, 0);
    store.addPoint(1, 1);
    store.cancel();
    expect(onFinish).not.toHaveBeenCalled();
    expect(store.isActive()).toBe(false);
    expect(store.getPoints()).toEqual([]);
  });

  it('subscribe fires on every mutation', () => {
    const store = createFreehandTraceStore({ minPoints: 2, onFinish: jest.fn() });
    const cb = jest.fn();
    const unsub = store.subscribe(cb);
    store.startAt(0, 0);
    store.addPoint(1, 1);
    expect(cb).toHaveBeenCalled();
    unsub();
  });
});

describe('passesTraceThrottle', () => {
  it('accepts the first sample and rejects sub-threshold moves', () => {
    const ref: { current: { x: number; y: number } | null } = { current: null };
    expect(passesTraceThrottle(0, 0, ref, 3)).toBe(true);  // first sample
    expect(passesTraceThrottle(1, 1, ref, 3)).toBe(false); // dist² = 2 < 9
    expect(passesTraceThrottle(5, 0, ref, 3)).toBe(true);  // dist² = 25 ≥ 9 from (0,0)
  });
});

describe('SketchFreehandStore (ADR-658 M1)', () => {
  afterEach(() => SketchFreehandStore.cancel());

  it('emits sketch:freehand-complete with the trace on finish (≥ 2 pts)', () => {
    const received: Array<{ points: Array<[number, number]>; closed: boolean }> = [];
    const off = EventBus.on('sketch:freehand-complete', (p) => received.push(p));
    SketchFreehandStore.startAt(0, 0);
    SketchFreehandStore.addPoint(10, 10);
    SketchFreehandStore.finish();
    off();
    expect(received).toHaveLength(1);
    expect(received[0].points).toEqual([[0, 0], [10, 10]]);
    expect(received[0].closed).toBe(false);
  });

  it('does not emit on finish with < 2 points', () => {
    let emitted = false;
    const off = EventBus.on('sketch:freehand-complete', () => { emitted = true; });
    SketchFreehandStore.startAt(0, 0);
    SketchFreehandStore.finish();
    off();
    expect(emitted).toBe(false);
    expect(SketchFreehandStore.getPoints()).toEqual([]);
  });

  it('D5 — closed=true only when near-close AND ≥ 3 points', () => {
    const received: Array<{ closed: boolean }> = [];
    const off = EventBus.on('sketch:freehand-complete', (p) => received.push(p));
    // 2 points near-close → NOT closed (needs ≥ 3 to enclose an area)
    SketchFreehandStore.startAt(0, 0);
    SketchFreehandStore.addPoint(5, 5);
    SketchFreehandStore.setNearClose(true);
    SketchFreehandStore.finish();
    // 3 points near-close → closed
    SketchFreehandStore.startAt(0, 0);
    SketchFreehandStore.addPoint(10, 0);
    SketchFreehandStore.addPoint(5, 8);
    SketchFreehandStore.setNearClose(true);
    SketchFreehandStore.finish();
    off();
    expect(received.map((r) => r.closed)).toEqual([false, true]);
  });
});

describe('sketch-fidelity-store (ADR-658 D3)', () => {
  afterEach(() => setSketchFidelityLevel('balanced'));

  it('defaults to balanced (2px tolerance)', () => {
    expect(getSketchFidelityState().level).toBe('balanced');
    expect(getSketchFidelityPx()).toBe(SKETCH_FIDELITY_PX.balanced);
  });

  it('setSketchFidelityLevel updates the px tolerance', () => {
    setSketchFidelityLevel('smooth');
    expect(getSketchFidelityState().level).toBe('smooth');
    expect(getSketchFidelityPx()).toBe(SKETCH_FIDELITY_PX.smooth);
    setSketchFidelityLevel('accurate');
    expect(getSketchFidelityPx()).toBe(SKETCH_FIDELITY_PX.accurate);
  });
});

describe('sketch-output-store (ADR-658 M3, D1/D2)', () => {
  afterEach(() => setSketchOutputType('polyline'));

  it('defaults to polyline («Τεθλασμένη»)', () => {
    expect(getSketchOutputState().outputType).toBe('polyline');
    expect(getSketchOutputType()).toBe('polyline');
  });

  it('setSketchOutputType toggles polyline ↔ spline', () => {
    setSketchOutputType('spline');
    expect(getSketchOutputState().outputType).toBe('spline');
    expect(getSketchOutputType()).toBe('spline');
    setSketchOutputType('polyline');
    expect(getSketchOutputType()).toBe('polyline');
  });

  it('persists the last-used type across a reload (localStorage)', () => {
    setSketchOutputType('spline');
    expect(localStorage.getItem('dxf:sketchOutput.lastUsed')).toBe('spline');
  });
});

describe('createEntityFromTool — «Μολύβι» output (ADR-658 M3, D1)', () => {
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
  afterEach(() => setSketchOutputType('polyline'));

  it('«Τεθλασμένη» → plain PolylineEntity (no smoothDisplay) with the RDP-simplified vertices', () => {
    setSketchOutputType('polyline');
    const entity = createEntityFromTool('sketch', pts, 'e1', false);
    expect(entity?.type).toBe('polyline');
    expect((entity as { vertices: unknown[] }).vertices).toEqual(pts);
    expect((entity as { smoothDisplay?: boolean }).smoothDisplay).toBeUndefined();
  });

  it('«Καμπύλη» → PolylineEntity with smoothDisplay:true (ADR-650 fitted-curve render)', () => {
    setSketchOutputType('spline');
    const entity = createEntityFromTool('sketch', pts, 'e2', false);
    expect(entity?.type).toBe('polyline');
    expect((entity as { vertices: unknown[] }).vertices).toEqual(pts);
    expect((entity as { smoothDisplay?: boolean }).smoothDisplay).toBe(true);
    expect((entity as { closed: boolean }).closed).toBe(false);
  });

  it('«Καμπύλη» with < 2 points → null (falls through, no entity)', () => {
    setSketchOutputType('spline');
    expect(createEntityFromTool('sketch', [{ x: 1, y: 1 }], 'e3', false)).toBeNull();
  });
});
