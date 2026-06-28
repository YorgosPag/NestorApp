/**
 * ADR-040 / ADR-452 — pointer-activity: «cursor moving» motion signal that lets the section
 * controller drop to cheap grey caps while the user sweeps the pointer (refine-on-settle restores
 * colour). Pure timestamp logic — no clock dependency (the caller passes `now`).
 */

import { markPointerMoved, isPointerActive } from '../pointer-activity';

describe('pointer-activity', () => {
  it('is inactive before any move within the window', () => {
    // Far past the last (0) move stamp → settled.
    expect(isPointerActive(10_000, 100)).toBe(false);
  });

  it('is active immediately after a move', () => {
    markPointerMoved(1_000);
    expect(isPointerActive(1_000, 100)).toBe(true);
    expect(isPointerActive(1_050, 100)).toBe(true); // 50ms later, within 100ms window
  });

  it('becomes inactive once the settle window elapses', () => {
    markPointerMoved(2_000);
    expect(isPointerActive(2_099, 100)).toBe(true);  // 99ms < 100ms
    expect(isPointerActive(2_100, 100)).toBe(false); // exactly 100ms → settled (strict <)
    expect(isPointerActive(2_250, 100)).toBe(false); // well past
  });

  it('a fresh move re-arms the active window', () => {
    markPointerMoved(3_000);
    expect(isPointerActive(3_200, 100)).toBe(false); // settled
    markPointerMoved(3_200);
    expect(isPointerActive(3_250, 100)).toBe(true);  // re-armed
  });
});
