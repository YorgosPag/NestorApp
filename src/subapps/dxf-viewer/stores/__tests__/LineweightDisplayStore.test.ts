/**
 * Tests — ADR-510 Φ2G LineweightDisplayStore (AutoCAD LWDISPLAY toggle).
 */

import {
  getShowLineweight,
  setShowLineweight,
  toggleShowLineweight,
  subscribeLineweightDisplay,
  DEFAULT_SHOW_LINEWEIGHT,
  __resetLineweightDisplayForTesting,
} from '../LineweightDisplayStore';

describe('LineweightDisplayStore', () => {
  beforeEach(() => {
    __resetLineweightDisplayForTesting();
  });

  it('defaults to ON (weights visible)', () => {
    expect(getShowLineweight()).toBe(DEFAULT_SHOW_LINEWEIGHT);
    expect(getShowLineweight()).toBe(true);
  });

  it('sets and reads the flag', () => {
    setShowLineweight(false);
    expect(getShowLineweight()).toBe(false);
    setShowLineweight(true);
    expect(getShowLineweight()).toBe(true);
  });

  it('toggles the flag', () => {
    toggleShowLineweight();
    expect(getShowLineweight()).toBe(false);
    toggleShowLineweight();
    expect(getShowLineweight()).toBe(true);
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsub = subscribeLineweightDisplay(() => {
      calls += 1;
    });
    setShowLineweight(false);
    expect(calls).toBe(1);
    unsub();
    setShowLineweight(true);
    expect(calls).toBe(1);
  });

  it('does not notify when the value is unchanged', () => {
    let calls = 0;
    subscribeLineweightDisplay(() => {
      calls += 1;
    });
    setShowLineweight(true); // already the default → no-op
    expect(calls).toBe(0);
  });
});
