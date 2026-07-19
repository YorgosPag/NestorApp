/**
 * ADR-680 — εφήμερο DIST store: accumulation, dedupe, finish/undo/clear, notify semantics.
 */
import {
  subscribeDist, getDistSnapshot, addDistPoint, finishDistPath,
  undoLastDistPoint, clearDist, __resetDistForTest,
} from '../dist-ephemeral-store';

describe('dist-ephemeral-store', () => {
  beforeEach(() => __resetDistForTest());

  it('starts empty with a stable snapshot reference', () => {
    const a = getDistSnapshot();
    const b = getDistSnapshot();
    expect(a).toBe(b); // stable ref while unchanged (required by useSyncExternalStore)
    expect(a.active).toHaveLength(0);
    expect(a.committed).toHaveLength(0);
    expect(a.clearToken).toBe(0);
  });

  it('appends points to the active path', () => {
    addDistPoint({ x: 0, y: 0 });
    addDistPoint({ x: 3, y: 0 });
    expect(getDistSnapshot().active).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  });

  it('dedupes a coincident repeat (double-click 2nd click)', () => {
    addDistPoint({ x: 1, y: 1 });
    addDistPoint({ x: 1, y: 1 });
    expect(getDistSnapshot().active).toHaveLength(1);
  });

  it('finishPath moves active (>=2 pts) into committed and resets active', () => {
    addDistPoint({ x: 0, y: 0 });
    addDistPoint({ x: 5, y: 0 });
    finishDistPath();
    const s = getDistSnapshot();
    expect(s.active).toHaveLength(0);
    expect(s.committed).toHaveLength(1);
    expect(s.committed[0]).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  });

  it('finishPath drops a lone point (no zero-length commit)', () => {
    addDistPoint({ x: 2, y: 2 });
    finishDistPath();
    const s = getDistSnapshot();
    expect(s.active).toHaveLength(0);
    expect(s.committed).toHaveLength(0);
  });

  it('undoLastDistPoint removes the last active point', () => {
    addDistPoint({ x: 0, y: 0 });
    addDistPoint({ x: 1, y: 0 });
    undoLastDistPoint();
    expect(getDistSnapshot().active).toEqual([{ x: 0, y: 0 }]);
  });

  it('clear wipes everything and bumps clearToken', () => {
    addDistPoint({ x: 0, y: 0 });
    addDistPoint({ x: 1, y: 0 });
    finishDistPath();
    clearDist();
    const s = getDistSnapshot();
    expect(s.active).toHaveLength(0);
    expect(s.committed).toHaveLength(0);
    expect(s.clearToken).toBe(1);
  });

  it('notifies subscribers on mutation, but not on a dedupe no-op', () => {
    let n = 0;
    const unsub = subscribeDist(() => { n++; });
    addDistPoint({ x: 0, y: 0 });   // +1
    addDistPoint({ x: 0, y: 0 });   // dedupe → no notify
    addDistPoint({ x: 4, y: 0 });   // +1
    unsub();
    expect(n).toBe(2);
  });
});
