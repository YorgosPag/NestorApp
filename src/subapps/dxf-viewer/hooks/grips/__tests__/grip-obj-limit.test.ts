/**
 * ADR-559 — tests for the AutoCAD `GRIPOBJLIMIT` predicate (SSoT for the grip-suppression rule).
 */

import { isGripObjLimitExceeded } from '../grip-obj-limit';

describe('isGripObjLimitExceeded (ADR-559 / AutoCAD GRIPOBJLIMIT)', () => {
  const LIMIT = 100; // AutoCAD default

  it('does NOT suppress when the selection count is below the limit', () => {
    expect(isGripObjLimitExceeded(1, LIMIT)).toBe(false);
    expect(isGripObjLimitExceeded(99, LIMIT)).toBe(false);
  });

  it('does NOT suppress at exactly the limit (AutoCAD hides only ABOVE the limit)', () => {
    expect(isGripObjLimitExceeded(LIMIT, LIMIT)).toBe(false);
  });

  it('suppresses as soon as the selection count exceeds the limit', () => {
    expect(isGripObjLimitExceeded(LIMIT + 1, LIMIT)).toBe(true);
    expect(isGripObjLimitExceeded(5000, LIMIT)).toBe(true);
  });

  it('treats 0 as "no limit" — grips are NEVER suppressed, even for huge selections', () => {
    expect(isGripObjLimitExceeded(0, 0)).toBe(false);
    expect(isGripObjLimitExceeded(1, 0)).toBe(false);
    expect(isGripObjLimitExceeded(32767, 0)).toBe(false);
    expect(isGripObjLimitExceeded(1_000_000, 0)).toBe(false);
  });

  it('treats any non-positive limit as "no limit" (defensive)', () => {
    expect(isGripObjLimitExceeded(10, -5)).toBe(false);
  });

  it('honours a low limit (e.g. GRIPOBJLIMIT=1 hides grips as soon as >1 object is selected)', () => {
    expect(isGripObjLimitExceeded(1, 1)).toBe(false);
    expect(isGripObjLimitExceeded(2, 1)).toBe(true);
  });

  it('does not suppress an empty selection', () => {
    expect(isGripObjLimitExceeded(0, LIMIT)).toBe(false);
  });
});
